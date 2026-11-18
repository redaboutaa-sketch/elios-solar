/** Rendu Markdown minimal et sûr (titres, paragraphes, listes, gras, liens internes, mailto:, tel: et https) — pas de HTML brut. */
export function renderMarkdown(md: string, vars: Record<string, string | null | undefined> = {}): string {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
  const inline = (s: string) => esc(s)
    .replace(/\{\{(\w+)\}\}/g, (_, k: string) => (vars[k] ? esc(String(vars[k])) : `<mark class="bg-warning/20">[${k} à renseigner]</mark>`))
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((\/[^)\s]*|mailto:[^)\s]+|tel:\+?\d+)\)/g, '<a href="$2">$1</a>')
    .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');
  const lines = md.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let list = false, para: string[] = [];
  const flush = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
  for (const raw of lines) {
    const l = raw.trim();
    if (l.startsWith("- ")) { flush(); if (!list) { out.push("<ul>"); list = true; } out.push(`<li>${inline(l.slice(2))}</li>`); continue; }
    if (list) { out.push("</ul>"); list = false; }
    if (l.startsWith("## ")) { flush(); out.push(`<h2>${inline(l.slice(3))}</h2>`); continue; }
    if (l.startsWith("### ")) { flush(); out.push(`<h3>${inline(l.slice(4))}</h3>`); continue; }
    if (l === "") { flush(); continue; }
    para.push(l);
  }
  flush(); if (list) out.push("</ul>");
  return out.join("\n");
}
