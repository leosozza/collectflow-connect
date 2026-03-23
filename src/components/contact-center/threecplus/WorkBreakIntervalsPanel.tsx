import { useState, useCallback } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, RefreshCw, Coffee, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const COLOR_PALETTE = [
  "#ffdd00","#fcea79","#d6ba00","#998500","#615400",
  "#f17f0e","#fbd6a4","#ffaf2e","#c26000","#663300",
  "#de2128","#ffb2b3","#f65157","#a50d0d","#5e0808",
  "#e34ab8","#fbc1e9","#f580d3","#b80f7d","#620e39",
  "#a820cb","#e7a8fa","#c45de0","#6e008f","#390057",
  "#7036e4","#ccb6fc","#9c6bff","#411c9c","#2b1269",
  "#2497fd","#b8ddff","#6cbafe","#0062d7","#00298b",
  "#1abcad","#98f1e8","#52dbcd","#009484","#006b5a",
  "#28cc39","#a4f4a7","#69de74","#049a04","#006b00",
  "#8ebd00","#c6ef66","#a4d41c","#5f9400","#375200",
  "#111111","#dedede","#a5a5a5","#6c6c6c","#3a3a3a",
];

const CLASSIFICATIONS = [
  { value: "productive", label: "Produtivo" },
  { value: "unproductive", label: "Improdutivo" },
  { value: "nr17", label: "NR 17" },
];

const RETURN_TYPES = [
  { value: "flexible", label: "Retorno flexível" },
  { value: "automatic", label: "Retorno automático" },
  { value: "request", label: "Solicitar retorno" },
];

