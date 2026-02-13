import { useState, useEffect, useCallback } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Plus, RefreshCw, Edit, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";

const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const OfficeHoursPanel = () => {
  const { tenant } = useTenant();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const domain = settings.threecplus_domain || "";
  const apiToken = settings.threecplus_api_token || "";

  const [hours, setHours] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formData, setFormData] = useState({ name: "", start_time: "08:00", end_time: "18:00" });
  const [saving, setSaving] = useState(false);

  const invoke = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
      body: { action, domain, api_token: apiToken, ...extra },
    });
    if (error) throw error;
    return data;
  }, [domain, apiToken]);

  const fetchHours = useCallback(async () => {
    if (!domain || !apiToken) return;
    setLoading(true);
    try {
      const data = await invoke("list_office_hours");
      if (data?.status === 404) { setHours([]); return; }
      setHours(Array.isArray(data) ? data : data?.data || []);
    } catch {
      toast.error("Erro ao carregar horários");
    } finally {
      setLoading(false);
    }
  }, [invoke, domain, apiToken]);

  useEffect(() => { fetchHours(); }, [fetchHours]);

  const handleSave = async () => {
    if (!formData.name.trim()) { toast.error("Informe o nome"); return; }
    setSaving(true);
    try {
      if (editing) {
        await invoke("update_office_hours", {
          office_hours_id: editing.id,
          office_hours_data: formData,
        });
        toast.success("Horário atualizado");
      } else {
        await invoke("create_office_hours", { office_hours_data: formData });
        toast.success("Horário criado");
      }
      setDialogOpen(false);
      setEditing(null);
      setFormData({ name: "", start_time: "08:00", end_time: "18:00" });
      fetchHours();
    } catch {
      toast.error("Erro ao salvar horário");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await invoke("delete_office_hours", { office_hours_id: id });
      toast.success("Horário removido");
      fetchHours();
    } catch {
      toast.error("Erro ao remover horário");
    }
  };

  const formatTime = (t: string | undefined) => t || "—";

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-lg font-semibold">Horários de Operação</h3>
            <p className="text-xs text-muted-foreground">Intervalos e horários de funcionamento do discador</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchHours} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Atualizar
          </Button>
          <Button size="sm" onClick={() => {
            setEditing(null);
            setFormData({ name: "", start_time: "08:00", end_time: "18:00" });
            setDialogOpen(true);
          }} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Horário
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading && hours.length === 0 ? (
            <div className="p-4 space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : hours.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Nenhum horário cadastrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead>Dias</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hours.map((h: any) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-sm text-muted-foreground">{h.id}</TableCell>
                    <TableCell className="font-medium">{h.name || "—"}</TableCell>
                    <TableCell className="text-sm">{formatTime(h.start_time || h.start)}</TableCell>
                    <TableCell className="text-sm">{formatTime(h.end_time || h.end)}</TableCell>
                    <TableCell>
                      {h.days && Array.isArray(h.days) ? (
                        <div className="flex flex-wrap gap-1">
                          {h.days.map((d: number) => (
                            <Badge key={d} variant="outline" className="text-[10px] px-1.5 py-0">
                              {DAYS[d] || d}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {h.monday !== undefined
                            ? DAYS.filter((_, i) => h[["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][i]])
                                .join(", ") || "—"
                            : "—"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                        setEditing(h);
                        setFormData({
                          name: h.name || "",
                          start_time: h.start_time || h.start || "08:00",
                          end_time: h.end_time || h.end || "18:00",
                        });
                        setDialogOpen(true);
                      }}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(h.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Horário" : "Novo Horário"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Horário Comercial" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início</Label>
                <Input type="time" value={formData.start_time} onChange={(e) => setFormData(p => ({ ...p, start_time: e.target.value }))} />
              </div>
              <div>
                <Label>Fim</Label>
                <Input type="time" value={formData.end_time} onChange={(e) => setFormData(p => ({ ...p, end_time: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OfficeHoursPanel;
