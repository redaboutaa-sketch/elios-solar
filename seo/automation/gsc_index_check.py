#!/usr/bin/env python3
"""Mesure hebdomadaire Search Console (lecture seule) pour heliostores.com.

- inspection d'URL de chaque URL du sitemap public (état d'indexation, dernière exploration, canonique Google) ;
- état du sitemap dans Search Console (dernière soumission, dernière lecture, erreurs) ;
- performances des 28 derniers jours disponibles (total, 25 premières pages et requêtes) ;
- comparaison avec la mesure précédente (URL nouvellement indexées, URL sorties de l'index).

Accès : compte de service Google, scope `webmasters.readonly` (aucune écriture possible). La clé reste hors dépôt
(`SEO_GSC_KEY`, par défaut `/opt/pergola/private/gsc-service-account.json`) ; ni la clé ni le jeton ne sont affichés.
Sortie : `$STATE_DIRECTORY/gsc/AAAA-MM-JJ.json` (26 mesures conservées) et un résumé sur la sortie standard.
Code de sortie : 0 si la mesure est faite, 2 si l'accès est indisponible (le passage hebdomadaire continue).
"""
import collections
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

SITE = os.environ.get("SEO_SITE", "https://heliostores.com")
PROPERTY = os.environ.get("SEO_GSC_PROPERTY", "sc-domain:heliostores.com")
KEY = os.environ.get("SEO_GSC_KEY", "/opt/pergola/private/gsc-service-account.json")
STATE = Path(os.environ.get("STATE_DIRECTORY", "/var/lib/heliostores-seo")) / "gsc"
SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"
UA = "HeliostoresSEOCheck/1.0 (+https://heliostores.com; controle interne)"
KEEP = 26
DELAY_S = 0.5  # quota d'inspection : 2 000 requêtes par jour et par propriété ; ~40 ici


def token():
    import jwt  # python3-jwt (paquet système) + cryptography

    k = json.loads(Path(KEY).read_text())
    now = int(time.time())
    assertion = jwt.encode({"iss": k["client_email"], "scope": SCOPE, "aud": k["token_uri"], "iat": now, "exp": now + 1800},
                           k["private_key"], algorithm="RS256", headers={"kid": k["private_key_id"]})
    data = urllib.parse.urlencode({"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": assertion}).encode()
    return json.load(urllib.request.urlopen(urllib.request.Request(k["token_uri"], data=data), timeout=20))["access_token"]


def api(tok, url, body=None):
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    try:
        return 200, json.load(urllib.request.urlopen(req, timeout=30))
    except urllib.error.HTTPError as e:
        return e.code, {"erreur": e.read().decode("utf-8", "replace")[:300]}
    except Exception as e:  # réseau, délai
        return 0, {"erreur": f"{type(e).__name__}: {e}"}


def main():
    started = dt.datetime.now().astimezone()
    try:
        tok = token()
    except Exception as e:
        print(f"Search Console indisponible ({type(e).__name__}) : mesure d'indexation non faite")
        return 2
    prop = urllib.parse.quote(PROPERTY, safe="")
    base = f"https://www.googleapis.com/webmasters/v3/sites/{prop}"

    req = urllib.request.Request(SITE + "/sitemap.xml", headers={"User-Agent": UA})
    urls = re.findall(r"<loc>([^<]+)</loc>", urllib.request.urlopen(req, timeout=30).read().decode())

    s, sm = api(tok, f"{base}/sitemaps")
    sitemaps = [{k: x.get(k) for k in ("path", "lastSubmitted", "lastDownloaded", "isPending", "errors", "warnings")}
                | {"contents": x.get("contents", [])} for x in sm.get("sitemap", [])] if s == 200 else {"statut": s, **sm}

    end = started.date() - dt.timedelta(days=3)  # données Search Console : 2 à 3 jours de retard
    start = end - dt.timedelta(days=27)
    perf = {"debut": start.isoformat(), "fin": end.isoformat()}
    s, tot = api(tok, f"{base}/searchAnalytics/query", {"startDate": start.isoformat(), "endDate": end.isoformat()})
    perf["total"] = (tot.get("rows") or [{"clicks": 0, "impressions": 0, "ctr": 0, "position": None}])[0] if s == 200 else {"statut": s}
    for dim in ("page", "query"):
        s, r = api(tok, f"{base}/searchAnalytics/query",
                   {"startDate": start.isoformat(), "endDate": end.isoformat(), "dimensions": [dim], "rowLimit": 25})
        perf[dim] = [{"cle": row["keys"][0], "clics": row["clicks"], "impressions": row["impressions"],
                      "position": round(row["position"], 1)} for row in r.get("rows", [])] if s == 200 else {"statut": s}

    pages, counts = {}, collections.Counter()
    for u in urls:
        time.sleep(DELAY_S)
        s, r = api(tok, "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
                   {"inspectionUrl": u, "siteUrl": PROPERTY, "languageCode": "fr-FR"})
        if s != 200:
            pages[u] = {"erreur": s}
            counts[f"erreur {s}"] += 1
            continue
        x = r["inspectionResult"]["indexStatusResult"]
        pages[u] = {"verdict": x.get("verdict"), "etat": x.get("coverageState"), "indexation": x.get("indexingState"),
                    "exploration": x.get("lastCrawlTime"), "robots": x.get("robotsTxtState"),
                    "canonique_google": x.get("googleCanonical"), "canonique_declaree": x.get("userCanonical")}
        counts[x.get("coverageState") or "inconnu"] += 1
    indexed = sorted(u for u, p in pages.items() if p.get("verdict") == "PASS")

    STATE.mkdir(parents=True, exist_ok=True)
    prev_files = sorted(f for f in STATE.glob("*.json") if f.stem != started.date().isoformat())
    diff = None
    if prev_files:
        try:
            prev = json.loads(prev_files[-1].read_text())
            before = set(prev.get("indexees", []))
            diff = {"mesure_precedente": prev_files[-1].stem, "nouvelles": sorted(set(indexed) - before),
                    "sorties": sorted(before - set(indexed))}
        except (ValueError, KeyError):
            pass

    out = {"propriete": PROPERTY, "mesure": started.isoformat(), "source": "API Search Console (lecture seule)",
           "urls_sitemap": len(urls), "indexees": indexed, "etats": dict(counts), "evolution": diff,
           "sitemaps": sitemaps, "performances_28j": perf, "pages": pages}
    (STATE / f"{started.date().isoformat()}.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    for f in sorted(STATE.glob("*.json"))[:-KEEP]:
        f.unlink()

    t = perf["total"]
    print(f"{started:%Y-%m-%d %H:%M} Search Console : {len(indexed)}/{len(urls)} URL du sitemap indexées ; "
          f"28 j ({start} → {end}) : {t.get('clicks', '?')} clic(s), {t.get('impressions', '?')} impression(s)")
    for state, n in counts.most_common():
        print(f"  {n:3d}  {state}")
    if diff:
        print(f"  depuis {diff['mesure_precedente']} : +{len(diff['nouvelles'])} indexée(s), -{len(diff['sorties'])} sortie(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
