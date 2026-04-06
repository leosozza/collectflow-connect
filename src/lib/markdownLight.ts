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
