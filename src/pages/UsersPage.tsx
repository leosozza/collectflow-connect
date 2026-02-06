import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import { useState } from "react";
import { Edit } from "lucide-react";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  role: "admin" | "operador";
  commission_rate: number;
}

const UsersPage = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [editRole, setEditRole] = useState<string>("operador");
  const [editCommission, setEditCommission] = useState<string>("0");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Profile[];
    },
    enabled: profile?.role === "admin",
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, role, commission_rate }: { id: string; role: "admin" | "operador"; commission_rate: number }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ role, commission_rate })
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

  const handleEdit = (user: Profile) => {
    setEditUser(user);
    setEditRole(user.role);
    setEditCommission(user.commission_rate.toString());
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
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Comissão (%)</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">Carregando...</TableCell>
              </TableRow>
            ) : users.map((u) => (
              <TableRow key={u.id} className="hover:bg-muted/30 transition-colors">
                <TableCell className="font-medium text-card-foreground">{u.full_name || "Sem nome"}</TableCell>
                <TableCell className="capitalize text-muted-foreground">{u.role}</TableCell>
                <TableCell className="text-right">{u.commission_rate}%</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(u)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
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
              <Label>Comissão (%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={editCommission}
                onChange={(e) => setEditCommission(e.target.value)}
              />
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
                    commission_rate: parseFloat(editCommission) || 0,
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
    </div>
  );
};

export default UsersPage;
