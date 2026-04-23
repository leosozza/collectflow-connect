import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, UserCheck } from "lucide-react";
import { toast } from "sonner";

const ParticipantsManagementTab = () => {
  const { tenant } = useTenant();
  const qc = useQueryClient();

  const { data: profiles = [] } = useQuery({
    queryKey: ["tenant-profiles-eligible", tenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, role, avatar_url")
        .eq("tenant_id", tenant!.id)
        .in("role", ["operador", "supervisor", "gerente"])
        .order("full_name");
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  const { data: participants = [] } = useQuery({
    queryKey: ["gamification-participants", tenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("gamification_participants")
        .select("profile_id, enabled")
        .eq("tenant_id", tenant!.id);
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  const participantMap = new Map(participants.map((p: any) => [p.profile_id, p.enabled]));

  const toggleMut = useMutation({
    mutationFn: async ({ profileId, enabled }: { profileId: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("gamification_participants")
        .upsert(
          { tenant_id: tenant!.id, profile_id: profileId, enabled },
          { onConflict: "tenant_id,profile_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gamification-participants"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const enableAllOperators = useMutation({
    mutationFn: async () => {
      const operatorProfiles = profiles.filter((p: any) => ["operador", "supervisor", "gerente"].includes(p.role));
      for (const op of operatorProfiles) {
        await supabase
          .from("gamification_participants")
          .upsert(
            { tenant_id: tenant!.id, profile_id: op.id, enabled: true },
            { onConflict: "tenant_id,profile_id" }
          );
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gamification-participants"] });
      toast.success("Todos os operadores habilitados!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const roleLabel: Record<string, string> = {
    admin: "Admin",
    operador: "Operador",
    supervisor: "Supervisor",
    gerente: "Gerente",
  };

  const roleColor: Record<string, string> = {
    admin: "bg-destructive/10 text-destructive border-destructive/30",
    operador: "bg-primary/10 text-primary border-primary/30",
    supervisor: "bg-warning/10 text-warning border-warning/30",
    gerente: "bg-success/10 text-success border-success/30",
  };

  const enabledCount = participants.filter((p: any) => p.enabled).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {enabledCount} participante{enabledCount !== 1 ? "s" : ""} habilitado{enabledCount !== 1 ? "s" : ""}
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => enableAllOperators.mutate()}
          disabled={enableAllOperators.isPending}
        >
          <UserCheck className="w-3.5 h-3.5" />
          Habilitar todos operadores
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuário</TableHead>
            <TableHead>Cargo</TableHead>
            <TableHead className="text-center w-32">Participar</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {profiles.map((p: any) => {
            const isEnabled = participantMap.get(p.id) ?? false;
            return (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.full_name || "Sem nome"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-[10px] ${roleColor[p.role] || ""}`}>
                    {roleLabel[p.role] || p.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) =>
                      toggleMut.mutate({ profileId: p.id, enabled: checked })
                    }
                  />
                </TableCell>
              </TableRow>
            );
          })}
          {profiles.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground">
                Nenhum usuário encontrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default ParticipantsManagementTab;
