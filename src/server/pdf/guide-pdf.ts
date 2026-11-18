/**
 * PDF d'un guide d'accompagnement (texte : sommaire, étapes avec la page de la notice, avertissements). Les visuels
 * restent dans la version web. Le PDF porte la mention « guide d'accompagnement, pas une notice officielle ».
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { BRAND } from "@/config/brand";
import type { InstallGuide } from "@/server/content/install-guides";

/** Caractères hors WinAnsi (polices standard) remplacés. */
const clean = (s: string) => s.replace(/[  ]/g, " ").replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/→/g, "->").replace(/[^\x00-\xff‘’“”–—…•€]/g, "");

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const w of clean(text).split(/\s+/)) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && font.widthOfTextAtSize(next, size) > width) { out.push(cur); cur = w; } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

export async function buildGuidePdf(guide: InstallGuide, status: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(clean(guide.title));
  pdf.setAuthor(BRAND.name);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595, H = 842, M = 50, TW = W - 2 * M;
  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;
  const ink = rgb(0.1, 0.13, 0.11), green = rgb(0.27, 0.4, 0.3), grey = rgb(0.36, 0.37, 0.39), warn = rgb(0.6, 0.42, 0);
  const ensure = (h: number) => { if (y - h < M) { page = pdf.addPage([W, H]); y = H - M; } };
  const para = (text: string, o: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb>; indent?: number; gap?: number } = {}) => {
    const size = o.size ?? 10, f = o.f ?? font, indent = o.indent ?? 0;
    for (const line of wrap(text, f, size, TW - indent)) { ensure(size + 4); page.drawText(line, { x: M + indent, y: y - size, size, font: f, color: o.color ?? ink }); y -= size + 4; }
    y -= o.gap ?? 4;
  };
  para(BRAND.name, { size: 11, f: bold, color: green, gap: 2 });
  para(guide.title, { size: 18, f: bold, gap: 6 });
  para(`Guide d'accompagnement HELIOSTORES, pas une notice officielle. Statut : ${status}. La notice officielle du fabricant fait foi : elle est remise avec le produit et doit être lue en entier avant toute intervention.`, { size: 9, color: grey, gap: 10 });
  para("Sommaire", { size: 12, f: bold });
  guide.sections.forEach((s, i) => para(`${i + 1}. ${s.title}`, { indent: 10, gap: 0 }));
  para(`${guide.sections.length + 1}. Notices officielles`, { indent: 10, gap: 12 });
  guide.sections.forEach((s, i) => {
    ensure(40);
    para(`${i + 1}. ${s.title}`, { size: 13, f: bold, color: green, gap: 4 });
    if (s.intro) para(s.intro);
    s.steps?.forEach((st, k) => para(`${k + 1}) ${st.text} (notice, ${st.page})`, { indent: 10 }));
    s.items?.forEach((it) => para(`• ${it}`, { indent: 10 }));
    s.warnings?.forEach((w) => para(`AVERTISSEMENT — ${w.text} (${w.page})`, { indent: 10, color: warn }));
    if (s.media?.length) para("Illustrations : voir la version en ligne.", { size: 8, color: grey });
    y -= 6;
  });
  para(`${guide.sections.length + 1}. Notices officielles`, { size: 13, f: bold, color: green });
  guide.officialDocs.forEach((d) => para(`• ${d.title}${d.pages ? ` (${d.pages})` : ""}${d.note ? ` — ${d.note}` : ""}`, { indent: 10 }));
  para("Remises avec le produit ; disponibles sur demande auprès d'un conseiller.", { color: grey });
  return pdf.save();
}
