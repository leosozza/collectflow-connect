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
  DEFAULT_WA_DISPOSITION_LIST,
  type DbDispositionType,
} from "@/services/dispositionService";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Check, Minus, Info, Settings } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";

const slugify = (text: string) =>
  text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const COLOR_PALETTE = [
  "#FFDD00","#FCEA79","#D6BA00","#998500","#615400",
  "#F17F0E","#FBD6A4","#FFAF2E","#C26000","#663300",
  "#DE2128","#FFB2B3","#F65157","#A50D0D","#5E0808",
  "#E34AB8","#FBC1E9","#F580D3","#B80F7D","#620E39",
  "#A820CB","#E7A8FA","#C45DE0","#6E008F","#390057",
  "#7036E4","#CCB6FC","#9C6BFF","#411C9C","#2B1269",
  "#2497FD","#B8DDFF","#6CBAFE","#0062D7","#00298B",
  "#1ABCAD","#98F1E8","#52DBCD","#009484","#006B5A",
  "#28CC39","#A4F4A7","#69DE74","#049A04","#006B00",
  "#8EBD00","#C6EF66","#A4D41C","#5F9400","#375200",
  "#111111","#DEDEDE","#A5A5A5","#6C6C6C","#3A3A3A",
];

const BEHAVIOR_OPTIONS = [
  { value: "repetir", label: "Repetir" },
  { value: "nao_discar_telefone", label: "Não discar novamente para o telefone" },
  { value: "nao_discar_cliente", label: "Não discar novamente para o cliente" },
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
  schedule_allow_other_number: boolean;
  schedule_days_limit: number;
  blocklist_mode: string;
  blocklist_days: number;
}

const emptyForm: FormState = {
  label: "", group_name: "resultado", sort_order: 0, active: true,
  color: "#3b82f6", impact: "negativo", behavior: "repetir",
  is_conversion: false, is_cpc: false, is_unknown: false,
  is_callback: false, is_schedule: false, is_blocklist: false,
  schedule_allow_other_number: false, schedule_days_limit: 7,
  blocklist_mode: "indeterminate", blocklist_days: 0,
};

const BoolIcon = ({ value }: { value: boolean }) =>
  value ? <Check className="w-4 h-4 text-primary" /> : <Minus className="w-4 h-4 text-muted-foreground/30" />;

const getBehaviorLabel = (b: string) => {
  if (b === "nao_discar_telefone") return "Não discar telefone";
  if (b === "nao_discar_cliente") return "Não discar cliente";
  if (b === "nao_discar") return "Não discar";
  return "Repetir";
};

