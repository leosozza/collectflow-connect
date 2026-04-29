import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAllAchievements } from "@/services/gamificationService";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AchievementsTabProps {
  isAdmin?: boolean;
}

const AchievementsTab = ({ isAdmin = false }: AchievementsTabProps) => {
  const { profile } = useAuth();
  const { tenant } = useTenant();

  // Operator: own achievements
  const { data: myEarned = [], isLoading: loadingMy } = useQuery({
    queryKey: ["achievements", profile?.id],
    queryFn: () => fetchAllAchievements(profile!.id),
    enabled: !isAdmin && !!profile?.id,
  });

  // Admin: all achievements in tenant
  const { data: allEarned = [], isLoading: loadingAll } = useQuery({
    queryKey: ["all-achievements", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("achievements")
        .select("*, profiles!achievements_profile_id_fkey(full_name, role)")
        .eq("tenant_id", tenant!.id)
        .order("earned_at", { ascending: false });
      if (error) throw error;
      return (data || []).filter((a: any) => ["operador"].includes(a.profiles?.role));
    },
    enabled: isAdmin && !!tenant?.id,
  });

  const earned = isAdmin ? allEarned : myEarned;
  const isLoading = isAdmin ? loadingAll : loadingMy;

  const [operatorFilter, setOperatorFilter] = useState<string>("all");
  const operators = useMemo(() => {
    const map = new Map<string, string>();
    (earned as any[]).forEach((a) => {
      if (a.profile_id) map.set(a.profile_id, a.profiles?.full_name || "—");
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [earned]);

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground text-sm">Carregando conquistas...</div>;
  }

  // Admin: show list with operator names + filter by operator
  if (isAdmin) {
    const filtered = operatorFilter === "all"
      ? earned
      : (earned as any[]).filter((a) => a.profile_id === operatorFilter);


    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-muted-foreground">
            {filtered.length} conquistas concedidas
            {operatorFilter !== "all" && " (filtradas)"}
          </div>
          <Select value={operatorFilter} onValueChange={setOperatorFilter}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Filtrar por operador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os operadores</SelectItem>
              {operators.map((op) => (
                <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((a: any) => (
            <div
              key={a.id}
              className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-start gap-4"
            >
              <div className="text-3xl flex-shrink-0 w-10 text-center">{a.icon || "🏅"}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{a.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>
                <p className="text-[10px] text-primary mt-1.5">
                  👤 {a.profiles?.full_name || "—"}
                  {a.earned_at ? ` · ${format(parseISO(a.earned_at), "dd/MM/yyyy", { locale: ptBR })}` : ""}
                </p>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-2 text-center py-8">Nenhuma conquista concedida ainda.</p>
          )}
        </div>
      </div>
    );
  }

  // Operator: show only earned achievements (no hardcoded definitions)
  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        {earned.length} conquistas desbloqueadas
      </div>

      {earned.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhuma conquista desbloqueada ainda. Continue trabalhando para ganhar!
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {earned.map((a: any) => (
            <div
              key={a.id}
              className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-start gap-4"
            >
              <div className="text-3xl flex-shrink-0 w-10 text-center">{a.icon || "🏅"}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{a.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>
                {a.earned_at && (
                  <p className="text-[10px] text-primary mt-1.5">
                    ✓ Conquistado em {format(parseISO(a.earned_at), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AchievementsTab;
