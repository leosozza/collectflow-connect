import { useState, useCallback } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, RefreshCw, Coffee, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

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
  const [savingInterval, setSavingInterval] = useState(false);
  const [deletingInterval, setDeletingInterval] = useState<number | null>(null);

  const invoke = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
      body: { action, domain, api_token: apiToken, ...extra },
    });
    if (error) throw error;
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

  // Interval CRUD
  const handleSaveInterval = async () => {
    if (!intervalName.trim() || !intervalGroupId) { toast.error("Nome é obrigatório"); return; }
    setSavingInterval(true);
    try {
      if (editingInterval) {
        await invoke("update_work_break_group_interval", {
          group_id: intervalGroupId,
          interval_id: editingInterval.id,
          name: intervalName.trim(),
          max_time: intervalMaxTime ? Number(intervalMaxTime) : null,
        });
        toast.success("Intervalo atualizado");
      } else {
        await invoke("create_work_break_group_interval", {
          group_id: intervalGroupId,
          name: intervalName.trim(),
          max_time: intervalMaxTime ? Number(intervalMaxTime) : null,
        });
        toast.success("Intervalo criado");
      }
      setIntervalDialogOpen(false);
      fetchIntervals(intervalGroupId);
    } catch {
      toast.error("Erro ao salvar intervalo");
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
                    <Button size="sm" variant="outline" onClick={() => { setEditingInterval(null); setIntervalGroupId(g.id); setIntervalName(""); setIntervalMaxTime(""); setIntervalDialogOpen(true); }} className="gap-1.5 h-7 text-xs">
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
                        <div>
                          <span className="font-medium">{interval.name || interval.description || `Intervalo ${interval.id}`}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{(interval.minutes || interval.limit || interval.maximum_time) ? `${interval.minutes || interval.limit || Math.round((interval.maximum_time || 0) / 60)} min` : "Sem limite"}</span>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingInterval(interval); setIntervalGroupId(g.id); setIntervalName(interval.name || interval.description || ""); setIntervalMaxTime(String(interval.minutes || interval.limit || "")); setIntervalDialogOpen(true); }}>
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

      {/* Interval Dialog */}
      <Dialog open={intervalDialogOpen} onOpenChange={setIntervalDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingInterval ? "Editar Intervalo" : "Novo Intervalo"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome</Label><Input value={intervalName} onChange={(e) => setIntervalName(e.target.value)} placeholder="Ex: Pausa Café" /></div>
            <div><Label>Tempo Máximo (minutos)</Label><Input type="number" value={intervalMaxTime} onChange={(e) => setIntervalMaxTime(e.target.value)} placeholder="Vazio = sem limite" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIntervalDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveInterval} disabled={savingInterval}>{savingInterval ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkBreakIntervalsPanel;
