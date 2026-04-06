/**
 * PDF generation service using html2pdf.js (client-side).
 * Receives already-rendered HTML and produces A4 PDF.
 */

import html2pdf from "html2pdf.js";

const A4_WRAPPER_STYLES = `
  font-family: 'Georgia', 'Times New Roman', serif;
  font-size: 13px;
  line-height: 1.7;
  color: #1a1a1a;
  padding: 0;
`;

function wrapHtml(html: string): string {
  return `<div style="${A4_WRAPPER_STYLES}">${html}</div>`;
}

const DEFAULT_OPTIONS = {
  margin: [20, 18, 20, 18], // top, left, bottom, right (mm)
  image: { type: "jpeg", quality: 0.98 },
  html2canvas: { scale: 2, useCORS: true, logging: false },
  jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
};

/**
 * Generate PDF and trigger browser download.
 */
export async function downloadPdf(html: string, filename: string): Promise<void> {
  const wrapped = wrapHtml(html);
  await html2pdf().set({ ...DEFAULT_OPTIONS, filename }).from(wrapped).save();
}

/**
 * Generate PDF and return as Blob (for future send via WhatsApp/email).
 */
export async function generatePdfBlob(html: string): Promise<Blob> {
  const wrapped = wrapHtml(html);
  const blob: Blob = await html2pdf()
    .set(DEFAULT_OPTIONS)
    .from(wrapped)
    .outputPdf("blob");
  return blob;
}
