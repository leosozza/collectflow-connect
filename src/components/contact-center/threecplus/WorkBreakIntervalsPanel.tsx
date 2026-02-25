import { useState, useCallback } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, RefreshCw, Coffee } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

const WorkBreakIntervalsPanel = () => {
  const { tenant } = useTenant();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const domain = settings.threecplus_domain || "";
  const apiToken = settings.threecplus_api_token || "";

  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [intervals, setIntervals] = useState<any[]>([]);
  const [loadingIntervals, setLoadingIntervals] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInterval, setEditingInterval] = useState<any>(null);
  const [formName, setFormName] = useState("");
  const [formMaxTime, setFormMaxTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const invoke = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
      body: { action, domain, api_token: apiToken, ...extra },
    });
    if (error) throw error;
    return data;
  }, [domain, apiToken]);

  const { data: campaigns = [] } = useQuery({
    queryKey: ["3cp-campaigns-intervals", domain],
    queryFn: async () => {
      const data = await invoke("list_campaigns");
      return Array.isArray(data) ? data : data?.data || [];
    },
    enabled: !!domain && !!apiToken,
  });

  const fetchIntervals = useCallback(async (campaignId: string) => {
    setLoadingIntervals(true);
    try {
      const data = await invoke("list_work_break_intervals", { campaign_id: Number(campaignId) });
      const list = Array.isArray(data) ? data : data?.data || [];
      setIntervals(list);
    } catch {
      toast.error("Erro ao carregar intervalos");
      setIntervals([]);
    } finally {
      setLoadingIntervals(false);
    }
  }, [invoke]);

  const handleCampaignChange = (id: string) => {
    setSelectedCampaign(id);
    fetchIntervals(id);
  };

  const openCreate = () => {
    setEditingInterval(null);
    setFormName("");
    setFormMaxTime("");
    setDialogOpen(true);
  };

  const openEdit = (interval: any) => {
    setEditingInterval(interval);
    setFormName(interval.name || interval.description || "");
    setFormMaxTime(String(interval.max_time || ""));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) { toast.error("Nome é obrigatório"); return; }
    if (!selectedCampaign) return;
    setSaving(true);
    try {
      if (editingInterval) {
        await invoke("update_work_break_interval", {
          campaign_id: Number(selectedCampaign),
          interval_id: editingInterval.id,
          name: formName.trim(),
          max_time: formMaxTime ? Number(formMaxTime) : null,
        });
        toast.success("Intervalo atualizado");
      } else {
        await invoke("create_work_break_interval", {
          campaign_id: Number(selectedCampaign),
          name: formName.trim(),
          max_time: formMaxTime ? Number(formMaxTime) : null,
        });
        toast.success("Intervalo criado");
      }
      setDialogOpen(false);
      fetchIntervals(selectedCampaign);
    } catch {
      toast.error("Erro ao salvar intervalo");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (intervalId: number) => {
    if (!selectedCampaign) return;
    setDeleting(intervalId);
    try {
      await invoke("delete_work_break_interval", {
        campaign_id: Number(selectedCampaign),
        interval_id: intervalId,
      });
      toast.success("Intervalo excluído");
      fetchIntervals(selectedCampaign);
    } catch {
      toast.error("Erro ao excluir intervalo");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Coffee className="w-4 h-4" />
            Intervalos de Pausa
          </CardTitle>
          {selectedCampaign && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => fetchIntervals(selectedCampaign)} className="gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" />
                Atualizar
              </Button>
              <Button size="sm" onClick={openCreate} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Novo Intervalo
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-sm">
          <Label className="text-xs text-muted-foreground">Selecione a campanha</Label>
          <Select value={selectedCampaign} onValueChange={handleCampaignChange}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha uma campanha..." />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map((c: any) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedCampaign && (
          loadingIntervals ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Carregando...</div>
          ) : intervals.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Nenhum intervalo cadastrado nesta campanha.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tempo Máximo (min)</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {intervals.map((interval: any) => (
                  <TableRow key={interval.id}>
                    <TableCell className="font-medium">{interval.name || interval.description || `Intervalo ${interval.id}`}</TableCell>
                    <TableCell>{interval.max_time ? `${interval.max_time} min` : "Sem limite"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(interval)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(interval.id)}
                          disabled={deleting === interval.id}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingInterval ? "Editar Intervalo" : "Novo Intervalo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ex: Pausa Café" />
            </div>
            <div>
              <Label>Tempo Máximo (minutos)</Label>
              <Input type="number" value={formMaxTime} onChange={(e) => setFormMaxTime(e.target.value)} placeholder="Deixe vazio para sem limite" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default WorkBreakIntervalsPanel;
