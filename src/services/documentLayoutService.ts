/**
 * Wraps a rendered document body into a styled A4 page with header (logo + title)
 * and footer (creditor address). Single source of truth used by both preview and PDF.
 */

export interface CredorLayoutInfo {
  razao_social?: string | null;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  portal_logo_url?: string | null;
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  email?: string | null;
}

interface WrapInput {
  bodyHtml: string;
  title: string;
  credor: CredorLayoutInfo | null | undefined;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const formatCep = (cep?: string | null) => {
  const digits = (cep || "").replace(/\D/g, "");
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : cep || "";
};

const formatCnpj = (cnpj?: string | null) => {
  const d = (cnpj || "").replace(/\D/g, "");
  if (d.length !== 14) return cnpj || "";
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

/** Build the centered footer line from credor address parts. */
function buildFooterText(credor: CredorLayoutInfo | null | undefined): string {
  if (!credor) return "";

  const street = [credor.endereco, credor.numero].filter(Boolean).join(", ");
  const streetWithComp = credor.complemento ? `${street} - ${credor.complemento}` : street;

  const cityState = [credor.cidade, credor.uf].filter(Boolean).join("/");
  const cep = formatCep(credor.cep);
  const cepFmt = cep ? `CEP ${cep}` : "";

  const parts = [
    credor.razao_social || credor.nome_fantasia,
    streetWithComp || null,
    credor.bairro || null,
    cityState || null,
    cepFmt || null,
    credor.cnpj ? `CNPJ ${formatCnpj(credor.cnpj)}` : null,
  ].filter((p): p is string => !!p && p.trim().length > 0);

  return parts.join(" — ");
}

/** Strip a leading H2/H1 if it duplicates the page title (case-insensitive). */
function stripDuplicateTitle(bodyHtml: string, title: string): string {
  const normalizedTitle = title.trim().toLowerCase();
  // Match leading <h1>...</h1> or <h2>...</h2> with optional whitespace.
  return bodyHtml.replace(/^\s*<h[12][^>]*>([\s\S]*?)<\/h[12]>\s*/i, (full, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, "").trim().toLowerCase();
    return text === normalizedTitle ? "" : full;
  });
}

export function wrapDocumentInA4Page({ bodyHtml, title, credor }: WrapInput): string {
  const cleanBody = stripDuplicateTitle(bodyHtml, title);
  const footerText = buildFooterText(credor);
  const logoUrl = credor?.portal_logo_url?.trim() || "";
  const credorName = credor?.razao_social || credor?.nome_fantasia || "";

  const headerLeft = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="Logo" style="max-height:60px;max-width:200px;object-fit:contain;display:block" crossorigin="anonymous" />`
    : credorName
      ? `<div style="font-family:'Georgia','Times New Roman',serif;font-size:11pt;font-weight:600;color:#1a1a1a;letter-spacing:.3px">${escapeHtml(credorName)}</div>`
      : "";

  return `
<div class="rivo-doc-page" style="
  background:#fff;
  width:210mm;
  min-height:297mm;
  margin:0 auto;
  padding:22mm 20mm 22mm 20mm;
  box-sizing:border-box;
  font-family:'Georgia','Times New Roman',serif;
  font-size:11.5pt;
  line-height:1.65;
  color:#1a1a1a;
  display:flex;
  flex-direction:column;
">
  <style>
    .rivo-doc-page h1, .rivo-doc-page h2 { font-size: 13pt; font-weight: 700; margin: 14pt 0 6pt; text-align: left; color:#1a1a1a; }
    .rivo-doc-page h3 { font-size: 12pt; font-weight: 600; margin: 12pt 0 4pt; }
    .rivo-doc-page p { margin: 0 0 8pt; text-align: justify; }
    .rivo-doc-page ul, .rivo-doc-page ol { margin: 6pt 0 8pt 18pt; }
    .rivo-doc-page li { margin-bottom: 2pt; }
    .rivo-doc-page hr { border: none; border-top: 1px solid #d4d4d4; margin: 14pt 0; }
    .rivo-doc-page strong { font-weight: 700; }
    .rivo-doc-page em { font-style: italic; }
    .rivo-doc-page table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
    .rivo-doc-page .mdl-spacer { height: 6pt; }
  </style>

  <header style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:10mm;">
    <div style="flex:0 0 auto;min-height:60px;display:flex;align-items:center">${headerLeft}</div>
  </header>

  <div style="text-align:center;margin-bottom:8mm;">
    <h1 style="font-family:'Georgia','Times New Roman',serif;font-size:18pt;font-weight:700;letter-spacing:.5px;margin:0;text-transform:uppercase;color:#1a1a1a">${escapeHtml(title)}</h1>
    <div style="width:60px;height:2px;background:#1a1a1a;margin:6pt auto 0"></div>
  </div>

  <main style="flex:1 1 auto;">
    ${cleanBody}
  </main>

  <footer style="margin-top:12mm;padding-top:6mm;border-top:1px solid #d4d4d4;text-align:center;font-family:'Helvetica','Arial',sans-serif;font-size:8.5pt;line-height:1.5;color:#666;">
    ${escapeHtml(footerText)}
  </footer>
</div>
`.trim();
}

/** Sample credor used in editor previews. */
export const SAMPLE_CREDOR: CredorLayoutInfo = {
  razao_social: "Empresa Exemplo Ltda",
  nome_fantasia: "Empresa Exemplo",
  cnpj: "12345678000190",
  portal_logo_url: "",
  endereco: "Av. Paulista",
  numero: "1000",
  complemento: "Sala 1201",
  bairro: "Bela Vista",
  cidade: "São Paulo",
  uf: "SP",
  cep: "01310100",
  email: "contato@exemplo.com.br",
};
