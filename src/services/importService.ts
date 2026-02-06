import * as XLSX from "xlsx";
import type { ClientFormData } from "./clientService";

export interface ImportedRow {
  credor: string;
  nome_completo: string;
  cpf: string;
  numero_parcela: number;
  valor_parcela: number;
  valor_pago: number;
  data_vencimento: string;
  status: "pendente" | "pago" | "quebrado";
}

const parseBRLCurrency = (value: any): number => {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const clean = String(value)
    .replace(/R\$\s?/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();
  return parseFloat(clean) || 0;
};

const parseBRDate = (value: any): string => {
  if (!value) return "";

  // Excel serial number
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      const y = date.y;
      const m = String(date.m).padStart(2, "0");
      const d = String(date.d).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }

  const str = String(value).trim();

  // DD/MM/YYYY
  const brMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2].padStart(2, "0")}-${brMatch[1].padStart(2, "0")}`;
  }

  // YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  return "";
};

const cleanCPF = (value: any): string => {
  if (!value) return "";
  return String(value).replace(/\D/g, "").padStart(11, "0").slice(0, 11);
};

const formatCPFDisplay = (cpf: string): string => {
  const nums = cpf.replace(/\D/g, "");
  if (nums.length !== 11) return cpf;
  return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9)}`;
};

const detectHeaderRow = (sheet: XLSX.WorkSheet): number => {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  for (let r = range.s.r; r <= Math.min(range.e.r, 10); r++) {
    const cellA = sheet[XLSX.utils.encode_cell({ r, c: 0 })];
    const cellB = sheet[XLSX.utils.encode_cell({ r, c: 1 })];
    const valA = String(cellA?.v || "").toUpperCase().trim();
    const valB = String(cellB?.v || "").toUpperCase().trim();
    if (valA.includes("CREDOR") || valB.includes("NOME") || valB.includes("NOME COMPLETO")) {
      return r;
    }
  }
  return 0; // fallback: first row
};

export const parseSpreadsheet = async (file: File): Promise<ImportedRow[]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const headerRow = detectHeaderRow(sheet);
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");

  const rows: ImportedRow[] = [];

  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const getCell = (c: number) => {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      return cell?.v;
    };

    const nome = String(getCell(1) || "").trim();
    if (!nome) continue; // skip empty rows

    const valorParcela = parseBRLCurrency(getCell(4));
    const valorPago = parseBRLCurrency(getCell(5));
    const dataVencimento = parseBRDate(getCell(7));

    if (!dataVencimento) continue; // skip rows without valid date

    let status: "pendente" | "pago" | "quebrado" = "pendente";
    if (valorPago > 0 && valorPago >= valorParcela) {
      status = "pago";
    } else if (valorPago > 0 && valorPago < valorParcela) {
      status = "quebrado";
    }

    rows.push({
      credor: String(getCell(0) || "MAXFAMA").trim(),
      nome_completo: nome,
      cpf: formatCPFDisplay(cleanCPF(getCell(2))),
      numero_parcela: parseInt(String(getCell(3) || "1"), 10) || 1,
      valor_parcela: valorParcela,
      valor_pago: valorPago,
      data_vencimento: dataVencimento,
      status,
    });
  }

  return rows;
};
