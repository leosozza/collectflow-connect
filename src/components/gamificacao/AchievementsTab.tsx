import { useQuery } from "@tanstack/react-query";
import { fetchAllAchievements, ACHIEVEMENT_DEFINITIONS } from "@/services/gamificationService";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

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
        .select("*, profiles!achievements_profile_id_fkey(full_name)")
        .eq("tenant_id", tenant!.id)
        .order("earned_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin && !!tenant?.id,
  });

  const earned = isAdmin ? allEarned : myEarned;
  const isLoading = isAdmin ? loadingAll : loadingMy;

  const earnedTitles = new Set(earned.map((a: any) => a.title));

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground text-sm">Carregando conquistas...</div>;
  }

  // Admin: show list with operator names
  if (isAdmin) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">
          {earned.length} conquistas concedidas no total
        </div>
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
                <p className="text-[10px] text-primary mt-1.5">
                  👤 {a.profiles?.full_name || "—"} · {format(parseISO(a.earned_at), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>
          ))}
          {earned.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-2 text-center py-8">Nenhuma conquista concedida ainda.</p>
          )}
        </div>
      </div>
    );
  }

  // Operator: show definitions grid
  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        {earned.length} de {ACHIEVEMENT_DEFINITIONS.length} conquistas desbloqueadas
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ACHIEVEMENT_DEFINITIONS.map(def => {
          const isEarned = earnedTitles.has(def.title);
          const earnedData = earned.find((a: any) => a.title === def.title);

          return (
            <div
              key={def.key}
              className={`rounded-xl border p-4 flex items-start gap-4 transition-all ${
                isEarned
                  ? "border-primary/30 bg-primary/5"
                  : "border-border bg-muted/30 opacity-50 grayscale"
              }`}
            >
              <div className="text-3xl flex-shrink-0 w-10 text-center">{def.icon}</div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${isEarned ? "text-foreground" : "text-muted-foreground"}`}>
                  {def.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{def.description}</p>
                {isEarned && earnedData?.earned_at && (
                  <p className="text-[10px] text-primary mt-1.5">
                    ✓ Conquistado em {format(parseISO(earnedData.earned_at), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                )}
                {!isEarned && (
                  <p className="text-[10px] text-muted-foreground mt-1.5">🔒 Bloqueado</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AchievementsTab;
