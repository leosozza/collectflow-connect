import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { GraduationCap, Calendar, Video, Users, Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  meeting_type: string;
  scheduled_at: string;
  duration_minutes: number;
  meeting_url: string | null;
  status: string;
  participants_count: number;
  notes: string | null;
}

const TYPES = ["Onboarding", "Treinamento", "Reunião"];

const AdminTreinamentosPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", meeting_type: "Reunião", scheduled_at: "",
    duration_minutes: 60, meeting_url: "", participants_count: 0, notes: "",
  });

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["admin_meetings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_meetings")
        .select("*")
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data as Meeting[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const payload = {
        ...values,
        participants_count: Number(values.participants_count),
        duration_minutes: Number(values.duration_minutes),
        description: values.description || null,
        meeting_url: values.meeting_url || null,
        notes: values.notes || null,
      };
      if (editingId) {
        const { error } = await supabase.from("admin_meetings").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("admin_meetings").insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_meetings"] });
      toast.success(editingId ? "Reunião atualizada" : "Reunião agendada");
      resetForm();
    },
    onError: () => toast.error("Erro ao salvar reunião"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("admin_meetings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_meetings"] });
      toast.success("Reunião removida");
    },
    onError: () => toast.error("Erro ao remover"),
  });

  const resetForm = () => {
    setForm({ title: "", description: "", meeting_type: "Reunião", scheduled_at: "", duration_minutes: 60, meeting_url: "", participants_count: 0, notes: "" });
    setEditingId(null);
    setDialogOpen(false);
  };

  const openEdit = (m: Meeting) => {
    setForm({
      title: m.title,
      description: m.description || "",
      meeting_type: m.meeting_type,
      scheduled_at: m.scheduled_at ? m.scheduled_at.slice(0, 16) : "",
      duration_minutes: m.duration_minutes,
      meeting_url: m.meeting_url || "",
      participants_count: m.participants_count,
      notes: m.notes || "",
    });
    setEditingId(m.id);
    setDialogOpen(true);
  };

  const agendadas = meetings.filter((m) => m.status === "agendada").length;
  const realizadas = meetings.filter((m) => m.status === "realizada").length;
  const totalParticipants = meetings.reduce((s, m) => s + m.participants_count, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-primary" />
            Treinamentos e Reuniões
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Agenda, materiais de onboarding e acompanhamento</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) resetForm(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" />Agendar Reunião</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Reunião" : "Agendar Reunião"}</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }}>
              <div><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
              <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.meeting_type} onValueChange={(v) => setForm({ ...form, meeting_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Data/Hora</Label><Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} required /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Duração (min)</Label><Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} /></div>
                <div><Label>Participantes</Label><Input type="number" value={form.participants_count} onChange={(e) => setForm({ ...form, participants_count: Number(e.target.value) })} /></div>
                <div>
                  <Label>Status</Label>
                  <Select value={editingId ? (meetings.find(m => m.id === editingId)?.status || "agendada") : "agendada"} onValueChange={() => {}}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agendada">Agendada</SelectItem>
                      <SelectItem value="realizada">Realizada</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Link da Reunião</Label><Input value={form.meeting_url} onChange={(e) => setForm({ ...form, meeting_url: e.target.value })} placeholder="https://meet.google.com/..." /></div>
              <div><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
              <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingId ? "Salvar" : "Agendar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 pb-3 px-4"><div className="flex items-center gap-2 mb-1"><Calendar className="w-4 h-4 text-primary" /><span className="text-xs text-muted-foreground">Agendadas</span></div><p className="text-2xl font-bold text-foreground">{agendadas}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 px-4"><div className="flex items-center gap-2 mb-1"><Video className="w-4 h-4 text-primary" /><span className="text-xs text-muted-foreground">Realizadas</span></div><p className="text-2xl font-bold text-foreground">{realizadas}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 px-4"><div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-primary" /><span className="text-xs text-muted-foreground">Participantes</span></div><p className="text-2xl font-bold text-foreground">{totalParticipants}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 px-4"><div className="flex items-center gap-2 mb-1"><GraduationCap className="w-4 h-4 text-primary" /><span className="text-xs text-muted-foreground">Total</span></div><p className="text-2xl font-bold text-foreground">{meetings.length}</p></CardContent></Card>
      </div>

      {/* Meetings Table */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Agenda de Reuniões</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : meetings.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma reunião cadastrada</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-xs text-muted-foreground uppercase">
                    <th className="px-4 py-2.5 text-left font-medium">Título</th>
                    <th className="px-4 py-2.5 text-left font-medium">Data</th>
                    <th className="px-4 py-2.5 text-left font-medium">Tipo</th>
                    <th className="px-4 py-2.5 text-right font-medium">Participantes</th>
                    <th className="px-4 py-2.5 text-right font-medium">Status</th>
                    <th className="px-4 py-2.5 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {meetings.map((m) => (
                    <tr key={m.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-medium">{m.title}</td>
                      <td className="px-4 py-2.5">{format(new Date(m.scheduled_at), "dd/MM/yyyy HH:mm")}</td>
                      <td className="px-4 py-2.5"><Badge variant="outline">{m.meeting_type}</Badge></td>
                      <td className="px-4 py-2.5 text-right">{m.participants_count}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Badge variant={m.status === "agendada" ? "default" : m.status === "realizada" ? "secondary" : "destructive"}>{m.status}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right space-x-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(m)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(m.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminTreinamentosPage;
