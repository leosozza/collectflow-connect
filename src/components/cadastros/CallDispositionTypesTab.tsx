import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import {
  createDispositionType,
  updateDispositionType,
  deleteDispositionType,
  seedDefaultDispositionTypes,
  syncDispositionsTo3CPlus,
  DEFAULT_DISPOSITION_LIST,
  type DbDispositionType,
} from "@/services/dispositionService";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Check, Minus } from "lucide-react";
import { toast } from "sonner";

const slugify = (text: string) =>
  text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const GROUP_OPTIONS = [
  { value: "resultado", label: "Resultado do Contato" },
  { value: "contato", label: "Erro de Cadastro" },
  { value: "outros", label: "Outros" },
];

const COLOR_OPTIONS = [
  { value: "blue", label: "Azul", hex: "#3b82f6" },
  { value: "green", label: "Verde", hex: "#22c55e" },
  { value: "red", label: "Vermelho", hex: "#ef4444" },
  { value: "yellow", label: "Amarelo", hex: "#eab308" },
  { value: "black", label: "Preto", hex: "#1e293b" },
  { value: "pink", label: "Rosa", hex: "#ec4899" },
];

const IMPACT_OPTIONS = [
  { value: "positivo", label: "Positivo" },
  { value: "negativo", label: "Negativo" },
];

const BEHAVIOR_OPTIONS = [
  { value: "repetir", label: "Repetir" },
  { value: "nao_discar", label: "Não discar novamente" },
];

interface FormState {
  id?: string;
  label: string;
  group_name: string;
  sort_order: number;
  active: boolean;
  color: string;
  impact: string;
  behavior: string;
  is_conversion: boolean;
  is_cpc: boolean;
  is_unknown: boolean;
  is_callback: boolean;
  is_schedule: boolean;
  is_blocklist: boolean;
}

const emptyForm: FormState = {
  label: "", group_name: "resultado", sort_order: 0, active: true,
  color: "blue", impact: "negativo", behavior: "repetir",
  is_conversion: false, is_cpc: false, is_unknown: false,
  is_callback: false, is_schedule: false, is_blocklist: false,
};

const BoolIcon = ({ value }: { value: boolean }) =>
  value ? <Check className="w-4 h-4 text-primary" /> : <Minus className="w-4 h-4 text-muted-foreground/30" />;

