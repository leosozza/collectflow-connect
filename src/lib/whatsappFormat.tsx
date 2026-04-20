import React from "react";

/**
 * WhatsApp-style text formatter.
 * Supports: *bold*, _italic_, ~strike~, `code`, ```block```, > quote, URLs, \n.
 *
 * Rules:
 * - Inline markers require word-like boundaries to avoid matching mid-word.
 * - Unmatched markers render as literal text.
 * - Code blocks (``` and `) are processed first; their content is not re-parsed.
 * - Returns React.ReactNode[] safe to render inside a <p>/<span>.
 */

let __key = 0;
const k = () => `wf-${++__key}`;

const URL_RE = /(https?:\/\/[^\s<>()]+[^\s<>().,!?;:'"])|(www\.[^\s<>()]+[^\s<>().,!?;:'"])/gi;

function renderUrls(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  text.replace(URL_RE, (match, _g1, _g2, offset: number) => {
    if (offset > last) out.push(text.slice(last, offset));
    const href = match.startsWith("http") ? match : `https://${match}`;
    out.push(
      <a
        key={k()}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline text-[#027eb5] dark:text-[#53bdeb] break-all"
        onClick={(e) => e.stopPropagation()}
      >
        {match}
      </a>
    );
    last = offset + match.length;
    return match;
  });
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Marker = { char: "*" | "_" | "~"; tag: "strong" | "em" | "s"; cls: string };
const MARKERS: Marker[] = [
  { char: "*", tag: "strong", cls: "font-semibold" },
  { char: "_", tag: "em", cls: "italic" },
  { char: "~", tag: "s", cls: "line-through opacity-80" },
];

function isBoundaryBefore(prev: string | undefined): boolean {
  if (prev === undefined) return true;
  // Anything that isn't a letter/digit/underscore counts as a boundary (includes emojis/symbols)
  return !/[\p{L}\p{N}_]/u.test(prev);
}
function isBoundaryAfter(next: string | undefined): boolean {
  if (next === undefined) return true;
  return !/[\p{L}\p{N}_]/u.test(next);
}

function parseInline(text: string): React.ReactNode[] {
  // Find earliest valid marker pair; recurse into inner and tail.
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const marker = MARKERS.find((m) => m.char === ch);
    if (!marker) continue;
    if (!isBoundaryBefore(text[i - 1])) continue;
    // find closing
    for (let j = i + 1; j < text.length; j++) {
      if (text[j] === "\n") break;
      if (text[j] !== marker.char) continue;
      // closing must have boundary after and non-space inner
      if (!isBoundaryAfter(text[j + 1])) continue;
      const inner = text.slice(i + 1, j);
      if (!inner || /^\s|\s$/.test(inner)) continue;
      const before = text.slice(0, i);
      const after = text.slice(j + 1);
      const Tag = marker.tag as any;
      return [
        ...parseInline(before),
        <Tag key={k()} className={marker.cls}>
          {parseInline(inner)}
        </Tag>,
        ...parseInline(after),
      ];
    }
  }
  // No markers — render URLs.
  return renderUrls(text);
}

function renderInlineCode(text: string): React.ReactNode[] {
  // Handle single-backtick inline code first (no nesting inside).
  const parts: React.ReactNode[] = [];
  let buf = "";
  let i = 0;
  while (i < text.length) {
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end > i + 1) {
        if (buf) {
          parts.push(...parseInline(buf));
          buf = "";
        }
        parts.push(
          <code
            key={k()}
            className="font-mono text-[13px] bg-black/5 dark:bg-white/10 px-1 rounded"
          >
            {text.slice(i + 1, end)}
          </code>
        );
        i = end + 1;
        continue;
      }
    }
    buf += text[i];
    i++;
  }
  if (buf) parts.push(...parseInline(buf));
  return parts;
}

function renderLine(line: string): React.ReactNode[] {
  // Blockquote: > at line start
  const quoted = line.match(/^>\s?(.*)$/);
  if (quoted) {
    return [
      <span
        key={k()}
        className="block border-l-[3px] border-current/40 pl-2 opacity-85 my-0.5"
      >
        {renderInlineCode(quoted[1])}
      </span>,
    ];
  }
  return renderInlineCode(line);
}

export function formatWhatsAppText(text: string | null | undefined): React.ReactNode[] {
  if (!text) return [];
  const out: React.ReactNode[] = [];

  // Split out fenced code blocks ```...```
  const fenceRe = /```([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(text)) !== null) {
    if (m.index > last) {
      out.push(...renderTextSegment(text.slice(last, m.index)));
    }
    out.push(
      <code
        key={k()}
        className="block font-mono text-[13px] bg-black/5 dark:bg-white/10 px-2 py-1 rounded my-1 whitespace-pre-wrap break-words"
      >
        {m[1].replace(/^\n|\n$/g, "")}
      </code>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(...renderTextSegment(text.slice(last)));
  return out;
}

function renderTextSegment(segment: string): React.ReactNode[] {
  const lines = segment.split("\n");
  const out: React.ReactNode[] = [];
  lines.forEach((line, idx) => {
    out.push(...renderLine(line));
    if (idx < lines.length - 1) out.push(<br key={k()} />);
  });
  return out;
}

/** Strip WhatsApp markers for compact previews (conversation list). */
export function stripWhatsAppMarkers(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/```([\s\S]*?)```/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/(^|[^\p{L}\p{N}_])\*([^*\n]+?)\*(?=$|[^\p{L}\p{N}_])/gu, "$1$2")
    .replace(/(^|[^\p{L}\p{N}_])_([^_\n]+?)_(?=$|[^\p{L}\p{N}_])/gu, "$1$2")
    .replace(/(^|[^\p{L}\p{N}_])~([^~\n]+?)~(?=$|[^\p{L}\p{N}_])/gu, "$1$2")
    .replace(/^>\s?/gm, "");
}
