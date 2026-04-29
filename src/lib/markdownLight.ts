/**
 * Lightweight markdown-to-HTML converter for document templates.
 * Supports: **bold**, *italic*, ## headings, - lists, --- rules, paragraphs.
 * Highlights {placeholder} tokens with a colored span.
 */

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const inlineFormat = (line: string, highlightPlaceholders: boolean): string => {
  let out = escapeHtml(line);
  // bold
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // italic
  out = out.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // placeholders
  if (highlightPlaceholders) {
    out = out.replace(
      /\{([^}]+)\}/g,
      '<span class="mdl-placeholder">$&</span>'
    );
  }
  return out;
};

export function markdownToHtml(
  text: string,
  { highlightPlaceholders = false }: { highlightPlaceholders?: boolean } = {}
): string {
  const lines = text.split("\n");
  const html: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    // horizontal rule
    if (/^-{3,}$/.test(line.trim())) {
      closeList();
      html.push("<hr />");
      continue;
    }

    // headings
    const hMatch = line.match(/^(#{2,3})\s+(.+)/);
    if (hMatch) {
      closeList();
      const tag = hMatch[1].length === 2 ? "h2" : "h3";
      html.push(`<${tag}>${inlineFormat(hMatch[2], highlightPlaceholders)}</${tag}>`);
      continue;
    }

    // list item
    if (/^\s*[-•]\s+/.test(line)) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      const content = line.replace(/^\s*[-•]\s+/, "");
      html.push(`<li>${inlineFormat(content, highlightPlaceholders)}</li>`);
      continue;
    }

    // empty line → close list / add spacing
    if (line.trim() === "") {
      closeList();
      html.push('<div class="mdl-spacer"></div>');
      continue;
    }

    // regular paragraph
    closeList();
    html.push(`<p>${inlineFormat(line, highlightPlaceholders)}</p>`);
  }

  closeList();
  return html.join("\n");
}

/**
 * Reverse of `markdownToHtml` — converts contentEditable HTML back to the
 * lightweight markdown format we store. Preserves {placeholder} tokens.
 */
export function htmlToMarkdownLight(html: string): string {
  if (!html) return "";
  let h = html.replace(/<br\s*\/?>/gi, "\n");

  // Unwrap variable chips
  h = h.replace(/<span[^>]*rivo-var-chip[^>]*>([\s\S]*?)<\/span>/gi, "$1");
  h = h.replace(/<span[^>]*mdl-placeholder[^>]*>([\s\S]*?)<\/span>/gi, "$1");

  // Spacers
  h = h.replace(/<div[^>]*mdl-spacer[^>]*>\s*<\/div>/gi, "\n");

  // Block elements → markdown
  h = h.replace(/<hr[^>]*\/?>/gi, "\n---\n");
  h = h.replace(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi, (_m, inner) => `\n## ${stripTags(inner).trim()}\n`);
  h = h.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_m, inner) => `\n### ${stripTags(inner).trim()}\n`);

  h = h.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_m, inner) => {
    const items = [...String(inner).matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((mm) => `- ${inlineToMd(mm[1]).trim()}`)
      .join("\n");
    return `\n${items}\n`;
  });
  h = h.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_m, inner) => {
    const items = [...String(inner).matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((mm, i) => `${i + 1}. ${inlineToMd(mm[1]).trim()}`)
      .join("\n");
    return `\n${items}\n`;
  });

  h = h.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_m, inner) => `\n${inlineToMd(inner)}\n`);
  h = h.replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, (_m, inner) => `\n${inlineToMd(inner)}\n`);

  h = inlineToMd(h);

  h = h
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  h = stripTags(h);
  h = h.replace(/\n{3,}/g, "\n\n").trim();
  return h;
}

function inlineToMd(s: string): string {
  return s
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**")
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*")
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "*$1*");
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}