const WorkBreakIntervalsPanel = () => {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const domain = settings.threecplus_domain || "";
  const apiToken = settings.threecplus_api_token || "";

  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);
  const [groupIntervals, setGroupIntervals] = useState<Record<number, any[]>>({});
  const [loadingIntervals, setLoadingIntervals] = useState<number | null>(null);

  // Group dialog
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [groupName, setGroupName] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState<number | null>(null);

  // Interval dialog
  const [intervalDialogOpen, setIntervalDialogOpen] = useState(false);
  const [editingInterval, setEditingInterval] = useState<any>(null);
  const [intervalGroupId, setIntervalGroupId] = useState<number | null>(null);
  const [intervalName, setIntervalName] = useState("");
  const [intervalMaxTime, setIntervalMaxTime] = useState("");
  const [intervalDailyLimit, setIntervalDailyLimit] = useState("");
  const [intervalColor, setIntervalColor] = useState("#28cc39");
  const [intervalClassification, setIntervalClassification] = useState("");
  const [intervalReturnType, setIntervalReturnType] = useState("flexible");
  const [intervalAutoStart, setIntervalAutoStart] = useState(false);
  const [savingInterval, setSavingInterval] = useState(false);
  const [deletingInterval, setDeletingInterval] = useState<number | null>(null);

  const invoke = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
      body: { action, domain, api_token: apiToken, ...extra },
    });
    if (error) throw error;
    if (data && data.success === false) {
      const errDetail = data.errors
        ? Object.entries(data.errors).map(([k, v]: [string, any]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join("; ")
        : data.detail || data.title || `Erro da 3CPlus (${data.status})`;
      throw new Error(errDetail);
    }
    return data;
  }, [domain, apiToken]);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["3cp-work-break-groups", domain],
    queryFn: async () => {
      const data = await invoke("list_work_break_groups");
      return Array.isArray(data) ? data : data?.data || [];
    },
    enabled: !!domain && !!apiToken,
  });

  const fetchIntervals = useCallback(async (groupId: number) => {
    setLoadingIntervals(groupId);
    try {
      const data = await invoke("list_work_break_group_intervals", { group_id: groupId });
      const list = Array.isArray(data) ? data : data?.data || [];
      setGroupIntervals(prev => ({ ...prev, [groupId]: list }));
    } catch {
      toast.error("Erro ao carregar intervalos");
    } finally {
      setLoadingIntervals(null);
    }
  }, [invoke]);

  const toggleGroup = (groupId: number) => {
    if (expandedGroup === groupId) {
      setExpandedGroup(null);
    } else {
      setExpandedGroup(groupId);
      if (!groupIntervals[groupId]) fetchIntervals(groupId);
    }
  };

  // Group CRUD
  const handleSaveGroup = async () => {
    if (!groupName.trim()) { toast.error("Nome é obrigatório"); return; }
    setSavingGroup(true);
    try {
      if (editingGroup) {
        await invoke("update_work_break_group", { group_id: editingGroup.id, name: groupName.trim() });
        toast.success("Grupo atualizado");
      } else {
        await invoke("create_work_break_group", { name: groupName.trim() });
        toast.success("Grupo criado");
      }
      setGroupDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["3cp-work-break-groups"] });
    } catch {
      toast.error("Erro ao salvar grupo");
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    setDeletingGroup(groupId);
    try {
      await invoke("delete_work_break_group", { group_id: groupId });
      toast.success("Grupo excluído");
      queryClient.invalidateQueries({ queryKey: ["3cp-work-break-groups"] });
    } catch {
      toast.error("Erro ao excluir grupo");
    } finally {
      setDeletingGroup(null);
    }
  };

  const openNewInterval = (groupId: number) => {
    setEditingInterval(null);
    setIntervalGroupId(groupId);
    setIntervalName("");
    setIntervalMaxTime("");
    setIntervalDailyLimit("");
    setIntervalColor("#28cc39");
    setIntervalClassification("");
    setIntervalReturnType("flexible");
    setIntervalAutoStart(false);
    setIntervalDialogOpen(true);
  };

  const openEditInterval = (interval: any, groupId: number) => {
    setEditingInterval(interval);
    setIntervalGroupId(groupId);
    const typeReverseMap: Record<number, string> = { 1: "productive", 2: "unproductive", 3: "nr17" };
    const returnReverseMap: Record<number, string> = { 1: "flexible", 2: "automatic", 3: "request" };
    setIntervalName(interval.name || interval.description || "");
    setIntervalMaxTime(String(interval.minutes || interval.limit || ""));
    setIntervalDailyLimit(String(interval.daily_limit || interval.maximum_daily_time || ""));
    setIntervalColor(interval.color || "#28cc39");
    const rawType = interval.type ?? interval.classification;
    setIntervalClassification(typeof rawType === "number" ? (typeReverseMap[rawType] || "") : (rawType || ""));
    const rawReturn = interval.return_type;
    setIntervalReturnType(typeof rawReturn === "number" ? (returnReverseMap[rawReturn] || "flexible") : (rawReturn || "flexible"));
    setIntervalAutoStart(!!interval.auto_start);
    setIntervalDialogOpen(true);
  };

  // Interval CRUD
  const handleSaveInterval = async () => {
    if (!intervalName.trim() || !intervalGroupId) { toast.error("Nome é obrigatório"); return; }
    if (!intervalMaxTime || Number(intervalMaxTime) <= 0) { toast.error("Tempo máximo (minutos) é obrigatório"); return; }
    if (!intervalClassification) { toast.error("Classificação é obrigatória"); return; }
    if (!intervalReturnType) { toast.error("Tipo de retorno é obrigatório"); return; }
    setSavingInterval(true);
    try {
      const payload: Record<string, any> = {
        group_id: intervalGroupId,
        name: intervalName.trim(),
        max_time: Number(intervalMaxTime),
        daily_limit: intervalDailyLimit ? Number(intervalDailyLimit) : null,
        color: intervalColor,
        classification: intervalClassification || null,
        return_type: intervalReturnType || null,
        auto_start: intervalAutoStart,
      };

      if (editingInterval) {
        await invoke("update_work_break_group_interval", { ...payload, interval_id: editingInterval.id });
        toast.success("Intervalo atualizado");
      } else {
        await invoke("create_work_break_group_interval", payload);
        toast.success("Intervalo criado");
      }
      setIntervalDialogOpen(false);
      fetchIntervals(intervalGroupId);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar intervalo");
    } finally {
      setSavingInterval(false);
    }
  };

  const handleDeleteInterval = async (groupId: number, intervalId: number) => {
    setDeletingInterval(intervalId);
    try {
      await invoke("delete_work_break_group_interval", { group_id: groupId, interval_id: intervalId });
      toast.success("Intervalo excluído");
      fetchIntervals(groupId);
    } catch {
      toast.error("Erro ao excluir intervalo");
    } finally {
      setDeletingInterval(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coffee className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Grupos de Pausa</h3>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["3cp-work-break-groups"] })} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </Button>
          <Button size="sm" onClick={() => { setEditingGroup(null); setGroupName(""); setGroupDialogOpen(true); }} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Novo Grupo
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : groups.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhum grupo de pausa encontrado</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {groups.map((g: any) => (
            <Card key={g.id}>
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => toggleGroup(g.id)}>
                <div className="flex items-center gap-3">
                  <Coffee className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{g.name}</p>
                    <p className="text-xs text-muted-foreground">ID: {g.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditingGroup(g); setGroupName(g.name || ""); setGroupDialogOpen(true); }}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g.id); }} disabled={deletingGroup === g.id}>
                    {deletingGroup === g.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </Button>
                  {expandedGroup === g.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>

              {expandedGroup === g.id && (
                <CardContent className="border-t pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Intervalos</p>
                    <Button size="sm" variant="outline" onClick={() => openNewInterval(g.id)} className="gap-1.5 h-7 text-xs">
                      <Plus className="w-3 h-3" /> Novo Intervalo
                    </Button>
                  </div>
                  {loadingIntervals === g.id ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div>
                  ) : (groupIntervals[g.id] || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">Nenhum intervalo</p>
                  ) : (
                    (groupIntervals[g.id] || []).map((interval: any) => (
                      <div key={interval.id} className="flex items-center justify-between p-2 rounded bg-muted/40 text-sm">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0 border border-border"
                            style={{ background: interval.color || "#28cc39" }}
                          />
                          <div>
                            <span className="font-medium">{interval.name || interval.description || `Intervalo ${interval.id}`}</span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {(interval.minutes || interval.limit) ? `${interval.minutes || interval.limit} min` : "Sem limite"}
                              {(interval.daily_limit || interval.maximum_daily_time) ? ` · ${interval.daily_limit || interval.maximum_daily_time} min/dia` : ""}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditInterval(interval, g.id)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteInterval(g.id, interval.id)} disabled={deletingInterval === interval.id}>
                            {deletingInterval === interval.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Group Dialog */}
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingGroup ? "Editar Grupo" : "Novo Grupo de Pausa"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome</Label><Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Ex: Pausas Padrão" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveGroup} disabled={savingGroup}>{savingGroup ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Interval Dialog — Full fields like 3CPlus */}
      <Dialog open={intervalDialogOpen} onOpenChange={setIntervalDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingInterval ? "Atualizar Intervalo" : "Novo Intervalo"}</DialogTitle></DialogHeader>
          <div className="space-y-5">
            {/* Card: Informações do intervalo */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground">Informações do intervalo</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input value={intervalName} onChange={(e) => setIntervalName(e.target.value)} placeholder="Nome" />
                </div>
                <div className="space-y-1.5">
                  <Label>Cor</Label>
                  <div className="relative">
                    <details className="group">
                      <summary className="flex items-center justify-between h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer list-none">
                        <span className="w-5 h-5 rounded-full border border-border" style={{ background: intervalColor }} />
                        <ChevronDown className="w-4 h-4 text-muted-foreground group-open:rotate-180 transition-transform" />
                      </summary>
                      <div className="absolute z-50 top-full mt-1 left-0 bg-popover border border-border rounded-md shadow-md p-3 w-64">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Selecione uma cor</p>
                        <div className="flex flex-wrap gap-1.5">
                          {COLOR_PALETTE.map((c) => (
                            <button
                              key={c}
                              type="button"
                              className="w-5 h-5 rounded-full border border-border hover:scale-125 transition-transform"
                              style={{ background: c, outline: intervalColor === c ? "2px solid hsl(var(--primary))" : "none", outlineOffset: 2 }}
                              onClick={() => setIntervalColor(c)}
                            />
                          ))}
                        </div>
                      </div>
                    </details>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Tempo máximo do intervalo</Label>
                  <div className="flex">
                    <Input type="number" min="0" value={intervalMaxTime} onChange={(e) => setIntervalMaxTime(e.target.value)} placeholder="10" className="rounded-r-none" />
                    <span className="inline-flex items-center px-3 border border-l-0 border-input rounded-r-md bg-muted text-xs text-muted-foreground">Minutos</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Tempo máximo diário</Label>
                  <div className="flex">
                    <Input type="number" min="0" value={intervalDailyLimit} onChange={(e) => setIntervalDailyLimit(e.target.value)} placeholder="60" className="rounded-r-none" />
                    <span className="inline-flex items-center px-3 border border-l-0 border-input rounded-r-md bg-muted text-xs text-muted-foreground">Minutos</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card: Configuração do intervalo */}
            <div className="space-y-4 border-t pt-4">
              <h4 className="text-sm font-semibold text-foreground">Configuração do intervalo</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Classificação do intervalo</Label>
                  <Select value={intervalClassification} onValueChange={setIntervalClassification}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {CLASSIFICATIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Retorno do intervalo</Label>
                  <Select value={intervalReturnType} onValueChange={setIntervalReturnType}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {RETURN_TYPES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={intervalAutoStart} onCheckedChange={setIntervalAutoStart} id="autoStart" />
                <Label htmlFor="autoStart" className="font-semibold cursor-pointer">Intervalo automático</Label>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button onClick={handleSaveInterval} disabled={savingInterval} className="w-full">
              {savingInterval ? "Salvando..." : editingInterval ? "Atualizar" : "Criar"}
            </Button>
            <Button variant="ghost" onClick={() => setIntervalDialogOpen(false)} className="w-full">Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkBreakIntervalsPanel;
