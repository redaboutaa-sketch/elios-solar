"use client";
/** Lien interne localisé : même API que next/link ; le chemin reçoit le préfixe de la langue courante (français : inchangé). */
import NextLink from "next/link";
import type { ComponentProps } from "react";
import { localizePath } from "./config";
import { useLocale } from "./client";

export default function Link({ href, ...rest }: ComponentProps<typeof NextLink>) {
  const locale = useLocale();
  const h = typeof href === "string" ? localizePath(href, locale) : href && typeof href === "object" && typeof href.pathname === "string" ? { ...href, pathname: localizePath(href.pathname, locale) } : href;
  return <NextLink href={h} {...rest} />;
}
