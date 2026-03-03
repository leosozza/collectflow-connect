import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRight, Save } from "lucide-react";
import { SYSTEM_FIELDS, fetchFieldMappings, createFieldMapping, updateFieldMapping, type FieldMapping } from "@/services/fieldMappingService";
import { fetchCustomFields, type CustomField } from "@/services/customFieldsService";
import InlineCustomFieldDialog from "@/components/cadastros/InlineCustomFieldDialog";
import { toast } from "sonner";

/** Real field names from the MaxSystem Installments API payload */
const API_HEADERS = [
  "ResponsibleName", "ResponsibleCPF", "ContractNumber", "IdRecord",
  "CellPhone1", "CellPhone2", "HomePhone", "Email",
  "Number", "Value", "NetValue", "Discount",
  "PaymentDateQuery", "PaymentDateEffected", "IsCancelled",
  "ModelName", "Observations", "Id", "Producer",
];

const DEFAULT_API_MAP: Record<string, string> = {
  ResponsibleName: "nome_completo",
  ResponsibleCPF: "cpf",
  ContractNumber: "cod_contrato",
  IdRecord: "external_id",
  CellPhone1: "phone",
  CellPhone2: "phone2",
  HomePhone: "phone3",
  Email: "email",
  Number: "numero_parcela",
  Value: "valor_parcela",
  NetValue: "valor_saldo",
  PaymentDateQuery: "data_vencimento",
  PaymentDateEffected: "data_pagamento",
  IsCancelled: "status",
  ModelName: "model_name",
  Observations: "observacoes",
  Id: "cod_titulo",
  Producer: "dados_adicionais",
  Discount: "__ignorar__",
};

/** Typical spreadsheet column names */
const SPREADSHEET_HEADERS = [
  "NOME_DEVEDOR", "CNPJ_CPF", "COD_CONTRATO", "COD_DEVEDOR",
  "FONE_1", "FONE_2", "FONE_3", "EMAIL",
  "NUM_PARCELA", "VL_PARCELA", "VL_SALDO", "DESCONTO",
  "DT_VENCIMENTO", "DT_PAGAMENTO", "STATUS",
  "NOME_MODELO", "OBSERVACOES", "COD_TITULO", "DADOS_ADICIONAIS",
];

const DEFAULT_SPREADSHEET_MAP: Record<string, string> = {
  NOME_DEVEDOR: "nome_completo",
  CNPJ_CPF: "cpf",
  COD_CONTRATO: "cod_contrato",
  COD_DEVEDOR: "external_id",
  FONE_1: "phone",
  FONE_2: "phone2",
  FONE_3: "phone3",
  EMAIL: "email",
  NUM_PARCELA: "numero_parcela",
  VL_PARCELA: "valor_parcela",
  VL_SALDO: "valor_saldo",
  DT_VENCIMENTO: "data_vencimento",
  DT_PAGAMENTO: "data_pagamento",
  STATUS: "status",
  NOME_MODELO: "model_name",
  OBSERVACOES: "observacoes",
  COD_TITULO: "cod_titulo",
  DADOS_ADICIONAIS: "dados_adicionais",
  DESCONTO: "__ignorar__",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
}

