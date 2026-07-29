// Shared pure utilities. Import from here — never reimplement inline.

/**
 * Converts an arbitrary string into a URL-safe slug.
 * Lowercase, hyphens only, max 70 chars.
 */
export function slugify(s: string, maxLen = 70): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLen);
}

/**
 * Strips "Blog: " / "Page: " prefixes from draft titles to get the raw topic.
 */
export function stripDraftPrefix(title: string): string {
  return title.replace(/^(Blog|Page|Blog post|New page):\s*/i, "").trim();
}

/**
 * Pull "TITLE TAG:" and "META:" header lines off the top of agent content.
 * Returns { title, meta, body } with the header lines removed from body.
 */
export function splitFrontMatter(
  body: string,
  fallbackTitle: string
): { title: string; meta: string; body: string } {
  let title = stripDraftPrefix(fallbackTitle);
  let meta = "";
  const kept: string[] = [];
  for (const line of body.split("\n")) {
    const t = line.match(/^\s*TITLE TAG:\s*(.+)$/i);
    const m = line.match(/^\s*META:\s*(.+)$/i);
    if (t) { title = t[1].trim(); continue; }
    if (m) { meta = m[1].trim(); continue; }
    kept.push(line);
  }
  return { title, meta, body: kept.join("\n").trim() };
}
