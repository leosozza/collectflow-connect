import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { Bold, Italic, Heading2, List, Minus } from "lucide-react";
import { markdownToHtml, htmlToMarkdownLight } from "@/lib/markdownLight";
import { wrapDocumentInA4Page, type CredorLayoutInfo } from "@/services/documentLayoutService";

export interface A4LiveEditorHandle {
  /** Insert text at the current caret position inside the editable region. */
  insertAtCaret: (text: string) => void;
  /** Returns the current markdown content. */
  getMarkdown: () => string;
}

interface A4LiveEditorProps {
  initialMarkdown: string;
  title: string;
  credor: CredorLayoutInfo;
  onChange: (markdown: string) => void;
}

/** Wrap {tokens} in styled chips for visual feedback inside contentEditable. */
function tokenizeVariables(html: string): string {
  return html.replace(
    /\{([a-z0-9_]+)\}/gi,
    (m) => `<span class="rivo-var-chip" data-var="${m}" contenteditable="false">${m}</span>`
  );
}

const A4LiveEditor = forwardRef<A4LiveEditorHandle, A4LiveEditorProps>(
  ({ initialMarkdown, title, credor, onChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const editableRef = useRef<HTMLDivElement | null>(null);
    const initializedKeyRef = useRef<string>("");

    // Build the A4 wrapper HTML once per render of static parts (title/credor).
    // The editable region is injected via bodyOverrideHtml as a sentinel we replace.
    const SENTINEL = "<!--RIVO_EDITABLE_SLOT-->";

    useEffect(() => {
      if (!containerRef.current) return;
      const wrapped = wrapDocumentInA4Page(
        { bodyHtml: "", title, credor },
        { bodyOverrideHtml: SENTINEL }
      );
      containerRef.current.innerHTML = wrapped;

      // Replace sentinel inside <main> with an editable div
      const main = containerRef.current.querySelector("main");
      if (main) {
        const html = main.innerHTML;
        main.innerHTML = html.replace(
          SENTINEL,
          '<div data-rivo-editable="1" contenteditable="true" style="outline:none;min-height:140mm;"></div>'
        );
        const editable = main.querySelector<HTMLDivElement>('[data-rivo-editable="1"]');
        if (editable) {
          editableRef.current = editable;
          // Initialize content only when a new template opens (key changes).
          const newKey = `${title}::${initialMarkdown.length}`;
          if (initializedKeyRef.current !== newKey) {
            const baseHtml = markdownToHtml(initialMarkdown, { highlightPlaceholders: false });
            editable.innerHTML = tokenizeVariables(baseHtml);
            initializedKeyRef.current = newKey;
          }

          editable.oninput = () => {
            const md = htmlToMarkdownLight(editable.innerHTML);
            onChange(md);
          };
        }
      }
      // We intentionally rebuild the wrapper when title/credor change
      // (logo, footer, etc.). Re-init only resets innerHTML when the template
      // identity changes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [title, JSON.stringify(credor)]);

    useImperativeHandle(ref, () => ({
      insertAtCaret(text: string) {
        const el = editableRef.current;
        if (!el) return;
        el.focus();
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) {
          // Append at end if no selection inside editor
          el.innerHTML += tokenizeVariables(text);
        } else {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          const wrapper = document.createElement("span");
          wrapper.innerHTML = tokenizeVariables(text);
          const frag = document.createDocumentFragment();
          while (wrapper.firstChild) frag.appendChild(wrapper.firstChild);
          range.insertNode(frag);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
        const md = htmlToMarkdownLight(el.innerHTML);
        onChange(md);
      },
      getMarkdown() {
        return editableRef.current ? htmlToMarkdownLight(editableRef.current.innerHTML) : "";
      },
    }));

    const exec = (cmd: string, value?: string) => {
      const el = editableRef.current;
      if (!el) return;
      el.focus();
      document.execCommand(cmd, false, value);
      onChange(htmlToMarkdownLight(el.innerHTML));
    };

    const insertHr = () => {
      const el = editableRef.current;
      if (!el) return;
      el.focus();
      document.execCommand("insertHTML", false, "<hr/>");
      onChange(htmlToMarkdownLight(el.innerHTML));
    };

    const insertList = () => exec("insertUnorderedList");
    const insertHeading = () => exec("formatBlock", "h2");

    return (
      <div className="space-y-2">
        {/* Mini toolbar */}
        <div className="flex items-center gap-1 p-1 rounded-md border border-border bg-muted/40">
          <ToolbarBtn label="Negrito (Ctrl+B)" onClick={() => exec("bold")}>
            <Bold className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn label="Itálico (Ctrl+I)" onClick={() => exec("italic")}>
            <Italic className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <div className="w-px h-4 bg-border mx-1" />
          <ToolbarBtn label="Título" onClick={insertHeading}>
            <Heading2 className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn label="Lista" onClick={insertList}>
            <List className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn label="Separador" onClick={insertHr}>
            <Minus className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <span className="ml-auto text-[10px] text-muted-foreground pr-2">
            Edite direto na folha · variáveis aparecem como chips laranjas
          </span>
        </div>

        {/* Live A4 page */}
        <div className="rounded-lg border border-border bg-muted/30 p-4 overflow-auto">
          <div
            ref={containerRef}
            className="shadow-md mx-auto"
            style={{ transform: "scale(0.78)", transformOrigin: "top center", marginBottom: "-22%" }}
          />
        </div>
      </div>
    );
  }
);

A4LiveEditor.displayName = "A4LiveEditor";
export default A4LiveEditor;

function ToolbarBtn({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={label}
      className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent text-foreground transition-colors"
    >
      {children}
    </button>
  );
}
