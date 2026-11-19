"""Niveau A de /audit-tarifs : référence PDF indépendante → base (grilles de vente actives et leur base catalogue).

Lecture seule. Valeur attendue calculée ICI depuis la référence PDF et la politique décidée (manifeste), jamais lue
dans la base ni calculée par l'application :
  vente HT (centimes) = arrondi au centime de catalogue × (1 − remise) ÷ (1 − marge)
Contrôles : cellule absente, cellule en trop, doublon, unité/axe, catalogue de base ≠ PDF, vente ≠ politique,
paramètres de politique, TVA, arrondi commercial et règle de lecture des grilles actives.

Usage : python3 -I compare_db.py <reference.json> <sortie-dir> --source prod|recette [--db recette_xxx]
"""
import argparse, json, pathlib, subprocess, sys
from decimal import Decimal, ROUND_HALF_UP

SQL_ROWS = """
SELECT coalesce(json_agg(x), '[]') FROM (
  SELECT l.id AS list, l."familySlug" AS family, l."variantKey" AS variant, l."amountRole" AS role, l.status::text AS status,
         l."saleRounding" AS rounding, l."vatRateBps" AS vat, l."dimRule"::text AS "dimRule", l."dimRuleNote" <> '' AS "dimRuleNoted",
         l.version, r.id, r.kind, r.code, r."dimAmm" AS dim, r."widthMinMm" AS wmin, r."widthMaxMm" AS wmax,
         r."amountMinor" AS amount, r.conditions AS cond
  FROM "SupplierPriceRow" r JOIN "SupplierPriceList" l ON l.id = r."listId"
  WHERE l.scope = 'GRID' AND l.status = 'ACTIVE') x;
"""
SQL_BASE = """
SELECT coalesce(json_agg(json_build_object('list', r."listId", 'kind', r.kind, 'amount', r."amountMinor", 'dim', r."dimAmm", 'wmin', r."widthMinMm", 'wmax', r."widthMaxMm", 'code', r.code)), '[]')
FROM "SupplierPriceRow" r WHERE r."listId" IN (SELECT DISTINCT r2.conditions->'derive'->>'baseId' FROM "SupplierPriceRow" r2 JOIN "SupplierPriceList" l ON l.id = r2."listId" WHERE l.scope = 'GRID' AND l.status = 'ACTIVE');
"""


def psql(args, sql):
    if args.source == "prod":
        cmd = ["docker", "exec", "-i", "-e", "PGOPTIONS=-c default_transaction_read_only=on", "heliostores-prod-postgres", "sh", "-c", 'psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At']
    else:
        if not args.db or not args.db.startswith("recette_"):
            sys.exit("--db recette_<id> requis pour --source recette")
        cmd = ["docker", "exec", "-i", "-e", "PGOPTIONS=-c default_transaction_read_only=on", "elios-solar-dev-postgres", "sh", "-c", f'psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d {args.db} -At']
    out = subprocess.run(cmd, input=sql, capture_output=True, text=True, check=True).stdout.strip()
    return json.loads(out or "null")


