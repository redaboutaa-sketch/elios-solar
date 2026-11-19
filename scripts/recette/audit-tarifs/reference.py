"""Référence tarifaire INDÉPENDANTE extraite du PDF fournisseur (niveau A de /audit-tarifs).

N'utilise ni le moteur de l'application, ni son import (scripts/import-*.ts, private/.../extract.py), ni la base :
- empreinte du PDF vérifiée contre le manifeste ;
- texte de chaque page extrait à nouveau du PDF (pdfplumber, mise en page conservée) ;
- chaque grille est localisée par son ancre et son en-tête, puis lue ligne par ligne contre la structure ATTENDUE
  (axes du manifeste, issus de la lecture visuelle et des données techniques) ; toute divergence est une anomalie,
  jamais corrigée silencieusement.

Usage : private/recette/.venv/bin/python -I scripts/recette/audit-tarifs/reference.py <dossier-de-sortie>
Sortie (PRIVÉE, contient des montants) : reference.json + reference-anomalies.json dans le dossier indiqué.
"""
import hashlib, json, pathlib, re, sys, datetime

import pdfplumber

ROOT = pathlib.Path(__file__).resolve().parents[3]
MANIFEST = json.loads((pathlib.Path(__file__).parent / "manifest.json").read_text(encoding="utf-8"))
NUM = re.compile(r"(?<![\d,])(\d{1,2} \d{3}|\d+)(?![\d,])")


def norm(s):
    return re.sub(r"\s+", " ", s).strip()


def numbers(s):
    """Nombres d'un fragment de ligne : « 1 020 » = 1020 (groupe des milliers de 1–2 chiffres seulement)."""
    return [int(m.replace(" ", "")) for m in NUM.findall(s)]


def strip_margin(vals, n):
    """Bandeau vertical du bord de page : petits nombres isolés (< 100) en tête ou en trop en fin de ligne."""
    while vals and vals[0] < 100:
        vals = vals[1:]
    while len(vals) > n and vals[-1] < 100:
        vals = vals[:-1]
    return vals


def find_anchor(lines, anchor, start=0):
    a = norm(anchor)
    for i in range(start, len(lines)):
        if a in norm(lines[i]):
            return i
    return None


def parse_matrix(g, lines, anomalies, uncertainties):
    scale = 10 if g["unit"] == "cm" else 1
    i = find_anchor(lines, g["anchor"])
    if i is None:
        anomalies.append({"grid": g["id"], "type": "ancre introuvable", "detail": g["anchor"]})
        return []
    widths = g["widths"]
    header_idx, seen = None, 0
    for j in range(i, len(lines)):
        v = numbers(lines[j])
        k = next((s for s in range(len(v) - len(widths) + 1) if v[s:s + len(widths)] == widths), None)
        if k is not None:
            seen += 1
            if seen == g["occurrence"]:
                header_idx = j
                break
    if header_idx is None:
        anomalies.append({"grid": g["id"], "type": "en-tête de colonnes introuvable", "detail": widths})
        return []
    cells, j = [], header_idx + 1
    for dim in g["dims"]:
        found = None
        while j < len(lines) and j < header_idx + 4 * len(g["dims"]) + 10:
            v = strip_margin(numbers(lines[j]), len(widths) + 1)
            j += 1
            if v and v[0] == dim:
                found = v[1:]
                break
            if v and v[0] in g["dims"] and v[0] != dim:
                anomalies.append({"grid": g["id"], "type": "ligne inattendue (ordre ou ligne manquante)", "detail": {"attendu": dim, "lu": v[0], "ligne": j}})
        if found is None:
            anomalies.append({"grid": g["id"], "type": "ligne manquante", "detail": {"dim": dim}})
            continue
        found = strip_margin([dim] + found, len(widths) + 1)[1:]
        if len(found) != len(widths):
            anomalies.append({"grid": g["id"], "type": "nombre de colonnes", "detail": {"dim": dim, "attendu": len(widths), "lu": len(found), "texte": norm(lines[j - 1])[:160]}})
        for c, w in enumerate(widths):
            val = found[c] if c < len(found) else None
            cells.append({"dim": dim, "dimMm": dim * scale, "widthLabel": w, "widthMinMm": w * scale, "widthMaxMm": w * scale, "catalogueEur": val, "pdfLine": j})
    # croissance plausible : une valeur qui décroît le long d'une ligne ou d'une colonne est signalée (pas corrigée)
    by = {(c["dim"], c["widthLabel"]): c["catalogueEur"] for c in cells}
    for d in g["dims"]:
        row = [by.get((d, w)) for w in widths]
        if all(x is not None for x in row) and any(b < a for a, b in zip(row, row[1:])):
            anomalies.append({"grid": g["id"], "type": "ligne non croissante (à contrôler visuellement)", "detail": {"dim": d}})
    return cells


