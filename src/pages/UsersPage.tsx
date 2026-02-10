import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useState } from "react";
import { Edit, Trash2 } from "lucide-react";
import type { CommissionGrade, CommissionTier } from "@/lib/commission";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  role: "admin" | "operador";
  commission_rate: number;
  commission_grade_id: string | null;
}

const UsersPage = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [editRole, setEditRole] = useState<string>("operador");
  const [editGradeId, setEditGradeId] = useState<string>("none");
  const [editName, setEditName] = useState<string>("");
  const [deleteUser, setDeleteUser] = useState<Profile | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const [{ data: profiles, error }, { data: emails, error: emailsError }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.rpc("get_user_emails"),
      ]);
      if (error) throw error;
      const emailMap = new Map((emails || []).map((e: { user_id: string; email: string }) => [e.user_id, e.email]));
      return (profiles || []).map((p) => ({ ...p, email: emailMap.get(p.user_id) || "—" })) as (Profile & { email: string })[];
    },
    enabled: profile?.role === "admin",
  });

  const { data: grades = [] } = useQuery({
    queryKey: ["commission-grades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_grades")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []).map((d) => ({ ...d, tiers: d.tiers as unknown as CommissionTier[] })) as CommissionGrade[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, role, commission_grade_id, full_name }: { id: string; role: "admin" | "operador"; commission_grade_id: string | null; full_name: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ role, commission_grade_id, full_name })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Usuário atualizado!");
      setEditUser(null);
    },
    onError: () => toast.error("Erro ao atualizar usuário"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Usuário removido!");
      setDeleteUser(null);
    },
    onError: () => toast.error("Erro ao remover usuário"),
  });

  const handleEdit = (user: Profile) => {
    setEditUser(user);
    setEditRole(user.role);
    setEditGradeId(user.commission_grade_id || "none");
    setEditName(user.full_name);
  };

  const getGradeName = (gradeId: string | null) => {
    if (!gradeId) return "Nenhuma";
    return grades.find((g) => g.id === gradeId)?.name || "—";
  };

  if (profile?.role !== "admin") {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Acesso restrito a administradores.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
        <p className="text-muted-foreground text-sm">Gerencie operadores e administradores</p>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Grade de Comissão</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">Carregando...</TableCell>
              </TableRow>
            ) : users.map((u) => (
              <TableRow key={u.id} className="hover:bg-muted/30 transition-colors">
                <TableCell className="font-medium text-card-foreground">{u.full_name || "Sem nome"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                <TableCell className="capitalize text-muted-foreground">{u.role}</TableCell>
                <TableCell className="text-muted-foreground">{getGradeName(u.commission_grade_id)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(u)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    {u.id !== profile?.id && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteUser(u)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome Completo</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nome do usuário" />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Usuário</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operador">Operador</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Grade de Comissão</Label>
              <Select value={editGradeId} onValueChange={setEditGradeId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {grades.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (editUser) {
                  updateMutation.mutate({
                    id: editUser.id,
                    role: editRole as "admin" | "operador",
                    commission_grade_id: editGradeId === "none" ? null : editGradeId,
                    full_name: editName,
                  });
                }
              }}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deleteUser?.full_name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteUser && deleteMutation.mutate(deleteUser.id)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UsersPage;
