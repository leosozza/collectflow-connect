import { useState, useRef, useMemo } from "react";
import { parseSpreadsheet, parseSpreadsheetRaw, ImportedRow } from "@/services/importService";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import {
  fetchFieldMappings,
  autoDetectMapping,
  SYSTEM_FIELDS,
  type FieldMapping,
} from "@/services/fieldMappingService";
import { fetchCustomFields, type CustomField } from "@/services/customFieldsService";
import InlineCustomFieldDialog from "@/components/cadastros/InlineCustomFieldDialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, ArrowRight, Save, Columns } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (rows: ImportedRow[]) => void;
  submitting: boolean;
}

type Step = "upload" | "mapping" | "preview";

const ImportDialog = ({ open, onClose, onConfirm, submitting }: ImportDialogProps) => {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;

  const [step, setStep] = useState<Step>("upload");
  const [rows, setRows] = useState<ImportedRow[]>([]);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedMappingId, setSelectedMappingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: savedMappings = [] } = useQuery({
    queryKey: ["field_mappings", tenantId],
    queryFn: () => fetchFieldMappings(tenantId!),
    enabled: !!tenantId,
  });

  const { data: customFields = [] } = useQuery({
    queryKey: ["custom-fields", tenantId],
    queryFn: () => fetchCustomFields(tenantId!),
    enabled: !!tenantId,
  });

  const allImportFields = useMemo(() => [
    ...SYSTEM_FIELDS.filter((f) => f.value !== "__ignorar__"),
    ...customFields.filter((cf) => cf.is_active).map((cf) => ({
      value: `custom:${cf.field_key}`,
      label: `🏷️ ${cf.field_label}`,
      required: false as const,
    })),
    { value: "__ignorar__", label: "— Ignorar —", required: false as const },
  ], [customFields]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setFileName(file.name);
    setRawFile(file);

    try {
      const { headers } = await parseSpreadsheetRaw(file);
      if (headers.length === 0) {
        setError("Nenhuma coluna encontrada na planilha.");
        return;
      }
      setRawHeaders(headers);

      // Auto-detect mapping
      const detected = autoDetectMapping(headers, savedMappings);
      if (detected) {
        setColumnMapping(detected.mappings);
        setSelectedMappingId(detected.id);
        toast.info(`Mapeamento "${detected.name}" detectado automaticamente`);
      } else {
        // Build default mapping using built-in heuristics
        const defaultMap: Record<string, string> = {};
        const builtinMap: Record<string, string> = {
          "CREDOR": "credor",
          "NOME_DEVEDOR": "nome_completo",
          "NOME DEVEDOR": "nome_completo",
          "NOME_COMPLETO": "nome_completo",
          "NOME COMPLETO": "nome_completo",
          "NOME": "nome_completo",
          "CNPJ_CPF": "cpf",
          "CPF": "cpf",
          "COD_DEVEDOR": "external_id",
          "COD DEVEDOR": "external_id",
          "COD_CONTRATO": "cod_contrato",
          "COD CONTRATO": "cod_contrato",
          "FONE_1": "phone",
          "FONE 1": "phone",
          "FONE_2": "phone2",
          "FONE 2": "phone2",
          "FONE_3": "phone3",
          "FONE 3": "phone3",
          "EMAIL": "email",
          "ENDERECO": "endereco",
          "NUMERO": "numero",
          "COMPLEMENTO": "complemento",
          "BAIRRO": "bairro",
          "CIDADE": "cidade",
          "ESTADO": "uf",
          "UF": "uf",
          "CEP": "cep",
          "NM.": "numero_parcela",
          "PARCELA": "numero_parcela",
          "TITULO": "titulo",
          "TP_TITULO": "tp_titulo",
          "ANO_VENCIMENTO": "ano_vencimento",
          "DT_VENCIMENTO": "data_vencimento",
          "DT VENCIMENTO": "data_vencimento",
          "DATA_VENCIMENTO": "data_vencimento",
          "DATA VENCIMENTO": "data_vencimento",
          "DT_PAGAMENTO": "data_pagamento",
          "DT PAGAMENTO": "data_pagamento",
          "VL_TITULO": "valor_parcela",
          "VL TITULO": "valor_parcela",
          "VALOR_PARCELA": "valor_parcela",
          "VL_SALDO": "valor_saldo",
          "VL_ATUALIZADO": "valor_atualizado",
          "VL ATUALIZADO": "valor_atualizado",
          "VALOR_ENTRADA": "valor_entrada",
          "VALOR_PAGO": "valor_pago",
          "STATUS": "status",
          "ADICIONAL 1": "dados_adicionais",
          "ADICIONAL 2": "dados_adicionais",
          "ADICIONAL 3": "dados_adicionais",
          "ADICIONAL 4": "dados_adicionais",
        };
        headers.forEach((h) => {
          const upper = h.toUpperCase().trim();
          if (builtinMap[upper]) {
            defaultMap[upper] = builtinMap[upper];
          }
        });
        setColumnMapping(defaultMap);
        setSelectedMappingId(null);
      }

      setStep("mapping");
    } catch {
      setError("Erro ao ler a planilha. Verifique se o arquivo está no formato correto.");
    }

    if (inputRef.current) inputRef.current.value = "";
  };

  const applySavedMapping = (mappingId: string) => {
    const m = savedMappings.find((s) => s.id === mappingId);
    if (m) {
      setColumnMapping(m.mappings);
      setSelectedMappingId(m.id);
      toast.info(`Mapeamento "${m.name}" aplicado`);
    }
  };

  const updateMapping = (header: string, target: string) => {
    const upper = header.toUpperCase().trim();
    setColumnMapping((prev) => {
      if (target === "__none__") {
        const copy = { ...prev };
        delete copy[upper];
        return copy;
      }
      return { ...prev, [upper]: target };
    });
    setSelectedMappingId(null);
  };

  // Validation: check required fields are mapped
  const mappingValidation = useMemo(() => {
    const mapped = new Set(Object.values(columnMapping));
    const missing = SYSTEM_FIELDS.filter((f) => f.required && !mapped.has(f.value));
    return { isValid: missing.length === 0, missing };
  }, [columnMapping]);

  const proceedToPreview = async () => {
    if (!rawFile) return;
    try {
      const parsed = await parseSpreadsheet(rawFile, columnMapping);
      if (parsed.length === 0) {
        setError("Nenhum registro válido encontrado após aplicar o mapeamento.");
        return;
      }
      setRows(parsed);
      setStep("preview");
    } catch {
      setError("Erro ao processar a planilha com o mapeamento.");
    }
  };

  const handleClose = () => {
    setRows([]);
    setRawHeaders([]);
    setRawFile(null);
    setColumnMapping({});
    setSelectedMappingId(null);
    setError(null);
    setFileName(null);
    setStep("upload");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Importar Planilha
            {step !== "upload" && (
              <div className="flex items-center gap-1 ml-4">
                <Badge variant={step === "mapping" ? "default" : "secondary"} className="text-[10px]">
                  1. Mapeamento
                </Badge>
                <ArrowRight className="w-3 h-3" />
                <Badge variant={step === "preview" ? "default" : "secondary"} className="text-[10px]">
                  2. Preview
                </Badge>
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Step 1: Upload */}
          {step === "upload" && (
            <div
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFile}
                className="hidden"
              />
              <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {fileName ? (
                  <span className="text-foreground font-medium">{fileName}</span>
                ) : (
                  "Clique para selecionar um arquivo .xlsx ou .csv"
                )}
              </p>
            </div>
          )}

          {/* Step 2: Mapping */}
          {step === "mapping" && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Columns className="w-4 h-4 text-primary" />
                  <span className="font-medium">Mapeamento de Colunas</span>
                  <span className="text-muted-foreground">— {fileName}</span>
                </div>
                {savedMappings.length > 0 && (
                  <Select value={selectedMappingId || ""} onValueChange={applySavedMapping}>
                    <SelectTrigger className="w-52 h-8 text-xs">
                      <SelectValue placeholder="Usar mapeamento salvo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {savedMappings.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} {m.is_default ? "⭐" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {!mappingValidation.isValid && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Campos obrigatórios não mapeados: {mappingValidation.missing.map((f) => f.label).join(", ")}
                </div>
              )}

              <ScrollArea className="flex-1 border border-border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Coluna da Planilha</TableHead>
                      <TableHead className="w-8" />
                      <TableHead>Campo do Sistema</TableHead>
                      <TableHead className="w-16">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rawHeaders.map((header) => {
                      const upperHeader = header.toUpperCase().trim();
                      const mapped = columnMapping[upperHeader];
                      const fieldInfo = SYSTEM_FIELDS.find((f) => f.value === mapped);
                      return (
                        <TableRow key={header}>
                          <TableCell className="font-mono text-sm">{header}</TableCell>
                          <TableCell>
                            <ArrowRight className="w-4 h-4 text-muted-foreground" />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Select
                                value={mapped || "__none__"}
                                onValueChange={(v) => updateMapping(header, v)}
                              >
                                <SelectTrigger className="h-8 text-sm flex-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">— Não mapear —</SelectItem>
                                  {allImportFields.map((f) => (
                                    <SelectItem key={f.value} value={f.value}>
                                      {f.label} {f.required ? "*" : ""}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {tenantId && (
                                <InlineCustomFieldDialog
                                  tenantId={tenantId}
                                  onCreated={(cf) => {
                                    updateMapping(header, `custom:${cf.field_key}`);
                                  }}
                                />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {mapped && mapped !== "__ignorar__" ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </>
          )}

          {/* Step 3: Preview */}
          {step === "preview" && rows.length > 0 && (
            <>
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                {rows.length} registros encontrados
              </div>

              <ScrollArea className="flex-1 border border-border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Credor</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead className="text-center">Parcela</TableHead>
                      <TableHead className="text-right">Entrada</TableHead>
                      <TableHead className="text-right">Parcela</TableHead>
                      <TableHead className="text-right">Pago</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 50).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">{row.credor}</TableCell>
                        <TableCell className="font-medium">{row.nome_completo}</TableCell>
                        <TableCell className="text-muted-foreground">{row.cpf}</TableCell>
                        <TableCell className="text-center">{row.numero_parcela}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.valor_entrada)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.valor_parcela)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.valor_pago)}</TableCell>
                        <TableCell>{row.data_vencimento ? formatDate(row.data_vencimento) : "-"}</TableCell>
                        <TableCell className="capitalize">{row.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {rows.length > 50 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Mostrando 50 de {rows.length} registros
                  </p>
                )}
              </ScrollArea>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <div className="flex gap-2">
            {step === "mapping" && (
              <Button variant="outline" onClick={() => { setStep("upload"); setRawHeaders([]); }}>
                Voltar
              </Button>
            )}
            {step === "preview" && (
              <Button variant="outline" onClick={() => setStep("mapping")}>
                Voltar ao Mapeamento
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            {step === "mapping" && (
              <Button
                onClick={proceedToPreview}
                disabled={!mappingValidation.isValid}
              >
                Visualizar Dados
              </Button>
            )}
            {step === "preview" && (
              <Button
                onClick={() => onConfirm(rows)}
                disabled={rows.length === 0 || submitting}
              >
                {submitting ? "Importando..." : `Importar ${rows.length} registros`}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportDialog;
