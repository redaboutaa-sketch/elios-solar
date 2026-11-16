#!/usr/bin/env python3
"""
Contrôle SEO quotidien déterministe de https://heliostores.com (aucun appel LLM, aucune écriture sur le site).

Vérifie : disponibilité, redirections http/www, robots.txt, sitemap, page 404, et pour chaque URL commerciale
prioritaire : statut 200, canonique propre, absence de noindex (balise et en-tête), titre, H1 unique, JSON-LD valide.
Crawl limité : ~25 requêtes, une par seconde, User-Agent identifié, aucune redirection suivie.

État (persistant après redémarrage) : $STATE_DIRECTORY ou /var/lib/heliostores-seo
  daily/AAAA-MM-JJ.json   résultat complet du jour (90 jours conservés)
  incidents.json          incidents ouverts (première/dernière observation) : un incident n'est journalisé
                          « NOUVEAU » qu'une fois, puis « persistant », puis « RÉSOLU » — aucune notification externe.
Code de sortie : 0 si aucun incident ouvert, 1 sinon (visible dans `systemctl status`).
"""
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

SITE = os.environ.get("SEO_SITE", "https://heliostores.com")
UA = "HeliostoresSEOCheck/1.0 (+https://heliostores.com; controle interne)"
DELAY_S = float(os.environ.get("SEO_DELAY_S", "1.0"))
STATE = Path(os.environ.get("STATE_DIRECTORY", "/var/lib/heliostores-seo"))
KEEP_DAYS = 90

PRIORITY = [
    "/", "/pergolas", "/screens", "/stores-bannes", "/moustiquaires", "/accessoires",
    "/pergolas/malaga", "/pergolas/marbella", "/pergolas/sevilla",
    "/screens/helioscreen", "/screens/helioroof-screen",
    "/stores-bannes/casablanca", "/stores-bannes/corsica", "/stores-bannes/jamaica", "/stores-bannes/madera",
    "/moustiquaires/moskifold", "/guides/prise-de-mesures", "/guides/choisir-sa-pergola", "/devis",
]


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


OPENER = urllib.request.build_opener(NoRedirect)


def fetch(url):
    time.sleep(DELAY_S)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with OPENER.open(req, timeout=20) as r:
            return r.status, dict(r.headers), r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read().decode("utf-8", "replace") if e.fp else ""
    except Exception as e:  # réseau, TLS, délai
        return 0, {}, f"{type(e).__name__}: {e}"


def hdr(h, name):
    for k, v in h.items():
        if k.lower() == name:
            return v
    return ""


