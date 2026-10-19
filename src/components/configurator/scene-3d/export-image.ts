/**
 * Compose l'image du projet : capture du canvas 3D + bandeau texte dessiné sur un canvas 2D.
 * Aucune dépendance three.js.
 */
import { SCENE_DISCLAIMER } from "@/domain/scene-model";

export const EXPORT_FILENAME = "projet-elios-solar.png";
export const EXPORT_FOOTER = `${SCENE_DISCLAIMER} — ELIOS SOLAR (démonstration)`;

export interface ImageCaption {
  title: string; // nom de la gamme
  dimension: string;
  finish: string;
  extra?: string;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("capture illisible"));
    img.src = src;
  });
}

/** Retourne un dataURL PNG : rendu 3D + bandeau (gamme, dimension, finition, mention indicative). */
export async function composeProjectImage(sceneDataUrl: string, caption: ImageCaption): Promise<string> {
  const img = await loadImage(sceneDataUrl);
  const width = Math.max(640, img.naturalWidth);
  const scale = width / img.naturalWidth;
  const sceneH = Math.round(img.naturalHeight * scale);
  const unit = Math.max(14, Math.round(width / 60));
  const bannerH = Math.round(unit * 5.2);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = sceneH + bannerH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2D indisponible");
  ctx.drawImage(img, 0, 0, width, sceneH);
  ctx.fillStyle = "#1f2123";
  ctx.fillRect(0, sceneH, width, bannerH);
  const pad = unit;
  ctx.fillStyle = "#faf8f4";
  ctx.textBaseline = "top";
  ctx.font = `600 ${Math.round(unit * 1.35)}px system-ui, sans-serif`;
  ctx.fillText(caption.title, pad, sceneH + pad * 0.7, width - pad * 2);
  ctx.font = `${unit}px system-ui, sans-serif`;
  ctx.fillStyle = "#e6dccb";
  const line2 = [caption.dimension, caption.finish, caption.extra].filter(Boolean).join(" · ");
  ctx.fillText(line2, pad, sceneH + pad * 0.7 + unit * 1.75, width - pad * 2);
  ctx.font = `${Math.round(unit * 0.8)}px system-ui, sans-serif`;
  ctx.fillStyle = "#c9bca6";
  ctx.fillText(EXPORT_FOOTER, pad, sceneH + pad * 0.7 + unit * 3.25, width - pad * 2);
  return canvas.toDataURL("image/png");
}

export function downloadDataUrl(dataUrl: string, filename = EXPORT_FILENAME) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
