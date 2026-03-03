import * as XLSX from "xlsx";

export function exportToExcel(
  rows: Record<string, any>[],
  sheetName: string,
  fileName: string
) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

export function exportMultiSheetExcel(
  sheets: { name: string; rows: Record<string, any>[] }[],
  fileName: string
) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, rows }) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name.substring(0, 31));
  });
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

export function printSection(elementId: string) {
  document.body.classList.add("printing-section");
  const el = document.getElementById(elementId);
  if (el) el.classList.add("print-target");
  window.print();
  document.body.classList.remove("printing-section");
  if (el) el.classList.remove("print-target");
}