def parse_awning(g, lines, anomalies, uncertainties):
    scale = 10
    i = find_anchor(lines, g["anchor"])
    if i is None:
        anomalies.append({"grid": g["id"], "type": "ancre introuvable", "detail": g["anchor"]})
        return []
    cols = g["columns"]
    cells, j = [], i + 1
    for dim in g["dims"]:
        found = None
        while j < len(lines) and j < i + 40:
            line = lines[j]
            j += 1
            # projection : nombre de 3 chiffres juste avant « de N cm → » (les libellés de couleur voisins sont altérés)
            m = re.search(r"(?<!\d)(\d{3})\s+de\s+(\d+)\s*cm\s*→(.*)$", line)
            if not m:
                continue
            if int(m.group(1)) != dim:
                if int(m.group(1)) in g["dims"]:
                    anomalies.append({"grid": g["id"], "type": "projection inattendue", "detail": {"attendu": dim, "lu": int(m.group(1))}})
                    j -= 1
                    break
                continue
            found = (int(m.group(2)), strip_margin(numbers(m.group(3)), len(cols)))
            break
        if found is None:
            anomalies.append({"grid": g["id"], "type": "ligne manquante", "detail": {"dim": dim}})
            continue
        start_w, vals = found
        first = next((k for k, (lo, hi) in enumerate(cols) if lo <= start_w <= hi), None)
        if first is not None and start_w == cols[first][1] and len(vals) == len(cols) - first - 1:
            # largeur minimale de la ligne égale à la borne haute d'une colonne : prix à partir de la colonne suivante
            uncertainties.append({"grid": g["id"], "dim": dim, "detail": f"ligne « de {start_w} cm » : première valeur sous la colonne {cols[first + 1][0]}–{cols[first + 1][1]} ; une largeur de {start_w} cm exactement relève-t-elle de la colonne {cols[first][0]}–{cols[first][1]} (sans prix) ? Lecture retenue : colonne suivante, largeur minimale {start_w} cm."})
        elif first is None or len(vals) != len(cols) - first:
            anomalies.append({"grid": g["id"], "type": "alignement des colonnes", "detail": {"dim": dim, "de": start_w, "valeurs": len(vals), "colonnes": len(cols), "premiere": first}})
        # valeurs alignées à droite (lecture visuelle de la page) : la dernière valeur est la dernière colonne
        for k, val in enumerate(vals):
            c = len(cols) - len(vals) + k
            lo, hi = cols[c]
            cells.append({"dim": dim, "dimMm": dim * scale, "widthLabel": f"{lo}-{hi}", "widthMinMm": start_w * scale if k == 0 else lo * scale, "widthMaxMm": hi * scale, "catalogueEur": val, "rowMinWidthMm": start_w * scale, "pdfLine": j})
    return cells


def main():
    out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "private/recette/audit-tarifs" / datetime.date.today().isoformat()
    out.mkdir(parents=True, exist_ok=True)
    doc = MANIFEST["document"]
    pdf_path = ROOT / doc["file"]
    sha = hashlib.sha256(pdf_path.read_bytes()).hexdigest()
    anomalies, grids, uncertainties = [], [], []
    if sha != doc["sha256"]:
        anomalies.append({"grid": "*", "type": "empreinte du PDF différente du manifeste", "detail": sha})
    with pdfplumber.open(pdf_path) as pdf:
        if len(pdf.pages) != doc["pages"]:
            anomalies.append({"grid": "*", "type": "nombre de pages", "detail": len(pdf.pages)})
        texts = {}
        for g in MANIFEST["grids"]:
            p = g["pageIndex"]
            if p not in texts:
                texts[p] = (pdf.pages[p - 1].extract_text(layout=True) or "").splitlines()
            cells = (parse_matrix if g["kind"] == "matrix" else parse_awning)(g, texts[p], anomalies, uncertainties)
            expected = len(g["dims"]) * len(g["widths"]) if g["kind"] == "matrix" else None
            grids.append({**{k: v for k, v in g.items() if k not in ("dims", "widths", "columns", "anchor", "occurrence")},
                          "pagePrinted": p + 2, "cells": cells, "cellsExpected": expected,
                          "cellsRead": sum(1 for c in cells if c["catalogueEur"] is not None)})
    ref = {"generatedAt": datetime.datetime.now().isoformat(timespec="seconds"), "document": {**doc, "sha256Checked": sha},
           "method": "pdfplumber extract_text(layout=True) + structure attendue du manifeste (indépendant de l'import et du moteur)",
           "policy": MANIFEST["policy"], "uncertainties": uncertainties, "grids": grids, "absent": MANIFEST["absent"]}
    (out / "reference.json").write_text(json.dumps(ref, ensure_ascii=False, indent=1), encoding="utf-8")
    (out / "reference-anomalies.json").write_text(json.dumps(anomalies, ensure_ascii=False, indent=1), encoding="utf-8")
    total = sum(g["cellsRead"] for g in grids)
    print(json.dumps({"grilles": len(grids), "cellules": total, "anomalies": len(anomalies), "incertitudes": len(uncertainties), "sortie": str(out)}, ensure_ascii=False))
    for a in anomalies:
        print("ANOMALIE", json.dumps(a, ensure_ascii=False))
    return 1 if any(a["grid"] == "*" for a in anomalies) else 0


if __name__ == "__main__":
    sys.exit(main())
