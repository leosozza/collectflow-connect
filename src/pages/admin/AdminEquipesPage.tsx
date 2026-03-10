import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, UserPlus, Shield, Loader2, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface StaffMember {
  id: string;
  full_name: string;
  role_title: string;
  department: string;
  status: string;
}

const DEPARTMENTS = ["Gestão", "Suporte", "Financeiro", "Treinamento", "Desenvolvimento"];

const AdminEquipesPage = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ full_name: "", role_title: "", department: "Gestão", status: "ativo" });

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["admin_staff"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_staff")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as StaffMember[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      if (editingId) {
        const { error } = await supabase.from("admin_staff").update({ ...values, updated_at: new Date().toISOString() }).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("admin_staff").insert(values);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_staff"] });
      toast.success(editingId ? "Colaborador atualizado" : "Colaborador adicionado");
      resetForm();
    },
    onError: () => toast.error("Erro ao salvar colaborador"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("admin_staff").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_staff"] });
      toast.success("Colaborador removido");
    },
    onError: () => toast.error("Erro ao remover"),
  });

  const resetForm = () => {
    setForm({ full_name: "", role_title: "", department: "Gestão", status: "ativo" });
    setEditingId(null);
    setDialogOpen(false);
  };

  const openEdit = (m: StaffMember) => {
    setForm({ full_name: m.full_name, role_title: m.role_title, department: m.department, status: m.status });
    setEditingId(m.id);
    setDialogOpen(true);
  };

  // Stats by department
  const deptCounts = staff.reduce<Record<string, number>>((acc, s) => {
    if (s.status === "ativo") acc[s.department] = (acc[s.department] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Gestão de Equipes
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie colaboradores, cargos e permissões da equipe administrativa
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) resetForm(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="w-4 h-4" />
              Novo Colaborador
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Colaborador" : "Novo Colaborador"}</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }}
            >
              <div>
                <Label>Nome Completo</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
              </div>
              <div>
                <Label>Cargo</Label>
                <Input value={form.role_title} onChange={(e) => setForm({ ...form, role_title: e.target.value })} required />
              </div>
              <div>
                <Label>Departamento</Label>
                <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingId ? "Salvar" : "Adicionar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Department summary */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          Departamentos
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {DEPARTMENTS.map((dept) => (
            <Card key={dept}>
              <CardContent className="pt-4 pb-3 px-4">
                <h3 className="font-semibold text-foreground text-sm">{dept}</h3>
                <Badge variant="secondary" className="mt-1">{deptCounts[dept] || 0} ativo(s)</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Team Members */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Colaboradores</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : staff.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">Nenhum colaborador cadastrado</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-xs text-muted-foreground uppercase">
                    <th className="px-4 py-2.5 text-left font-medium">Nome</th>
                    <th className="px-4 py-2.5 text-left font-medium">Cargo</th>
                    <th className="px-4 py-2.5 text-left font-medium">Departamento</th>
                    <th className="px-4 py-2.5 text-right font-medium">Status</th>
                    <th className="px-4 py-2.5 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((member) => (
                    <tr key={member.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-medium">{member.full_name}</td>
                      <td className="px-4 py-2.5">{member.role_title}</td>
                      <td className="px-4 py-2.5">{member.department}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Badge variant={member.status === "ativo" ? "default" : "secondary"}>{member.status}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right space-x-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(member)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(member.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
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

export default AdminEquipesPage;