const CallDispositionTypesTab = () => {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [seeded, setSeeded] = useState(false);
  const settings = (tenant?.settings as Record<string, any>) || {};
  const has3CPlus = !!(settings.threecplus_domain && settings.threecplus_api_token);
  const [syncing, setSyncing] = useState(false);

  const { data: types = [], isLoading } = useQuery({
    queryKey: ["call-disposition-types", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_disposition_types")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as DbDispositionType[];
    },
    enabled: !!tenantId,
  });

  const seedMut = useMutation({
    mutationFn: () => seedDefaultDispositionTypes(tenantId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call-disposition-types"] });
      setSeeded(true);
    },
  });

  useEffect(() => {
    if (!isLoading && tenantId && !seeded && !seedMut.isPending) {
      const missingDefaults = DEFAULT_DISPOSITION_LIST.some(
        d => !types.find(t => t.key === d.key)
      );
      if (missingDefaults) seedMut.mutate();
    }
  }, [isLoading, tenantId, types, seeded, seedMut.isPending]);

  const triggerSync = async () => {
    if (!has3CPlus || !tenantId) return;
    setSyncing(true);
    try {
      await syncDispositionsTo3CPlus(tenantId);
      toast.success("Tabulações sincronizadas com 3CPlus");
    } catch {
      toast.error("Erro ao sincronizar com 3CPlus");
    } finally {
      setSyncing(false);
    }
  };

  const createMut = useMutation({
    mutationFn: (p: Parameters<typeof createDispositionType>[0]) => createDispositionType(p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call-disposition-types"] });
      toast.success("Tabulação criada");
      setOpen(false);
      if (has3CPlus && tenantId) syncDispositionsTo3CPlus(tenantId).catch(() => {});
    },
    onError: () => toast.error("Erro ao criar tabulação"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...p }: { id: string } & Parameters<typeof updateDispositionType>[1]) =>
      updateDispositionType(id, p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call-disposition-types"] });
      toast.success("Tabulação atualizada");
      setOpen(false);
      if (has3CPlus && tenantId) syncDispositionsTo3CPlus(tenantId).catch(() => {});
    },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const deleteMut = useMutation({
    mutationFn: deleteDispositionType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call-disposition-types"] });
      toast.success("Tabulação removida");
      if (has3CPlus && tenantId) syncDispositionsTo3CPlus(tenantId).catch(() => {});
    },
    onError: () => toast.error("Erro ao remover"),
  });

  const openNew = () => {
    setForm({ ...emptyForm, sort_order: types.length });
    setOpen(true);
  };

  const openEdit = (t: DbDispositionType) => {
    setForm({
      id: t.id, label: t.label, group_name: t.group_name,
      sort_order: t.sort_order, active: t.active,
      color: t.color || "blue", impact: t.impact || "negativo",
      behavior: t.behavior || "repetir",
      is_conversion: t.is_conversion || false, is_cpc: t.is_cpc || false,
      is_unknown: t.is_unknown || false, is_callback: t.is_callback || false,
      is_schedule: t.is_schedule || false, is_blocklist: t.is_blocklist || false,
    });
    setOpen(true);
  };

  const handleSave = () => {
    if (!form.label.trim()) { toast.error("Informe o nome da tabulação"); return; }
    const payload = {
      label: form.label, group_name: form.group_name, sort_order: form.sort_order,
      active: form.active, color: form.color, impact: form.impact, behavior: form.behavior,
      is_conversion: form.is_conversion, is_cpc: form.is_cpc, is_unknown: form.is_unknown,
      is_callback: form.is_callback, is_schedule: form.is_schedule, is_blocklist: form.is_blocklist,
    };
    if (form.id) {
      updateMut.mutate({ id: form.id, ...payload });
    } else {
      createMut.mutate({ tenant_id: tenantId!, key: slugify(form.label), ...payload });
    }
  };

  const getColorHex = (color: string) =>
    COLOR_OPTIONS.find(c => c.value === color)?.hex || "#3b82f6";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {types.length > 0
            ? `${types.length} tabulação(ões) configurada(s).`
            : "Carregando tabulações..."}
        </p>
        <div className="flex gap-2">
          {has3CPlus && (
            <Button size="sm" variant="outline" onClick={triggerSync} disabled={syncing}>
              {syncing ? "Sincronizando..." : "🔄 Sincronizar 3CPlus"}
            </Button>
          )}
          <Button size="sm" onClick={openNew}>
            <Plus className="w-4 h-4 mr-1" /> Nova Tabulação
          </Button>
        </div>
      </div>

      {types.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">Cor</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Impacto</TableHead>
                <TableHead>Comportamento</TableHead>
                <TableHead className="text-center">Conversão</TableHead>
                <TableHead className="text-center">CPC</TableHead>
                <TableHead className="text-center">Desconhece</TableHead>
                <TableHead className="text-center">Callback</TableHead>
                <TableHead className="text-center">Agenda</TableHead>
                <TableHead className="text-center">Bloqueio</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map(t => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div
                      className="w-4 h-4 rounded-full border border-border"
                      style={{ backgroundColor: getColorHex(t.color || "blue") }}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{t.label}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {GROUP_OPTIONS.find(g => g.value === t.group_name)?.label || t.group_name}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.impact === "positivo" ? "default" : "secondary"}>
                      {t.impact === "positivo" ? "Positivo" : "Negativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {t.behavior === "nao_discar" ? "Não discar" : "Repetir"}
                  </TableCell>
                  <TableCell className="text-center"><BoolIcon value={t.is_conversion || false} /></TableCell>
                  <TableCell className="text-center"><BoolIcon value={t.is_cpc || false} /></TableCell>
                  <TableCell className="text-center"><BoolIcon value={t.is_unknown || false} /></TableCell>
                  <TableCell className="text-center"><BoolIcon value={t.is_callback || false} /></TableCell>
                  <TableCell className="text-center"><BoolIcon value={t.is_schedule || false} /></TableCell>
                  <TableCell className="text-center"><BoolIcon value={t.is_blocklist || false} /></TableCell>
                  <TableCell>
                    <Badge variant={t.active ? "default" : "secondary"}>
                      {t.active ? "Sim" : "Não"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(t.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar" : "Nova"} Tabulação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {/* Nome */}
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="Ex: CPC (Contato com a Pessoa Certa)"
              />
            </div>

            {/* Grupo + Cor */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Grupo</Label>
                <Select value={form.group_name} onValueChange={v => setForm(f => ({ ...f, group_name: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GROUP_OPTIONS.map(g => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <Select value={form.color} onValueChange={v => setForm(f => ({ ...f, color: v }))}>
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getColorHex(form.color) }} />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_OPTIONS.map(c => (
                      <SelectItem key={c.value} value={c.value}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.hex }} />
                          {c.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Impacto + Comportamento */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Impacto</Label>
                <Select value={form.impact} onValueChange={v => setForm(f => ({ ...f, impact: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {IMPACT_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Comportamento</Label>
                <Select value={form.behavior} onValueChange={v => setForm(f => ({ ...f, behavior: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BEHAVIOR_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Boolean flags */}
            <div className="space-y-2">
              <Label>Flags</Label>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { key: "is_conversion", label: "Conversão" },
                  { key: "is_cpc", label: "CPC" },
                  { key: "is_unknown", label: "Desconhece" },
                  { key: "is_callback", label: "Callback" },
                  { key: "is_schedule", label: "Agendamento" },
                  { key: "is_blocklist", label: "Lista de Bloqueio" },
                ] as const).map(flag => (
                  <div key={flag.key} className="flex items-center gap-2">
                    <Checkbox
                      checked={form[flag.key]}
                      onCheckedChange={v => setForm(f => ({ ...f, [flag.key]: !!v }))}
                    />
                    <Label className="font-normal cursor-pointer">{flag.label}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Ativo toggle (only on edit) */}
            {form.id && (
              <div className="flex items-center gap-2">
                <Switch checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: v }))} />
                <Label>Ativo</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {form.id ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CallDispositionTypesTab;
