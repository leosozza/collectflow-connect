/**
 * Renders a document template by replacing placeholders with real data.
 * Returns both text and HTML versions plus metadata.
 */

import { markdownToHtml } from "@/lib/markdownLight";

export interface RenderResult {
  text: string;
  html: string;
  templateSource: "credor" | "tenant" | "default";
  missingPlaceholders: string[];
}

/**
 * Replace all {placeholder} tokens in a template with values from vars.
 * Collects any placeholders that have no value.
 */
export function renderDocument(
  template: string,
  vars: Record<string, string>,
  source: "credor" | "tenant" | "default"
): RenderResult {
  const missingPlaceholders: string[] = [];

  // Replace known placeholders
  let text = template;
  Object.entries(vars).forEach(([key, value]) => {
    text = text.replace(new RegExp(key.replace(/[{}]/g, "\\$&"), "g"), value);
  });

  // Detect remaining unreplaced placeholders
  const remaining = text.match(/\{[a-z_]+\}/g);
  if (remaining) {
    remaining.forEach((p) => {
      if (!missingPlaceholders.includes(p)) {
        missingPlaceholders.push(p);
      }
    });
  }

  // Generate HTML — markdownToHtml handles basic formatting;
  // {tabela_parcelas} is already replaced with raw HTML by the resolver,
  // so we need to avoid escaping it. We do a two-pass approach:
  // 1. Extract HTML blocks (like tables) before markdown conversion
  // 2. Re-inject them after

  const htmlBlocks: string[] = [];
  let textForMd = text.replace(/<table[\s\S]*?<\/table>/gi, (match) => {
    htmlBlocks.push(match);
    return `<!--HTML_BLOCK_${htmlBlocks.length - 1}-->`;
  });

  let html = markdownToHtml(textForMd, { highlightPlaceholders: false });

  // Re-inject HTML blocks
  htmlBlocks.forEach((block, i) => {
    html = html.replace(`<!--HTML_BLOCK_${i}-->`, block);
  });

  return { text, html, templateSource: source, missingPlaceholders };
}
