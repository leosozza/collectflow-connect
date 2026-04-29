/**
 * PDF generation service using html2pdf.js (client-side).
 * Receives already-wrapped A4 HTML (header + body + footer) and produces PDF.
 */

import html2pdf from "html2pdf.js";

const DEFAULT_OPTIONS = {
  margin: 0 as 0,
  image: { type: "jpeg" as const, quality: 0.98 },
  html2canvas: { scale: 2, useCORS: true, logging: false, allowTaint: true },
  jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
};

/**
 * Generate PDF and trigger browser download.
 * `wrappedHtml` must already include the A4 page wrapper from documentLayoutService.
 */
export async function downloadPdf(wrappedHtml: string, filename: string): Promise<void> {
  await html2pdf().set({ ...DEFAULT_OPTIONS, filename }).from(wrappedHtml).save();
}

/**
 * Generate PDF and return as Blob (for future send via WhatsApp/email).
 */
export async function generatePdfBlob(wrappedHtml: string): Promise<Blob> {
  const blob: Blob = await html2pdf()
    .set(DEFAULT_OPTIONS)
    .from(wrappedHtml)
    .outputPdf("blob");
  return blob;
}
