import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { EvaluationResult } from "@/domain/types";
import { formatEur } from "@/domain/money";
import { BRAND } from "@/config/brand";

function clean(s: string): string {
  // pdf-lib (police standard WinAnsi) : remplacer les caractères non supportés
  return s.replace(/[−—–]/g, "-").replace(/[’‘]/g, "'").replace(/[«»]/g, '"').replace(/…/g, "...").replace(/[×]/g, "x").replace(/[  ]/g, " ").replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

export interface PdfVisual {
  kind: "SCENE_3D" | "PLAN_2D";
  bytes: Uint8Array;
  mime: "image/png" | "image/jpeg";
  disclaimer: string;
  represented: string[];
  /** légende (plan 2D) */
  legend?: string;
}

export async function buildConfigurationPdf(opts: {
  title: string;
  result: EvaluationResult;
  reference: string;
  validUntil?: Date | null;
  kind: "configuration" | "devis";
  seller?: { legalName?: string | null; addressLine1?: string | null; postalCode?: string | null; city?: string | null } | null;
  /** visualisation jointe (devis) ; `null` = indisponible (mention explicite) ; `undefined` = section absente */
  visual?: PdfVisual | null;
  /** lignes d'information supplémentaires sous l'en-tête (statut, montant proposé…) */
  info?: string[];
}): Promise<Uint8Array> {
  const { result } = opts;
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595.28, 841.89]);
  let y = 800;
  const text = (s: string, x: number, size = 10, f = font, color = rgb(0.12, 0.13, 0.14)) => { page.drawText(clean(s), { x, y, size, font: f, color }); };
  const line = (h = 14) => { y -= h; if (y < 60) { page = pdf.addPage([595.28, 841.89]); y = 800; } };
  const demo = result.containsDemoData;
  if (demo) { page.drawRectangle({ x: 40, y: y - 6, width: 515, height: 22, color: rgb(1, 0.95, 0.8) }); text("DEMONSTRATION - preproduction : ce document n'a aucune valeur contractuelle.", 48, 10, bold, rgb(0.6, 0.42, 0)); line(30); }
  text(BRAND.name, 40, 20, bold); text(opts.kind === "devis" ? "Devis" : "Configuration", 400, 14, bold); line(18);
  text(opts.seller?.legalName ? `${opts.seller.legalName} - ${opts.seller.addressLine1 ?? ""} ${opts.seller.postalCode ?? ""} ${opts.seller.city ?? ""}` : "Identite du vendeur a renseigner (administration > reglages).", 40, 8, font, rgb(0.4, 0.4, 0.4)); line(14);
  text(`Reference : ${opts.reference}`, 40, 10); text(`Date : ${new Date().toLocaleDateString("fr-FR")}`, 400, 10); line();
  if (opts.validUntil) { text(`Validite : jusqu'au ${opts.validUntil.toLocaleDateString("fr-FR")}`, 40, 10); line(); }
  for (const i of opts.info ?? []) { text(i, 40, 10); line(); }
  text(`Moteur ${result.engineVersion} - catalogue ${result.catalogVersion}`, 40, 8, font, rgb(0.4, 0.4, 0.4)); line(22);
  text(opts.title, 40, 13, bold); line(20);
  if (opts.visual) {
    const v = opts.visual;
    const img = v.mime === "image/png" ? await pdf.embedPng(v.bytes) : await pdf.embedJpg(v.bytes);
    const maxW = 515;
    const maxH = 290;
    const k = Math.min(maxW / img.width, maxH / img.height, 1);
    const w = img.width * k;
    const h = img.height * k;
    if (y - h < 80) { page = pdf.addPage([595.28, 841.89]); y = 800; }
    page.drawImage(img, { x: 40 + (maxW - w) / 2, y: y - h, width: w, height: h });
    y -= h + 12;
    text(v.kind === "SCENE_3D" ? "Visualisation 3D du projet" : "Plan 2D du projet (la vue 3D n'a pas pu etre jointe)", 40, 9, bold); line(12);
    text(v.disclaimer, 40, 8, bold, rgb(0.55, 0.3, 0.05)); line(12);
    if (v.legend) { text(v.legend.slice(0, 160), 40, 7, font, rgb(0.35, 0.35, 0.35)); line(11); }
    if (v.represented.length) {
      text("Elements representes :", 40, 8, bold); line(11);
      for (const r of v.represented) { text(`- ${r}`.slice(0, 120), 46, 7.5); line(10); }
    }
    line(10);
  } else if (opts.visual === null) {
    text("Visualisation : indisponible pour ce devis (capture non transmise ou configuration non representable).", 40, 8, font, rgb(0.4, 0.4, 0.4)); line(18);
  }
  if (result.layout) {
    const l = result.layout;
    text(`Implantation : ${l.mounting === "wall" ? "adossee" : "autoportee"} - ${l.widthMm / 1000} x ${l.lengthMm / 1000} m - ${l.postCount} poteaux (indicatif)`, 40, 10); line();
    for (const side of l.sides) {
      const segs = side.isWall ? "mur" : side.segments.map((s) => `${s.lengthMm / 1000} m`).join(" + ");
      text(`  Cote ${side.key} : ${segs}`, 40, 9); line(12);
    }
    line(6);
  }
  text("Designation", 40, 10, bold); text("Ref.", 330, 10, bold); text("Qte", 430, 10, bold); text("Montant TTC", 470, 10, bold); line(6);
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) }); line(12);
  for (const l of result.lines) {
    text(l.label.slice(0, 60), 40, 9); text((l.sku ?? "").slice(0, 20), 330, 8); text(String(l.qty), 430, 9); text(l.included ? "inclus" : formatEur(l.totalGrossCents), 470, 9); line(13);
  }
  text("Livraison", 40, 9); text(result.totals.shippingGrossCents === null ? "a calculer" : formatEur(result.totals.shippingGrossCents), 470, 9); line(16);
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) }); line(14);
  text(`Total TTC ${result.totals.isFinal ? "" : "(estime)"}`, 40, 12, bold); text(formatEur(result.totals.totalGrossCents), 470, 12, bold); line(14);
  text(`dont TVA ${formatEur(result.totals.taxCents)}`, 40, 9); line(20);
  const notes = result.issues.filter((i) => i.severity !== "info");
  if (notes.length) { text("Points a confirmer :", 40, 10, bold); line(); for (const i of notes) { text(`- ${i.message}`.slice(0, 110), 40, 8); line(11); } }
  line(10);
  text("Ce document n'est ni un plan d'execution ni une validation structurelle. Fixations et raccordement electrique non inclus.", 40, 7, font, rgb(0.4, 0.4, 0.4));
  return pdf.save();
}
