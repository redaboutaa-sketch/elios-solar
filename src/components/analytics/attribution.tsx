"use client";
/**
 * Mémorise l'attribution de la première page vue de la session (paramètres de campagne, référent, page d'entrée)
 * dans sessionStorage. Aucun cookie, aucun envoi : la donnée n'est transmise qu'avec une demande envoyée par le visiteur.
 */
import { useEffect } from "react";
import { ATTRIBUTION_STORAGE_KEY, attributionFromLocation, type Attribution } from "@/domain/attribution";

export function AttributionCapture() {
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY)) return;
      window.sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(attributionFromLocation(window.location.href, document.referrer)));
    } catch {
      /* stockage indisponible : aucune attribution */
    }
  }, []);
  return null;
}

/** Attribution de la session à joindre à une demande (null si absente). */
export function readAttribution(): Attribution | null {
  try {
    const raw = window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Attribution) : null;
  } catch {
    return null;
  }
}