def sale_cents(cat_eur, policy):
    v = Decimal(cat_eur) * 100 * (Decimal(10000 - policy["discountBps"]) / Decimal(10000 - policy["marginBps"]))
    return int(v.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("reference"); ap.add_argument("out"); ap.add_argument("--source", choices=["prod", "recette"], required=True); ap.add_argument("--db")
    args = ap.parse_args()
    ref = json.loads(pathlib.Path(args.reference).read_text(encoding="utf-8"))
    policy = ref["policy"]
    rows = psql(args, SQL_ROWS)
    # base catalogue d'une cellule de vente : même cote dans la version de base indiquée par la dérivation (`derive.baseId`)
    base = {(b["list"], b["kind"], b["dim"], b["wmin"], b["wmax"], b["code"]): b for b in psql(args, SQL_BASE)}
    ecarts, checked, lists = [], 0, {}
    for r in rows:
        lists.setdefault(r["list"], r)
    # 1. paramètres des grilles actives vendues
    for l in lists.values():
        if l["role"] != "VENTE":
            ecarts.append({"niveau": "A", "type": "grille active hors politique de vente", "famille": l["family"], "variante": l["variant"], "detail": f"rôle {l['role']} (grille de démonstration ou ancienne : à confirmer hors périmètre vendu)", "gravite": "info"})
            continue
        if l["rounding"] != "NEAREST_99_TTC":
            ecarts.append({"niveau": "A", "type": "arrondi commercial", "famille": l["family"], "variante": l["variant"], "detail": l["rounding"], "gravite": "bloquant"})
        if l["vat"] not in (None, policy["vatBps"]):
            ecarts.append({"niveau": "A", "type": "TVA", "famille": l["family"], "variante": l["variant"], "detail": l["vat"], "gravite": "bloquant"})
        if l["dimRule"] == "ROUND_UP" and not l["dimRuleNoted"]:
            ecarts.append({"niveau": "A", "type": "règle « tranche supérieure » sans justification", "famille": l["family"], "variante": l["variant"], "gravite": "majeur"})
    sold = [r for r in rows if r["role"] == "VENTE" and r["kind"] == "GRID"]
    pol_seen = {json.dumps((r["cond"] or {}).get("derive", {}).get("policy"), sort_keys=True) for r in sold}
    for p in pol_seen:
        pp = json.loads(p) if p != "null" else None
        if not pp or pp.get("discountBps") != policy["discountBps"] or pp.get("marginBps") != policy["marginBps"]:
            ecarts.append({"niveau": "A", "type": "politique de dérivation", "detail": pp, "attendu": {k: policy[k] for k in ("discountBps", "marginBps")}, "gravite": "bloquant"})
    # 2. cellules : référence → base
    index = {}
    for r in sold:
        index.setdefault((r["family"], r["variant"], r["dim"], r["wmax"]), []).append(r)
    used = set()
    for g in ref["grids"]:
        if g.get("sold") is False:
            continue
        for c in g["cells"]:
            if c["catalogueEur"] is None:
                continue
            checked += 1
            key = (g["familySlug"], g["variantKey"], c["dimMm"], c["widthMaxMm"])
            found = index.get(key, [])
            loc = f"p. {g['pageIndex']} (imprimée {g['pagePrinted']}) — {g['system']} {g.get('module', '')}, ligne {c['dim']}, colonne {c['widthLabel']}"
            if not found:
                ecarts.append({"niveau": "A", "type": "cellule PDF absente de la base", "famille": g["familySlug"], "variante": g["variantKey"], "dimMm": c["dimMm"], "largeurMaxMm": c["widthMaxMm"], "source": loc, "gravite": "majeur"})
                continue
            if len(found) > 1:
                ecarts.append({"niveau": "A", "type": "doublon en base", "famille": g["familySlug"], "variante": g["variantKey"], "dimMm": c["dimMm"], "largeurMaxMm": c["widthMaxMm"], "nombre": len(found), "gravite": "majeur"})
            r = found[0]
            used.add(r["id"])
            if r["wmin"] != c["widthMinMm"]:
                ecarts.append({"niveau": "A", "type": "largeur minimale de cellule", "famille": g["familySlug"], "variante": g["variantKey"], "dimMm": c["dimMm"], "largeurMaxMm": c["widthMaxMm"], "base": r["wmin"], "pdf": c["widthMinMm"], "source": loc, "gravite": "à vérifier"})
            b = base.get((((r["cond"] or {}).get("derive") or {}).get("baseId"), r["kind"], r["dim"], r["wmin"], r["wmax"], r["code"]))
            if b is None:
                ecarts.append({"niveau": "A", "type": "cellule de vente sans base catalogue traçable", "famille": g["familySlug"], "variante": g["variantKey"], "dimMm": c["dimMm"], "largeurMaxMm": c["widthMaxMm"], "gravite": "majeur"})
            elif b["amount"] != c["catalogueEur"] * 100:
                ecarts.append({"niveau": "A", "type": "catalogue de base ≠ PDF", "famille": g["familySlug"], "variante": g["variantKey"], "dimMm": c["dimMm"], "largeurMaxMm": c["widthMaxMm"], "base": b["amount"], "pdf": c["catalogueEur"] * 100, "source": loc, "gravite": "bloquant"})
            exp = sale_cents(c["catalogueEur"], policy)
            if r["amount"] != exp:
                ecarts.append({"niveau": "A", "type": "vente ≠ politique appliquée au PDF", "famille": g["familySlug"], "variante": g["variantKey"], "dimMm": c["dimMm"], "largeurMaxMm": c["widthMaxMm"], "base": r["amount"], "attendu": exp, "source": loc, "gravite": "bloquant"})
    ref_families = {(g["familySlug"], g["variantKey"]) for g in ref["grids"] if g.get("sold") is not False}
    for r in sold:
        if r["id"] in used:
            continue
        if (r["family"], r["variant"]) in ref_families:
            ecarts.append({"niveau": "A", "type": "cellule en base sans cellule PDF correspondante", "famille": r["family"], "variante": r["variant"], "dimMm": r["dim"], "largeurMinMm": r["wmin"], "largeurMaxMm": r["wmax"], "gravite": "majeur"})
        else:
            ecarts.append({"niveau": "A", "type": "grille vendue hors référence PDF", "famille": r["family"], "variante": r["variant"], "dimMm": r["dim"], "gravite": "à vérifier"})
    out = pathlib.Path(args.out); out.mkdir(parents=True, exist_ok=True)
    res = {"source": args.source, "db": args.db, "cellulesComparees": checked, "lignesVenteActives": len(sold), "listesActives": len(lists), "ecarts": ecarts}
    (out / f"ecarts-A-{args.source}.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    by = {}
    for e in ecarts:
        by[(e["type"], e.get("gravite"))] = by.get((e["type"], e.get("gravite")), 0) + 1
    print(json.dumps({"source": args.source, "cellulesComparees": checked, "lignesVenteActives": len(sold), "ecarts": len(ecarts)}, ensure_ascii=False))
    for (t, gr), n in sorted(by.items()):
        print(f"  {n:4d}  [{gr}] {t}")
    return 1 if any(e.get("gravite") == "bloquant" for e in ecarts) else 0


if __name__ == "__main__":
    sys.exit(main())
