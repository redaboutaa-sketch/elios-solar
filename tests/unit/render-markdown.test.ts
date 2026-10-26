import { describe, expect, it } from "vitest";
import { renderMarkdown } from "@/server/content/render";

describe("rendu Markdown des pages de contenu", () => {
  it("liens internes, mailto:, tel: et https ; aucun autre schéma ni HTML brut", () => {
    const html = renderMarkdown("[Contact](/contact) [Écrire](mailto:{{email}}) [Appeler](tel:{{tel}}) [CNIL](https://www.cnil.fr) [x](javascript:alert(1)) <b>gras</b>", { email: "a_b@example.test", tel: "+33100000000" });
    expect(html).toContain('<a href="/contact">Contact</a>');
    expect(html).toContain('<a href="mailto:a_b@example.test">Écrire</a>');
    expect(html).toContain('<a href="tel:+33100000000">Appeler</a>');
    expect(html).toContain('<a href="https://www.cnil.fr" rel="noopener noreferrer">CNIL</a>');
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain("<b>");
  });

  it("variable absente signalée, jamais remplacée par une valeur inventée", () => {
    expect(renderMarkdown("SIRET {{siret}}", {})).toContain("[siret à renseigner]");
  });
});
