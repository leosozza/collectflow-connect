import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRight } from "lucide-react";
import { SYSTEM_FIELDS, fetchFieldMappings, createFieldMapping, autoDetectMapping, type FieldMapping } from "@/services/fieldMappingService";
import { fetchCustomFields, type CustomField } from "@/services/customFieldsService";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceHeaders: string[];
  tenantId: string;
  onConfirm: (mapping: Record<string, string>) => void;
}

const MaxListMappingDialog = ({ open, onOpenChange, sourceHeaders, tenantId, onConfirm }: Props) => {
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedMappings, setSavedMappings] = useState<FieldMapping[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open || !tenantId) return;
    setLoaded(false);
    Promise.all([
      fetchFieldMappings(tenantId),
      fetchCustomFields(tenantId),
    ]).then(([mappings, fields]) => {
      setSavedMappings(mappings.filter((m) => m.source === "api"));
      setCustomFields(fields.filter((f) => f.is_active));
      
      // Auto-detect mapping
      const detected = autoDetectMapping(sourceHeaders, mappings.filter((m) => m.source === "api"));
      if (detected) {
        setMapping(detected.mappings as Record<string, string>);
        toast.info(`Mapeamento "${detected.name}" aplicado automaticamente`);
      } else {
        // Default mapping for MaxSystem
        const defaultMap: Record<string, string> = {};
        const autoMap: Record<string, string> = {
          CREDOR: "credor",
          COD_DEVEDOR: "external_id",
          COD_CONTRATO: "cod_contrato",
          NOME_DEVEDOR: "nome_completo",
          TITULO: "external_id",
          CNPJ_CPF: "cpf",
          FONE_1: "phone",
          FONE_2: "phone2",
          FONE_3: "phone3",
          PARCELA: "numero_parcela",
          DT_VENCIMENTO: "data_vencimento",
          DT_PAGAMENTO: "data_pagamento",
          VL_TITULO: "valor_parcela",
          STATUS: "status",
        };
        sourceHeaders.forEach((h) => {
          const upper = h.toUpperCase().trim();
          if (autoMap[upper]) defaultMap[h] = autoMap[upper];
        });
        setMapping(defaultMap);
      }
      setLoaded(true);
    });
  }, [open, tenantId, sourceHeaders]);

  const allFields = [
    ...SYSTEM_FIELDS.filter((f) => f.value !== "__ignorar__"),
    ...customFields.map((cf) => ({
      value: `custom:${cf.field_key}`,
      label: `🏷️ ${cf.field_label}`,
      required: false as const,
    })),
    { value: "__ignorar__", label: "— Ignorar —", required: false as const },
  ];

  const handleConfirm = async () => {
    // Check required fields
    const mappedValues = Object.values(mapping);
    const missing = SYSTEM_FIELDS.filter((f) => f.required && !mappedValues.includes(f.value));
    if (missing.length > 0) {
      toast.error(`Campos obrigatórios não mapeados: ${missing.map((m) => m.label).join(", ")}`);
      return;
    }

    setSaving(true);
    try {
      // Save mapping for future use
      const existingApi = savedMappings.find((m) => m.name.startsWith("MaxSystem"));
      if (!existingApi) {
        await createFieldMapping({
          tenant_id: tenantId,
          name: "MaxSystem - API",
          credor: null,
          source: "api",
          mappings: mapping,
          is_default: true,
        });
        toast.success("Mapeamento salvo para futuras importações");
      }
      onConfirm(mapping);
    } catch (err) {
      console.error(err);
      onConfirm(mapping);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mapeamento de Campos — MaxSystem</DialogTitle>
        </DialogHeader>

        {!loaded ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-2">
              Verifique o mapeamento dos campos do MaxSystem para os campos do sistema.
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
                {sourceHeaders.map((header) => (
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
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={saving || !loaded}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Confirmar e Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MaxListMappingDialog;