def page_checks(path, status, h, body, notes):
    url = SITE.rstrip("/") + ("/" if path == "/" else path)
    problems = []
    if status != 200:
        return [f"statut {status}"]
    head = body.split("</head>")[0]
    # Next.js peut diffuser les métadonnées après le <head> (rendu en flux) pour un User-Agent non reconnu comme
    # robot : on contrôle le document entier et on note la position, sans en faire un incident.
    can = re.search(r'<link rel="canonical" href="([^"]*)"', body)
    if can and can.start() > len(head):
        notes.append(f"{path} : métadonnées diffusées hors <head>")
    expected = {url, url.rstrip("/")}
    if not can:
        problems.append("canonique absente")
    elif can.group(1) not in expected:
        problems.append(f"canonique inattendue {can.group(1)}")
    robots = re.search(r'<meta name="robots" content="([^"]*)"', body)
    if robots and "noindex" in robots.group(1):
        problems.append("meta robots noindex")
    if "noindex" in hdr(h, "x-robots-tag"):
        problems.append("en-tête X-Robots-Tag noindex")
    title = re.search(r"<title>([^<]*)</title>", body)
    if not title or not title.group(1).strip():
        problems.append("titre absent")
    h1 = len(re.findall(r"<h1[\s>]", body))
    if h1 != 1:
        problems.append(f"{h1} balise(s) h1")
    for raw in re.findall(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', body, re.S):
        try:
            json.loads(raw)
        except ValueError:
            problems.append("JSON-LD invalide")
    return problems


def main():
    started = dt.datetime.now().astimezone()
    results, incidents, notes = {}, {}, []

    def flag(key, msg):
        incidents[key] = msg

    s, h, _ = fetch(SITE.replace("https://", "http://") + "/")
    results["http_vers_https"] = {"status": s, "location": hdr(h, "location")}
    if s not in (301, 308) or not hdr(h, "location").startswith(SITE):
        flag("redir:http", f"http → https inattendu ({s} {hdr(h, 'location')})")

    s, h, _ = fetch(SITE.replace("https://", "https://www.") + "/")
    results["www_vers_apex"] = {"status": s, "location": hdr(h, "location")}
    if s not in (301, 308) or not hdr(h, "location").startswith(SITE):
        flag("redir:www", f"www → domaine principal inattendu ({s} {hdr(h, 'location')})")

    s, h, body = fetch(SITE + "/robots.txt")
    results["robots"] = {"status": s, "bytes": len(body)}
    if s != 200:
        flag("robots:status", f"robots.txt statut {s}")
    else:
        groups = re.split(r"(?im)^user-agent:", body)
        if re.search(r"(?im)^disallow:\s*/\s*$", body):
            flag("robots:blocage", "robots.txt contient « Disallow: / » (blocage global)")
        if f"Sitemap: {SITE}/sitemap.xml" not in body:
            flag("robots:sitemap", "ligne Sitemap absente de robots.txt")
        if "Allow: /api/media/" not in body:
            flag("robots:medias", "Allow: /api/media/ absent (images produits non explorables)")
        results["robots"]["groupes"] = len(groups) - 1

    s, h, body = fetch(SITE + "/sitemap.xml")
    locs = re.findall(r"<loc>([^<]+)</loc>", body) if s == 200 else []
    results["sitemap"] = {"status": s, "urls": len(locs)}
    if s != 200 or not locs:
        flag("sitemap:vide", f"sitemap indisponible ou vide (statut {s})")
    prev = sorted((STATE / "daily").glob("*.json"))
    if prev:
        try:
            before = json.loads(prev[-1].read_text())["results"]["sitemap"]["urls"]
            results["sitemap"]["veille"] = before
            if before and len(locs) < before * 0.8:
                flag("sitemap:baisse", f"sitemap : {len(locs)} URL contre {before} au contrôle précédent")
        except (ValueError, KeyError):
            pass
    missing = [p for p in PRIORITY if SITE.rstrip("/") + ("" if p == "/" else p) not in locs]
    if locs and missing:
        flag("sitemap:prioritaires", f"URL prioritaires absentes du sitemap : {', '.join(missing)}")

    s, _, _ = fetch(SITE + "/page-inexistante-controle-seo")
    results["page_404"] = s
    if s != 404:
        flag("404", f"une URL inexistante répond {s} (soft 404)")

    results["pages"] = {}
    for p in PRIORITY:
        s, h, body = fetch(SITE.rstrip("/") + ("/" if p == "/" else p))
        pb = page_checks(p, s, h, body, notes)
        results["pages"][p] = {"status": s, "problemes": pb}
        if pb:
            flag(f"page:{p}", f"{p} : {'; '.join(pb)}")

    # incidents : dédoublonnage par clé
    STATE.mkdir(parents=True, exist_ok=True)
    (STATE / "daily").mkdir(exist_ok=True)
    known_path = STATE / "incidents.json"
    known = json.loads(known_path.read_text()) if known_path.exists() else {}
    today = started.date().isoformat()
    lines = []
    for k, msg in incidents.items():
        if k in known:
            known[k].update(last_seen=today, message=msg, jours=known[k].get("jours", 1) + 1)
            lines.append(f"incident persistant ({known[k]['jours']} contrôles) : {msg}")
        else:
            known[k] = {"first_seen": today, "last_seen": today, "message": msg, "jours": 1}
            lines.append(f"NOUVEL INCIDENT : {msg}")
    for k in [k for k in known if k not in incidents]:
        lines.append(f"RÉSOLU : {known[k]['message']} (ouvert le {known[k]['first_seen']})")
        del known[k]
    known_path.write_text(json.dumps(known, ensure_ascii=False, indent=1))

    out = {"site": SITE, "debut": started.isoformat(), "fin": dt.datetime.now().astimezone().isoformat(),
           "incidents_ouverts": known, "observations": notes, "results": results}
    (STATE / "daily" / f"{today}.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    for f in (STATE / "daily").glob("*.json"):
        try:
            if (started.date() - dt.date.fromisoformat(f.stem)).days > KEEP_DAYS:
                f.unlink()
        except ValueError:
            pass

    ok_pages = sum(1 for v in results["pages"].values() if not v["problemes"])
    print(f"{started:%Y-%m-%d %H:%M} contrôle SEO : sitemap {results['sitemap']['urls']} URL, "
          f"{ok_pages}/{len(PRIORITY)} pages prioritaires conformes, {len(known)} incident(s) ouvert(s)")
    for l in lines:
        print("  " + l)
    for n in notes:
        print("  observation : " + n)
    return 1 if known else 0


if __name__ == "__main__":
    sys.exit(main())
