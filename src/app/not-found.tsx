import type { Metadata } from "next";
import { NotFoundContent } from "@/components/layout/not-found-content";

export const metadata: Metadata = { title: "Page introuvable", robots: { index: false, follow: true } };

/** 404 hors boutique (URL inconnue) : statut 404. */
export default function NotFound() {
  return <NotFoundContent />;
}
