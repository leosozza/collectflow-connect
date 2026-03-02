import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import {
  fetchFieldMappings,
  createFieldMapping,
  updateFieldMapping,
  deleteFieldMapping,
  SYSTEM_FIELDS,
  type FieldMapping,
} from "@/services/fieldMappingService";
import { fetchCredores } from "@/services/cadastrosService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Pencil,
  ArrowRight,
  FileSpreadsheet,
  Globe,
  Star,
} from "lucide-react";
import { useQuery as useQueryCF } from "@tanstack/react-query";
import { fetchCustomFields, type CustomField } from "@/services/customFieldsService";
import InlineCustomFieldDialog from "./InlineCustomFieldDialog";

interface MappingEntry {
  source: string;
  target: string;
}

const FieldMappingConfig = () => {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [credor, setCredor] = useState("");
  const [source, setSource] = useState<"spreadsheet" | "api">("spreadsheet");
  const [isDefault, setIsDefault] = useState(false);
  const [entries, setEntries] = useState<MappingEntry[]>([{ source: "", target: "" }]);

  const { data: mappings = [], isLoading } = useQuery({
    queryKey: ["field_mappings", tenantId],
    queryFn: () => fetchFieldMappings(tenantId!),
    enabled: !!tenantId,
  });

  const { data: credores = [] } = useQuery({
    queryKey: ["credores", tenantId],
    queryFn: () => fetchCredores(tenantId!),
    enabled: !!tenantId,
  });

  const { data: customFields = [] } = useQueryCF({
    queryKey: ["custom-fields", tenantId],
    queryFn: () => fetchCustomFields(tenantId!),
    enabled: !!tenantId,
  });

  const allFields = [
    ...SYSTEM_FIELDS.filter((f) => f.value !== "__ignorar__"),
    ...customFields.filter((cf) => cf.is_active).map((cf) => ({
      value: `custom:${cf.field_key}`,
      label: `🏷️ ${cf.field_label}`,
      required: false as const,
    })),
    { value: "__ignorar__", label: "— Ignorar —", required: false as const },
  ];

  const saveMutation = useMutation({
    mutationFn: async () => {
      const mappingsObj: Record<string, string> = {};
      entries.forEach((e) => {
        if (e.source.trim() && e.target) {
          mappingsObj[e.source.toUpperCase().trim()] = e.target;
        }
      });

      if (Object.keys(mappingsObj).length === 0) {
        throw new Error("Adicione pelo menos um mapeamento");
      }

      const payload = {
        tenant_id: tenantId!,
        name: name.trim(),
        credor: credor || null,
        source,
        mappings: mappingsObj,
        is_default: isDefault,
      };

      if (editingId) {
        await updateFieldMapping(editingId, payload);
      } else {
        await createFieldMapping(payload);
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Mapeamento atualizado" : "Mapeamento criado");
      qc.invalidateQueries({ queryKey: ["field_mappings"] });
      closeDialog();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFieldMapping,
    onSuccess: () => {
      toast.success("Mapeamento excluído");
      qc.invalidateQueries({ queryKey: ["field_mappings"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setName("");
    setCredor("");
    setSource("spreadsheet");
    setIsDefault(false);
    setEntries([{ source: "", target: "" }]);
  };

  const openEdit = (m: FieldMapping) => {
    setEditingId(m.id);
    setName(m.name);
    setCredor(m.credor || "");
    setSource(m.source as "spreadsheet" | "api");
    setIsDefault(m.is_default);
    const e = Object.entries(m.mappings).map(([s, t]) => ({ source: s, target: t }));
    setEntries(e.length > 0 ? e : [{ source: "", target: "" }]);
    setDialogOpen(true);
  };

  const addEntry = () => setEntries([...entries, { source: "", target: "" }]);
  const removeEntry = (i: number) => setEntries(entries.filter((_, idx) => idx !== i));
  const updateEntry = (i: number, field: "source" | "target", val: string) => {
    const copy = [...entries];
    copy[i] = { ...copy[i], [field]: val };
    setEntries(copy);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Configure como as colunas de planilhas ou da API são traduzidas para os campos do sistema.
        </p>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Novo Mapeamento
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : mappings.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            Nenhum mapeamento configurado. Crie um para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {mappings.map((m) => (
            <Card key={m.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-medium">{m.name}</CardTitle>
                    {m.is_default && (
                      <Badge variant="secondary" className="text-[10px]">
                        <Star className="w-3 h-3 mr-0.5" /> Padrão
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px]">
                      {m.source === "spreadsheet" ? (
                        <><FileSpreadsheet className="w-3 h-3 mr-0.5" /> Planilha</>
                      ) : (
                        <><Globe className="w-3 h-3 mr-0.5" /> API</>
                      )}
                    </Badge>
                    {m.credor && (
                      <Badge variant="outline" className="text-[10px]">{m.credor}</Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(m)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => deleteMutation.mutate(m.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(m.mappings).slice(0, 8).map(([src, tgt]) => (
                    <span
                      key={src}
                      className="inline-flex items-center gap-1 text-[10px] bg-muted px-2 py-0.5 rounded"
                    >
                      <span className="text-muted-foreground">{src}</span>
                      <ArrowRight className="w-2.5 h-2.5" />
                      <span className="font-medium">{SYSTEM_FIELDS.find(f => f.value === tgt)?.label || tgt}</span>
                    </span>
                  ))}
                  {Object.keys(m.mappings).length > 8 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{Object.keys(m.mappings).length - 8} campos
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog for create/edit */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar" : "Novo"} Mapeamento de Campos</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Planilha Credor X" />
              </div>
              <div className="space-y-1.5">
                <Label>Credor (opcional)</Label>
                <Select value={credor} onValueChange={setCredor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os credores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos os credores</SelectItem>
                    {credores.map((c: any) => (
                      <SelectItem key={c.id} value={c.razao_social}>
                        {c.nome_fantasia || c.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={source} onValueChange={(v) => setSource(v as any)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="spreadsheet">Planilha</SelectItem>
                    <SelectItem value="api">API</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={isDefault} onCheckedChange={setIsDefault} />
                <Label className="text-sm">Mapeamento padrão</Label>
              </div>
            </div>

            {/* Mapping entries */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Mapeamento de Colunas</Label>
                <Button size="sm" variant="outline" onClick={addEntry} type="button">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Linha
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Coluna de Origem</TableHead>
                    <TableHead className="w-8" />
                    <TableHead>Campo do Sistema</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry, i) => (
                    <TableRow key={i}>
                      <TableCell className="py-1.5">
                        <Input
                          value={entry.source}
                          onChange={(e) => updateEntry(i, "source", e.target.value)}
                          placeholder="Ex: NOME_DEVEDOR"
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell className="py-1.5 text-center">
                        <ArrowRight className="w-4 h-4 text-muted-foreground mx-auto" />
                      </TableCell>
                      <TableCell className="py-1.5">
                        <div className="flex items-center gap-1">
                          <Select value={entry.target} onValueChange={(v) => updateEntry(i, "target", v)}>
                            <SelectTrigger className="h-8 text-sm flex-1">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {allFields.map((f) => (
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
                                updateEntry(i, "target", `custom:${cf.field_key}`);
                              }}
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-1.5">
                        {entries.length > 1 && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => removeEntry(i)}
                            type="button"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!name.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Salvando..." : editingId ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FieldMappingConfig;
