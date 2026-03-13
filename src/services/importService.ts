import * as XLSX from "xlsx";
import { cleanCPF, formatCPFDisplay } from "@/lib/cpfUtils";

export interface ImportedRow {
  credor: string;
  nome_completo: string;
  cpf: string;
  external_id?: string;
  numero_parcela: number;
  valor_entrada: number;
  valor_parcela: number;
  valor_pago: number;
  data_vencimento?: string;
  status: "pendente" | "pago" | "quebrado";
  phone?: string;
  email?: string;
  endereco?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  observacoes?: string;
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

  const brMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2].padStart(2, "0")}-${brMatch[1].padStart(2, "0")}`;
  }

  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  return "";
};

const cleanCPF = (value: any): string => {
  if (!value) return "";
  const digits = String(value).replace(/\D/g, "").padStart(11, "0").slice(0, 14);
  if (digits.length !== 11 && digits.length !== 14) return "";
  return digits;
};

const formatCPFDisplay = (cpf: string): string => {
  const nums = cpf.replace(/\D/g, "");
  if (nums.length === 11) {
    return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9)}`;
  }
  if (nums.length === 14) {
    return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5, 8)}/${nums.slice(8, 12)}-${nums.slice(12)}`;
  }
  return cpf;
};

const cleanPhone = (value: any): string => {
  if (!value) return "";
  return String(value).replace(/\D/g, "").trim();
};

const detectHeaderRow = (sheet: XLSX.WorkSheet): number => {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  for (let r = range.s.r; r <= Math.min(range.e.r, 10); r++) {
    for (let c = 0; c <= Math.min(range.e.c, 10); c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      const val = String(cell?.v || "").toUpperCase().trim();
      if (val === "CREDOR" || val === "NOME_DEVEDOR" || val === "CNPJ_CPF" || val === "NOME COMPLETO" || val === "NOME") {
        return r;
      }
    }
  }
  return 0;
};

const getHeaders = (sheet: XLSX.WorkSheet, headerRow: number): string[] => {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const headers: string[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: headerRow, c })];
    const val = String(cell?.v || "").trim();
    if (val) headers.push(val);
  }
  return headers;
};

/**
 * Parse spreadsheet and return only the raw headers for mapping step.
 */
export const parseSpreadsheetRaw = async (file: File): Promise<{ headers: string[] }> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const headerRow = detectHeaderRow(sheet);
  const headers = getHeaders(sheet, headerRow);
  return { headers };
};

/**
 * Build column index map from custom mapping + headers.
 */
const buildColMapFromMapping = (
  sheet: XLSX.WorkSheet,
  headerRow: number,
  customMapping: Record<string, string>
): Record<string, number> => {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const map: Record<string, number> = {};

  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: headerRow, c })];
    const val = String(cell?.v || "").toUpperCase().trim();
    const target = customMapping[val];
    if (target && target !== "__ignorar__") {
      map[target] = c;
    }
  }

  return map;
};

const detectColumnMapping = (sheet: XLSX.WorkSheet, headerRow: number): Record<string, number> => {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const map: Record<string, number> = {};

  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: headerRow, c })];
    const val = String(cell?.v || "").toUpperCase().trim();

    const mappings: Record<string, string> = {
      "CREDOR": "credor",
      "COD_DEVEDOR": "cod_devedor",
      "COD DEVEDOR": "cod_devedor",
      "COD_CONTRATO": "cod_contrato",
      "COD CONTRATO": "cod_contrato",
      "NOME_DEVEDOR": "nome",
      "NOME DEVEDOR": "nome",
      "NOME_COMPLETO": "nome",
      "NOME COMPLETO": "nome",
      "NOME": "nome",
      "TITULO": "titulo",
      "CNPJ_CPF": "cpf",
      "CPF": "cpf",
      "FONE_1": "fone1",
      "FONE 1": "fone1",
      "FONE_2": "fone2",
      "FONE 2": "fone2",
      "FONE_3": "fone3",
      "FONE 3": "fone3",
      "EMAIL": "email",
      "ENDERECO": "endereco",
      "NUMERO": "numero",
      "COMPLEMENTO": "complemento",
      "BAIRRO": "bairro",
      "CIDADE": "cidade",
      "ESTADO": "estado",
      "UF": "estado",
      "CEP": "cep",
      "NM.": "parcela",
      "PARCELA": "parcela",
      "DT_VENCIMENTO": "dt_vencimento",
      "DT VENCIMENTO": "dt_vencimento",
      "DATA_VENCIMENTO": "dt_vencimento",
      "DATA VENCIMENTO": "dt_vencimento",
      "DT_PAGAMENTO": "dt_pagamento",
      "DT PAGAMENTO": "dt_pagamento",
      "ANO_VENCIMENTO": "ano_vencimento",
      "VL_TITULO": "vl_titulo",
      "VL TITULO": "vl_titulo",
      "VALOR_PARCELA": "vl_titulo",
      "VL_SALDO": "vl_saldo",
      "VL_ATUALIZADO": "vl_atualizado",
      "VL ATUALIZADO": "vl_atualizado",
      "TP_TITULO": "tp_titulo",
      "STATUS": "status",
      "VALOR_ENTRADA": "valor_entrada",
      "VALOR_PAGO": "valor_pago",
      "ADICIONAL 1": "adicional_1",
      "ADICIONAL 2": "adicional_2",
      "ADICIONAL 3": "adicional_3",
      "ADICIONAL 4": "adicional_4",
    };

    if (mappings[val]) {
      map[mappings[val]] = c;
    }
  }

  return map;
};

/**
 * Parse rows using a given column index map (system field name → column index).
 */
const parseRows = (
  sheet: XLSX.WorkSheet,
  headerRow: number,
  colMap: Record<string, number>,
  isCustomMapping: boolean
): ImportedRow[] => {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const rows: ImportedRow[] = [];

  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const getCell = (c: number | undefined) => {
      if (c === undefined) return undefined;
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      return cell?.v;
    };

    const getCellStr = (c: number | undefined) => {
      const v = getCell(c);
      return v != null ? String(v).trim() : "";
    };

    // For custom mappings, field names are already system names
    // For legacy mappings, field names are internal aliases
    const nameCol = isCustomMapping ? colMap["nome_completo"] : colMap["nome"];
    const cpfCol = isCustomMapping ? colMap["cpf"] : colMap["cpf"];
    const dateCol = isCustomMapping ? colMap["data_vencimento"] : colMap["dt_vencimento"];

    const nome = getCellStr(nameCol);
    if (!nome) continue;

    const rawCpf = cleanCPF(getCell(cpfCol));
    if (!rawCpf) continue;

    const dataVencimento = parseBRDate(getCell(dateCol));
    // data_vencimento is now optional — don't skip rows without it

    const vlAtualizado = parseBRLCurrency(getCell(isCustomMapping ? colMap["valor_atualizado"] : colMap["vl_atualizado"]));
    const vlTitulo = parseBRLCurrency(getCell(isCustomMapping ? colMap["valor_parcela"] : colMap["vl_titulo"]));
    const valorParcela = vlAtualizado > 0 ? vlAtualizado : vlTitulo;
    const valorEntrada = parseBRLCurrency(getCell(colMap["valor_entrada"])) || valorParcela;
    const valorPago = parseBRLCurrency(getCell(colMap["valor_pago"]));

    let status: "pendente" | "pago" | "quebrado" = "pendente";
    const statusRaw = getCellStr(colMap["status"]).toUpperCase();
    if (statusRaw === "CANCELADO" || statusRaw === "QUEBRADO") {
      status = "quebrado";
    } else if (statusRaw === "PAGO") {
      status = "pago";
    } else if (valorPago > 0 && valorPago >= valorParcela) {
      status = "pago";
    } else if (valorPago > 0 && valorPago < valorParcela) {
      status = "quebrado";
    }

    // status_raw removed — status is derived automatically post-import

    // Address
    const endParts = isCustomMapping
      ? [getCellStr(colMap["endereco"])]
      : [
          getCellStr(colMap["endereco"]),
          getCellStr(colMap["numero"]),
          getCellStr(colMap["complemento"]),
          getCellStr(colMap["bairro"]),
        ];
    const endereco = endParts.filter(Boolean).join(", ") || undefined;

    // Phones
    const fone1 = cleanPhone(getCell(isCustomMapping ? colMap["phone"] : colMap["fone1"]));
    const fone2 = cleanPhone(getCell(isCustomMapping ? colMap["phone2"] : colMap["fone2"]));
    const fone3 = cleanPhone(getCell(isCustomMapping ? colMap["phone3"] : colMap["fone3"]));

    const obsParts: string[] = [];
    const codContrato = getCellStr(isCustomMapping ? colMap["cod_contrato"] : colMap["cod_contrato"]);
    if (codContrato) obsParts.push(`Contrato: ${codContrato}`);
    if (fone2) obsParts.push(`Fone 2: ${fone2}`);
    if (fone3) obsParts.push(`Fone 3: ${fone3}`);

    // Adicional fields (legacy mode)
    if (!isCustomMapping) {
      const ad1 = getCellStr(colMap["adicional_1"]);
      const ad2 = getCellStr(colMap["adicional_2"]);
      const ad3 = getCellStr(colMap["adicional_3"]);
      const ad4 = getCellStr(colMap["adicional_4"]);
      if (ad1) obsParts.push(`Adicional 1: ${ad1}`);
      if (ad2) obsParts.push(`Adicional 2: ${ad2}`);
      if (ad3) obsParts.push(`Adicional 3: ${ad3}`);
      if (ad4) obsParts.push(`Adicional 4: ${ad4}`);
    }

    const externalIdCol = isCustomMapping ? colMap["external_id"] : colMap["cod_devedor"];
    const cidadeCol = isCustomMapping ? colMap["cidade"] : colMap["cidade"];
    const ufCol = isCustomMapping ? colMap["uf"] : colMap["estado"];
    const parcelaCol = isCustomMapping ? colMap["numero_parcela"] : colMap["parcela"];

    rows.push({
      credor: getCellStr(colMap["credor"]) || "MAXFAMA",
      nome_completo: nome,
      cpf: formatCPFDisplay(rawCpf),
      external_id: getCellStr(externalIdCol) || undefined,
      numero_parcela: parseInt(String(getCell(parcelaCol) || "1"), 10) || 1,
      valor_entrada: valorEntrada,
      valor_parcela: valorParcela,
      valor_pago: valorPago,
      data_vencimento: dataVencimento || undefined,
      status,
      phone: fone1 || undefined,
      email: getCellStr(colMap["email"]) || undefined,
      endereco,
      cidade: getCellStr(cidadeCol) || undefined,
      uf: getCellStr(ufCol) || undefined,
      cep: getCellStr(colMap["cep"]) || undefined,
      observacoes: obsParts.length > 0 ? obsParts.join(" | ") : undefined,
    });
  }

  return rows;
};

/**
 * Parse spreadsheet with optional custom column mapping.
 * If customMapping is provided (header_upper → system_field), it's used instead of auto-detection.
 */
export const parseSpreadsheet = async (
  file: File,
  customMapping?: Record<string, string>
): Promise<ImportedRow[]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const headerRow = detectHeaderRow(sheet);

  if (customMapping && Object.keys(customMapping).length > 0) {
    const colMap = buildColMapFromMapping(sheet, headerRow, customMapping);
    return parseRows(sheet, headerRow, colMap, true);
  } else {
    const colMap = detectColumnMapping(sheet, headerRow);
    return parseRows(sheet, headerRow, colMap, false);
  }
};
