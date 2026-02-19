import * as XLSX from "xlsx";

export interface ImportedRow {
  credor: string;
  nome_completo: string;
  cpf: string;
  external_id?: string;
  numero_parcela: number;
  valor_entrada: number;
  valor_parcela: number;
  valor_pago: number;
  data_vencimento: string;
  status: "pendente" | "pago" | "quebrado";
  status_raw?: string;
  status_cobranca_id?: string;
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
  return String(value).replace(/\D/g, "").padStart(11, "0").slice(0, 14);
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
      "PARCELA": "parcela",
      "DT_VENCIMENTO": "dt_vencimento",
      "DT VENCIMENTO": "dt_vencimento",
      "DATA_VENCIMENTO": "dt_vencimento",
      "DATA VENCIMENTO": "dt_vencimento",
      "VL_TITULO": "vl_titulo",
      "VL TITULO": "vl_titulo",
      "VALOR_PARCELA": "vl_titulo",
      "VL_SALDO": "vl_saldo",
      "VL_ATUALIZADO": "vl_atualizado",
      "VL ATUALIZADO": "vl_atualizado",
      "STATUS": "status",
      "VALOR_ENTRADA": "valor_entrada",
      "VALOR_PAGO": "valor_pago",
    };

    if (mappings[val]) {
      map[mappings[val]] = c;
    }
  }

  return map;
};

export const parseSpreadsheet = async (file: File): Promise<ImportedRow[]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const headerRow = detectHeaderRow(sheet);
  const colMap = detectColumnMapping(sheet, headerRow);
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

    // Get name - required field
    const nome = getCellStr(colMap["nome"]);
    if (!nome) continue;

    // CPF - required
    const rawCpf = cleanCPF(getCell(colMap["cpf"]));
    if (!rawCpf) continue;

    // Date - required
    const dataVencimento = parseBRDate(getCell(colMap["dt_vencimento"]));
    if (!dataVencimento) continue;

    // Value - prefer VL_ATUALIZADO over VL_TITULO
    const vlAtualizado = parseBRLCurrency(getCell(colMap["vl_atualizado"]));
    const vlTitulo = parseBRLCurrency(getCell(colMap["vl_titulo"]));
    const valorParcela = vlAtualizado > 0 ? vlAtualizado : vlTitulo;
    const valorEntrada = parseBRLCurrency(getCell(colMap["valor_entrada"])) || valorParcela;
    const valorPago = parseBRLCurrency(getCell(colMap["valor_pago"]));

    // Status mapping
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

    // Keep original status text for status_cobranca mapping
    const statusOriginal = getCellStr(colMap["status"]).trim();

    // Address concatenation
    const endParts = [
      getCellStr(colMap["endereco"]),
      getCellStr(colMap["numero"]),
      getCellStr(colMap["complemento"]),
      getCellStr(colMap["bairro"]),
    ].filter(Boolean);
    const endereco = endParts.join(", ") || undefined;

    // Phones - first goes to phone, extras to observacoes
    const fone1 = cleanPhone(getCell(colMap["fone1"]));
    const fone2 = cleanPhone(getCell(colMap["fone2"]));
    const fone3 = cleanPhone(getCell(colMap["fone3"]));

    // Build observacoes
    const obsParts: string[] = [];
    const codContrato = getCellStr(colMap["cod_contrato"]);
    if (codContrato) obsParts.push(`Contrato: ${codContrato}`);
    if (fone2) obsParts.push(`Fone 2: ${fone2}`);
    if (fone3) obsParts.push(`Fone 3: ${fone3}`);

    rows.push({
      credor: getCellStr(colMap["credor"]) || "MAXFAMA",
      nome_completo: nome,
      cpf: formatCPFDisplay(rawCpf),
      external_id: getCellStr(colMap["cod_devedor"]) || undefined,
      numero_parcela: parseInt(String(getCell(colMap["parcela"]) || "1"), 10) || 1,
      valor_entrada: valorEntrada,
      valor_parcela: valorParcela,
      valor_pago: valorPago,
      data_vencimento: dataVencimento,
      status,
      status_raw: statusOriginal || undefined,
      phone: fone1 || undefined,
      email: getCellStr(colMap["email"]) || undefined,
      endereco,
      cidade: getCellStr(colMap["cidade"]) || undefined,
      uf: getCellStr(colMap["estado"]) || undefined,
      cep: getCellStr(colMap["cep"]) || undefined,
      observacoes: obsParts.length > 0 ? obsParts.join(" | ") : undefined,
    });
  }

  return rows;
};
