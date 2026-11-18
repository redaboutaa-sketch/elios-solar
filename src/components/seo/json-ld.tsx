import { jsonLdString } from "@/server/seo/structured-data";

/** Bloc JSON-LD rendu côté serveur (contenu échappé). */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />;
}
