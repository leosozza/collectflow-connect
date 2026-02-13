import { useState, useEffect, useCallback } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Plus, RefreshCw, Edit, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";

const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DAY_ABBR = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

interface HoursItem {
  day_week: number;
  start_time: string;
  end_time: string;
  id?: number;
  office_hours_id?: number;
}

interface OfficeHour {
  id: number;
  name: string;
  hours_items?: HoursItem[];
}

const OfficeHoursPanel = () => {
  const { tenant } = useTenant();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const domain = settings.threecplus_domain || "";
  const apiToken = settings.threecplus_api_token || "";

  const [hours, setHours] = useState<OfficeHour[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OfficeHour | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    start_time: "08:00",
    end_time: "18:00",
    selectedDays: [1, 2, 3, 4, 5] as number[],
  });
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
      const listData = await invoke("list_office_hours");
      if (listData?.status === 404) { setHours([]); return; }
      const list: any[] = Array.isArray(listData) ? listData : listData?.data || [];

      // Fetch details for each office hour to get hours_items
      const detailed = await Promise.all(
        list.map(async (oh: any) => {
          try {
            const detail = await invoke("get_office_hours", { office_hours_id: oh.id });
            const d = detail?.data || detail;
            return {
              id: oh.id,
              name: d?.name || oh.name || "—",
              hours_items: d?.hours_items || [],
            };
          } catch {
            return { id: oh.id, name: oh.name || "—", hours_items: [] };
          }
        })
      );
      setHours(detailed);
    } catch {
      toast.error("Erro ao carregar horários");
    } finally {
      setLoading(false);
    }
  }, [invoke, domain, apiToken]);

  useEffect(() => { fetchHours(); }, [fetchHours]);

  const handleSave = async () => {
    if (!formData.name.trim()) { toast.error("Informe o nome"); return; }
    if (formData.selectedDays.length === 0) { toast.error("Selecione pelo menos um dia"); return; }
    setSaving(true);
    try {
      const hoursItems = formData.selectedDays.map(day => ({
        day_week: day,
        start_time: formData.start_time,
        end_time: formData.end_time,
      }));

      const payload = {
        name: formData.name.trim(),
        hours_items: hoursItems,
      };

      if (editing) {
        await invoke("update_office_hours", {
          office_hours_id: editing.id,
          office_hours_data: payload,
        });
        toast.success("Horário atualizado");
      } else {
        await invoke("create_office_hours", { office_hours_data: payload });
        toast.success("Horário criado");
      }
      setDialogOpen(false);
      setEditing(null);
      setFormData({ name: "", start_time: "08:00", end_time: "18:00", selectedDays: [1, 2, 3, 4, 5] });
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

  const toggleDay = (day: number) => {
    setFormData(p => ({
      ...p,
      selectedDays: p.selectedDays.includes(day)
        ? p.selectedDays.filter(d => d !== day)
        : [...p.selectedDays, day].sort(),
    }));
  };

  const getTimeRange = (items: HoursItem[]) => {
    if (!items || items.length === 0) return "—";
    const first = items[0];
    return `${first.start_time} – ${first.end_time}`;
  };

  const getDayBadges = (items: HoursItem[]) => {
    if (!items || items.length === 0) return <span className="text-sm text-muted-foreground">—</span>;
    const activeDays = items.map(i => i.day_week).sort();
    return (
      <div className="flex flex-wrap gap-1">
        {activeDays.map(d => (
          <Badge key={d} variant="outline" className="text-[10px] px-1.5 py-0">
            {DAY_ABBR[d] || d}
          </Badge>
        ))}
      </div>
    );
  };

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
            setFormData({ name: "", start_time: "08:00", end_time: "18:00", selectedDays: [1, 2, 3, 4, 5] });
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
                  <TableHead>Horário</TableHead>
                  <TableHead>Dias</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hours.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-sm text-muted-foreground">{h.id}</TableCell>
                    <TableCell className="font-medium">{h.name}</TableCell>
                    <TableCell className="text-sm">{getTimeRange(h.hours_items || [])}</TableCell>
                    <TableCell>{getDayBadges(h.hours_items || [])}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                        const items = h.hours_items || [];
                        const days = items.map(i => i.day_week).sort();
                        const first = items[0];
                        setEditing(h);
                        setFormData({
                          name: h.name || "",
                          start_time: first?.start_time || "08:00",
                          end_time: first?.end_time || "18:00",
                          selectedDays: days.length > 0 ? days : [1, 2, 3, 4, 5],
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
          <div className="space-y-4">
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
            <div>
              <Label className="mb-2 block">Dias da semana</Label>
              <div className="flex flex-wrap gap-3">
                {DAYS.map((day, idx) => (
                  <label key={idx} className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox
                      checked={formData.selectedDays.includes(idx)}
                      onCheckedChange={() => toggleDay(idx)}
                    />
                    <span className="text-sm">{DAY_ABBR[idx]}</span>
                  </label>
                ))}
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
