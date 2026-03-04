import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { fetchRankingConfigs, createRankingConfig, updateRankingConfig, deleteRankingConfig, RankingConfig } from "@/services/rankingConfigService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Trophy } from "lucide-react";

const metricLabels: Record<string, string> = {
  points: "Pontos",
  total_received: "Total Recebido",
  payments_count: "Nº Pagamentos",
  agreements_count: "Nº Acordos",
};

const periodLabels: Record<string, string> = {
  mensal: "Mensal",
  semanal: "Semanal",
  trimestral: "Trimestral",
};

const RankingManagementTab = () => {
  const { tenantUser } = useTenant();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RankingConfig | null>(null);
  const [form, setForm] = useState({ name: "", metric: "points", period: "mensal" });

  const { data: configs = [] } = useQuery({
    queryKey: ["ranking-configs"],
    queryFn: fetchRankingConfigs,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        await updateRankingConfig(editing.id, form);
      } else {
        await createRankingConfig({ ...form, tenant_id: tenantUser!.tenant_id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ranking-configs"] });
      toast.success(editing ? "Ranking atualizado!" : "Ranking criado!");
      resetForm();
    },
    onError: () => toast.error("Erro ao salvar ranking"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRankingConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ranking-configs"] });
      toast.success("Ranking removido!");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      await updateRankingConfig(id, { is_active });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ranking-configs"] }),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm({ name: "", metric: "points", period: "mensal" });
  };

  const openEdit = (r: RankingConfig) => {
    setEditing(r);
    setForm({ name: r.name, metric: r.metric, period: r.period });
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
        <Plus className="w-4 h-4 mr-1" /> Novo Ranking
      </Button>

      {configs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum ranking configurado.</p>
      ) : (
        <div className="space-y-3">
          {configs.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Trophy className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{r.name}</p>
                    <div className="flex gap-2 mt-0.5">
                      <Badge variant="outline" className="text-xs">{metricLabels[r.metric] || r.metric}</Badge>
                      <Badge variant="outline" className="text-xs">{periodLabels[r.period] || r.period}</Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={r.is_active} onCheckedChange={(v) => toggleMutation.mutate({ id: r.id, is_active: v })} />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(r)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(r.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Ranking" : "Novo Ranking"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Top Recebedores" />
            </div>
            <div>
              <Label>Métrica</Label>
              <Select value={form.metric} onValueChange={(v) => setForm(f => ({ ...f, metric: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(metricLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Período</Label>
              <Select value={form.period} onValueChange={(v) => setForm(f => ({ ...f, period: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(periodLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending}>
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RankingManagementTab;