const MaxListSettingsDialog = ({ open, onOpenChange, tenantId }: Props) => {
  const [apiMapping, setApiMapping] = useState<Record<string, string>>({});
  const [spreadsheetMapping, setSpreadsheetMapping] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [existingApiMapping, setExistingApiMapping] = useState<FieldMapping | null>(null);
  const [existingSpreadsheetMapping, setExistingSpreadsheetMapping] = useState<FieldMapping | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState("api");

  useEffect(() => {
    if (!open || !tenantId) return;
    setLoaded(false);
    Promise.all([
      fetchFieldMappings(tenantId),
      fetchCustomFields(tenantId),
    ]).then(([mappings, fields]) => {
      setCustomFields(fields.filter((f) => f.is_active));

      // Load API mapping
      const apiM = mappings.find((m) => m.source === "api" && m.name.startsWith("MaxSystem"));
      if (apiM) {
        setExistingApiMapping(apiM);
        setApiMapping(apiM.mappings as Record<string, string>);
      } else {
        setExistingApiMapping(null);
        const defaultMap: Record<string, string> = {};
        API_HEADERS.forEach((h) => { if (DEFAULT_API_MAP[h]) defaultMap[h] = DEFAULT_API_MAP[h]; });
        setApiMapping(defaultMap);
      }

      // Load Spreadsheet mapping
      const sheetM = mappings.find((m) => m.source === "spreadsheet" && m.name.startsWith("MaxSystem"));
      if (sheetM) {
        setExistingSpreadsheetMapping(sheetM);
        setSpreadsheetMapping(sheetM.mappings as Record<string, string>);
      } else {
        setExistingSpreadsheetMapping(null);
        const defaultMap: Record<string, string> = {};
        SPREADSHEET_HEADERS.forEach((h) => { if (DEFAULT_SPREADSHEET_MAP[h]) defaultMap[h] = DEFAULT_SPREADSHEET_MAP[h]; });
        setSpreadsheetMapping(defaultMap);
      }

      setLoaded(true);
    });
  }, [open, tenantId]);

  const allFields = [
    ...SYSTEM_FIELDS.filter((f) => f.value !== "__ignorar__"),
    ...customFields.map((cf) => ({
      value: `custom:${cf.field_key}`,
      label: `🏷️ ${cf.field_label}`,
      required: false as const,
    })),
    { value: "__ignorar__", label: "— Ignorar —", required: false as const },
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save API mapping
      if (existingApiMapping) {
        await updateFieldMapping(existingApiMapping.id, { mappings: apiMapping });
      } else {
        const created = await createFieldMapping({
          tenant_id: tenantId,
          name: "MaxSystem - API",
          credor: null,
          source: "api",
          mappings: apiMapping,
          is_default: true,
        });
        setExistingApiMapping(created);
      }

      // Save Spreadsheet mapping
      if (existingSpreadsheetMapping) {
        await updateFieldMapping(existingSpreadsheetMapping.id, { mappings: spreadsheetMapping });
      } else {
        const created = await createFieldMapping({
          tenant_id: tenantId,
          name: "MaxSystem - Planilha",
          credor: null,
          source: "spreadsheet",
          mappings: spreadsheetMapping,
          is_default: true,
        });
        setExistingSpreadsheetMapping(created);
      }

      toast.success("Mapeamentos salvos com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar mapeamentos");
    } finally {
      setSaving(false);
    }
  };

  const renderMappingTable = (
    headers: string[],
    mapping: Record<string, string>,
    setMapping: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    label: string,
  ) => (
    <>
      <p className="text-sm text-muted-foreground mb-2">
        Mapeamento dos campos de <strong>{label}</strong> para o sistema.
        Campos com <Badge variant="destructive" className="text-[10px] px-1 py-0">*</Badge> são obrigatórios.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Campo Origem ({label})</TableHead>
            <TableHead className="w-8"></TableHead>
            <TableHead>Campo Destino (Sistema)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {headers.map((header) => (
            <TableRow key={header}>
              <TableCell className="font-mono text-sm">{header}</TableCell>
              <TableCell>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </TableCell>
              <TableCell>
                <Select
                  value={mapping[header] || "__ignorar__"}
                  onValueChange={(v) => setMapping((prev) => ({ ...prev, [header]: v }))}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allFields.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label} {f.required ? "*" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações — MaxList</DialogTitle>
        </DialogHeader>

        {!loaded ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full">
                <TabsTrigger value="api" className="flex-1">API</TabsTrigger>
                <TabsTrigger value="spreadsheet" className="flex-1">Planilha</TabsTrigger>
              </TabsList>

              <TabsContent value="api">
                {renderMappingTable(API_HEADERS, apiMapping, setApiMapping, "API MaxSystem")}
              </TabsContent>

              <TabsContent value="spreadsheet">
                {renderMappingTable(SPREADSHEET_HEADERS, spreadsheetMapping, setSpreadsheetMapping, "Planilha")}
              </TabsContent>
            </Tabs>

            <div className="flex items-center gap-2 mt-2">
              <InlineCustomFieldDialog
                tenantId={tenantId}
                onCreated={(cf) => {
                  setCustomFields((prev) => [...prev, cf]);
                }}
              />
              <span className="text-sm text-muted-foreground">Novo Campo Personalizado</span>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={handleSave} disabled={saving || !loaded}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar Mapeamentos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MaxListSettingsDialog;