const ColorPickerGrid = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-2 h-10">
          <div className="w-5 h-5 rounded-full border border-border shrink-0" style={{ backgroundColor: value }} />
          <span className="text-sm text-muted-foreground">{value}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-3" align="start">
        <p className="text-sm font-medium mb-2">Selecione uma cor</p>
        <div className="flex flex-wrap gap-1.5">
          {COLOR_PALETTE.map(hex => (
            <button
              key={hex}
              type="button"
              className={`w-6 h-6 rounded-full cursor-pointer transition-transform hover:scale-125 border-2 ${value === hex ? "border-primary ring-2 ring-primary/30" : "border-transparent"}`}
              style={{ backgroundColor: hex }}
              onClick={() => { onChange(hex); setOpen(false); }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

const SwitchCard = ({
  label, tooltip, checked, onCheckedChange, children,
}: {
  label: string; tooltip?: string; checked: boolean; onCheckedChange: (v: boolean) => void; children?: React.ReactNode;
}) => (
  <div className="border rounded-md">
    <div className="flex items-center justify-between px-4 h-10">
      <div className="flex items-center gap-2">
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
        <Label className="font-normal cursor-pointer text-sm">{label}</Label>
        {tooltip && <Info className="w-3.5 h-3.5 text-primary" />}
      </div>
    </div>
    {checked && children && (
      <div className="border-t bg-muted/30 px-4 py-3">{children}</div>
    )}
  </div>
);

const CallDispositionTypesTab = ({ channel = "call" }: { channel?: "call" | "whatsapp" }) => {
  const isWhatsApp = channel === "whatsapp";
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
    queryKey: ["call-disposition-types", tenantId, channel],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_disposition_types")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("channel" as any, channel)
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
      const result = await syncDispositionsTo3CPlus(tenantId);
      if (result) {
        const mappedCount = Object.keys(result.dispositionMap).length;
        const totalActive = types.filter(t => t.active).length;
        if (mappedCount < totalActive) {
          toast.warning(`Sync parcial: ${mappedCount}/${totalActive} tabulações sincronizadas. ${result.campaignsUpdated} campanha(s) vinculadas. Verifique os logs.`);
        } else if (result.campaignsUpdated > 0) {
          toast.success(`${mappedCount} tabulações sincronizadas com 3CPlus e vinculadas a ${result.campaignsUpdated} campanha(s)`);
        } else {
          toast.success(`${mappedCount} tabulações sincronizadas com 3CPlus`);
        }
      } else {
        toast.info("Sem credenciais 3CPlus configuradas");
      }
    } catch (e: any) {
      toast.error(`Erro ao sincronizar com 3CPlus: ${e.message || "falha desconhecida"}`);
    } finally {
      setSyncing(false);
    }
  };

  const createMut = useMutation({
    mutationFn: (p: Parameters<typeof createDispositionType>[0]) => createDispositionType(p),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["call-disposition-types"] });
      toast.success("Tabulação criada");
      setOpen(false);
      if (has3CPlus && tenantId) {
        try {
          const result = await syncDispositionsTo3CPlus(tenantId);
          if (result) toast.success(`Sincronizado com 3CPlus (${result.campaignsUpdated} campanha(s))`);
        } catch (e: any) {
          toast.error(`Erro ao sincronizar com 3CPlus: ${e.message || "falha desconhecida"}`);
        }
      }
    },
    onError: () => toast.error("Erro ao criar tabulação"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...p }: { id: string } & Parameters<typeof updateDispositionType>[1]) =>
      updateDispositionType(id, p),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["call-disposition-types"] });
      toast.success("Tabulação atualizada");
      setOpen(false);
      if (has3CPlus && tenantId) {
        try {
          const result = await syncDispositionsTo3CPlus(tenantId);
          if (result) toast.success(`Sincronizado com 3CPlus (${result.campaignsUpdated} campanha(s))`);
        } catch (e: any) {
          toast.error(`Erro ao sincronizar com 3CPlus: ${e.message || "falha desconhecida"}`);
        }
      }
    },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const deleteMut = useMutation({
    mutationFn: deleteDispositionType,
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["call-disposition-types"] });
      toast.success("Tabulação removida");
      if (has3CPlus && tenantId) {
        try {
          const result = await syncDispositionsTo3CPlus(tenantId);
          if (result) toast.success(`Sincronizado com 3CPlus (${result.campaignsUpdated} campanha(s))`);
        } catch (e: any) {
          toast.error(`Erro ao sincronizar com 3CPlus: ${e.message || "falha desconhecida"}`);
        }
      }
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
      color: t.color || "#3b82f6", impact: t.impact || "negativo",
      behavior: t.behavior || "repetir",
      is_conversion: t.is_conversion || false, is_cpc: t.is_cpc || false,
      is_unknown: t.is_unknown || false, is_callback: t.is_callback || false,
      is_schedule: t.is_schedule || false, is_blocklist: t.is_blocklist || false,
      schedule_allow_other_number: (t as any).schedule_allow_other_number || false,
      schedule_days_limit: (t as any).schedule_days_limit ?? 7,
      blocklist_mode: (t as any).blocklist_mode || "indeterminate",
      blocklist_days: (t as any).blocklist_days ?? 0,
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
      schedule_allow_other_number: form.schedule_allow_other_number,
      schedule_days_limit: form.schedule_days_limit,
      blocklist_mode: form.blocklist_mode,
      blocklist_days: form.blocklist_days,
    };
    if (form.id) {
      updateMut.mutate({ id: form.id, ...payload });
    } else {
      createMut.mutate({ tenant_id: tenantId!, key: slugify(form.label), ...payload });
    }
  };

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
                      style={{ backgroundColor: t.color || "#3b82f6" }}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{t.label}</TableCell>
                  <TableCell>
                    <Badge variant={t.impact === "positivo" ? "default" : "secondary"}>
                      {t.impact === "positivo" ? "Positivo" : "Negativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{getBehaviorLabel(t.behavior)}</TableCell>
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
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">

            {/* ── Seção: Dados ── */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Info className="w-4 h-4 text-muted-foreground" />
              </div>
              <h4 className="text-sm font-semibold">Dados</h4>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={form.label}
                  onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="Nome"
                />
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <ColorPickerGrid value={form.color} onChange={v => setForm(f => ({ ...f, color: v }))} />
              </div>
            </div>

            {/* Impacto — radio buttons inline */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm">Impacto dessa qualificação</Label>
                <Info className="w-3.5 h-3.5 text-primary" />
              </div>
              <RadioGroup
                value={form.impact}
                onValueChange={v => setForm(f => ({ ...f, impact: v }))}
                className="flex gap-6"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="positivo" id="impact-positive" />
                  <Label htmlFor="impact-positive" className="font-normal cursor-pointer">Positivo</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="negativo" id="impact-negative" />
                  <Label htmlFor="impact-negative" className="font-normal cursor-pointer">Negativo</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Comportamento */}
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

            <Separator />

            {/* ── Seção: Ações ── */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Settings className="w-4 h-4 text-muted-foreground" />
              </div>
              <h4 className="text-sm font-semibold">Ações</h4>
            </div>

            <div className="space-y-3">
              <SwitchCard
                label="A qualificação é uma conversão?"
                tooltip="Define se esta tabulação conta como conversão"
                checked={form.is_conversion}
                onCheckedChange={v => setForm(f => ({ ...f, is_conversion: v }))}
              />

              <SwitchCard
                label="CPC - Contato com a pessoa certa"
                tooltip="Indica contato direto com o devedor"
                checked={form.is_cpc}
                onCheckedChange={v => setForm(f => ({ ...f, is_cpc: v }))}
              />

              <SwitchCard
                label="Desconhece"
                tooltip="O contato não reconhece a dívida"
                checked={form.is_unknown}
                onCheckedChange={v => setForm(f => ({ ...f, is_unknown: v }))}
              />

              <SwitchCard
                label="Callback"
                tooltip="Permite reagendar contato"
                checked={form.is_callback}
                onCheckedChange={v => setForm(f => ({ ...f, is_callback: v }))}
              />

              {/* Agendamento — expandível */}
              <SwitchCard
                label="Agendamento"
                tooltip="Permite agendar nova ligação"
                checked={form.is_schedule}
                onCheckedChange={v => setForm(f => ({ ...f, is_schedule: v }))}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={form.schedule_allow_other_number}
                      onCheckedChange={v => setForm(f => ({ ...f, schedule_allow_other_number: v }))}
                    />
                    <Label className="font-normal text-sm">Permitir agendar para outro número</Label>
                  </div>
                  <Separator orientation="vertical" className="hidden sm:block h-6" />
                  <div className="flex items-center gap-2">
                    <Label className="font-normal text-sm whitespace-nowrap">Limite de dias:</Label>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      className="w-20 h-8"
                      value={form.schedule_days_limit}
                      onChange={e => setForm(f => ({ ...f, schedule_days_limit: Math.max(1, Number(e.target.value) || 7) }))}
                    />
                  </div>
                </div>
              </SwitchCard>

              {/* Bloqueio — expandível */}
              <SwitchCard
                label="Adicionar número a lista de bloqueio"
                tooltip="Bloqueia o número para futuras discagens"
                checked={form.is_blocklist}
                onCheckedChange={v => setForm(f => ({ ...f, is_blocklist: v }))}
              >
                <RadioGroup
                  value={form.blocklist_mode}
                  onValueChange={v => setForm(f => ({ ...f, blocklist_mode: v }))}
                  className="flex flex-col sm:flex-row sm:items-center gap-3"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="indeterminate" id="block-indeterminate" />
                    <Label htmlFor="block-indeterminate" className="font-normal cursor-pointer text-sm">Tempo indeterminado</Label>
                  </div>
                  <Separator orientation="vertical" className="hidden sm:block h-6" />
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="custom" id="block-custom" />
                    <Label htmlFor="block-custom" className="font-normal cursor-pointer text-sm">Personalizar dias</Label>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      className="w-20 h-8"
                      value={form.blocklist_days}
                      disabled={form.blocklist_mode !== "custom"}
                      onChange={e => setForm(f => ({ ...f, blocklist_days: Math.max(0, Number(e.target.value) || 0) }))}
                    />
                  </div>
                </RadioGroup>
              </SwitchCard>
            </div>

            {/* Ativo toggle (only on edit) */}
            {form.id && (
              <>
                <Separator />
                <div className="flex items-center gap-2">
                  <Switch checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: v }))} />
                  <Label>Ativo</Label>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {form.id ? "Salvar" : "Adicionar Qualificação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CallDispositionTypesTab;
