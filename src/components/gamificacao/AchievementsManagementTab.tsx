import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { grantAchievement } from "@/services/gamificationService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Award } from "lucide-react";
import { toast } from "sonner";

const EMOJI_OPTIONS = ["🎯", "🔟", "🛡️", "🏆", "👑", "💰", "💎", "⭐", "🚀", "🔥", "🎖️", "🏅"];

const AchievementsManagementTab = () => {
  const { tenant } = useTenant();
  const qc = useQueryClient();
  const [grantOpen, setGrantOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("🎯");
  const [selectedOperator, setSelectedOperator] = useState("");

  const { data: operators = [] } = useQuery({
    queryKey: ["tenant-operators", tenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("tenant_id", tenant!.id)
        .order("full_name");
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  const { data: allAchievements = [] } = useQuery({
    queryKey: ["all-achievements", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("achievements")
        .select("*, profiles!achievements_profile_id_fkey(full_name)")
        .eq("tenant_id", tenant!.id)
        .order("earned_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  const grantMut = useMutation({
    mutationFn: () =>
      grantAchievement({
        profile_id: selectedOperator,
        tenant_id: tenant!.id,
        title,
        description,
        icon,
      }),
    onSuccess: (wasNew) => {
      qc.invalidateQueries({ queryKey: ["all-achievements"] });
      setGrantOpen(false);
      setTitle("");
      setDescription("");
      setSelectedOperator("");
      toast.success(wasNew ? "Conquista concedida!" : "Operador já possui essa conquista.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setGrantOpen(true)} className="gap-1.5">
          <Plus className="w-4 h-4" /> Conceder Conquista
        </Button>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Award className="w-4 h-4 text-primary" />
            Conquistas Concedidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Operador</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allAchievements.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell>{a.icon || "🏅"}</TableCell>
                  <TableCell className="font-medium">{a.title}</TableCell>
                  <TableCell>{a.profiles?.full_name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(a.earned_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                </TableRow>
              ))}
              {allAchievements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Nenhuma conquista registrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conceder Conquista</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Operador *</Label>
              <Select value={selectedOperator} onValueChange={setSelectedOperator}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {operators.map((op: any) => (
                    <SelectItem key={op.id} value={op.id}>{op.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Título *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Top do Mês" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Motivo da conquista" />
            </div>
            <div>
              <Label>Ícone</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {EMOJI_OPTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setIcon(e)}
                    className={`text-xl p-1 rounded ${icon === e ? "bg-primary/20 ring-2 ring-primary" : "hover:bg-muted"}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setGrantOpen(false)}>Cancelar</Button>
              <Button onClick={() => grantMut.mutate()} disabled={!selectedOperator || !title || grantMut.isPending}>
                {grantMut.isPending ? "Salvando..." : "Conceder"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AchievementsManagementTab;
