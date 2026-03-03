import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRight, Save } from "lucide-react";
import { SYSTEM_FIELDS, fetchFieldMappings, createFieldMapping, updateFieldMapping, type FieldMapping } from "@/services/fieldMappingService";
import { fetchCustomFields, type CustomField } from "@/services/customFieldsService";
import InlineCustomFieldDialog from "@/components/cadastros/InlineCustomFieldDialog";
import { toast } from "sonner";

const SOURCE_HEADERS = [
  "CREDOR", "COD_DEVEDOR", "COD_CONTRATO", "NOME_DEVEDOR", "TITULO", "CNPJ_CPF",
  "FONE_1", "FONE_2", "FONE_3", "EMAIL", "ENDERECO", "NUMERO", "COMPLEMENTO",
  "BAIRRO", "CIDADE", "ESTADO", "CEP", "DADOS_ADICIONAIS", "COD_TITULO",
  "NM_PARCELA", "DT_PAGAMENTO", "DT_VENCIMENTO", "ANO_VENCIMENTO", "VL_TITULO",
  "VL_SALDO", "VL_ATUALIZADO", "TP_TITULO", "STATUS", "NOME_MODELO", "OBSERVACOES",
];

const DEFAULT_AUTO_MAP: Record<string, string> = {
  CREDOR: "credor",
  COD_DEVEDOR: "external_id",
  COD_CONTRATO: "cod_contrato",
  NOME_DEVEDOR: "nome_completo",
  CNPJ_CPF: "cpf",
  FONE_1: "phone",
  FONE_2: "phone2",
  FONE_3: "phone3",
  EMAIL: "email",
  ENDERECO: "endereco",
  BAIRRO: "bairro",
  CIDADE: "cidade",
  ESTADO: "uf",
  CEP: "cep",
  NM_PARCELA: "numero_parcela",
  DT_VENCIMENTO: "data_vencimento",
  DT_PAGAMENTO: "data_pagamento",
  VL_TITULO: "valor_parcela",
  VL_SALDO: "valor_saldo",
  VL_ATUALIZADO: "valor_atualizado",
  STATUS: "status",
  TITULO: "titulo",
  NUMERO: "numero",
  COMPLEMENTO: "complemento",
  DADOS_ADICIONAIS: "dados_adicionais",
  COD_TITULO: "cod_titulo",
  ANO_VENCIMENTO: "ano_vencimento",
  TP_TITULO: "tp_titulo",
  NOME_MODELO: "model_name",
  OBSERVACOES: "observacoes",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
}

const MaxListSettingsDialog = ({ open, onOpenChange, tenantId }: Props) => {
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [existingMapping, setExistingMapping] = useState<FieldMapping | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open || !tenantId) return;
    setLoaded(false);
    Promise.all([
      fetchFieldMappings(tenantId),
      fetchCustomFields(tenantId),
    ]).then(([mappings, fields]) => {
      setCustomFields(fields.filter((f) => f.is_active));

      const apiMapping = mappings.find((m) => m.source === "api" && m.name.startsWith("MaxSystem"));
      if (apiMapping) {
        setExistingMapping(apiMapping);
        setMapping(apiMapping.mappings as Record<string, string>);
      } else {
        setExistingMapping(null);
        // Apply defaults
        const defaultMap: Record<string, string> = {};
        SOURCE_HEADERS.forEach((h) => {
          if (DEFAULT_AUTO_MAP[h]) defaultMap[h] = DEFAULT_AUTO_MAP[h];
        });
        setMapping(defaultMap);
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
      if (existingMapping) {
        await updateFieldMapping(existingMapping.id, { mappings: mapping });
      } else {
        const created = await createFieldMapping({
          tenant_id: tenantId,
          name: "MaxSystem - API",
          credor: null,
          source: "api",
          mappings: mapping,
          is_default: true,
        });
        setExistingMapping(created);
      }
      toast.success("Mapeamento salvo com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar mapeamento");
    } finally {
      setSaving(false);
    }
  };

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
            <p className="text-sm text-muted-foreground mb-2">
              Configure o mapeamento de campos do MaxSystem para o sistema.
              Este mapeamento será usado automaticamente nas importações.
              Campos com <Badge variant="destructive" className="text-[10px] px-1 py-0">*</Badge> são obrigatórios.
            </p>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campo Origem (MaxSystem)</TableHead>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Campo Destino (Sistema)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SOURCE_HEADERS.map((header) => (
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
            Salvar Mapeamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MaxListSettingsDialog;
