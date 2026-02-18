import { useQuery } from "@tanstack/react-query";
import { fetchAllAchievements, ACHIEVEMENT_DEFINITIONS } from "@/services/gamificationService";
import { useAuth } from "@/hooks/useAuth";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const AchievementsTab = () => {
  const { profile } = useAuth();

  const { data: earned = [], isLoading } = useQuery({
    queryKey: ["achievements", profile?.id],
    queryFn: () => fetchAllAchievements(profile!.id),
    enabled: !!profile?.id,
  });

  const earnedTitles = new Set(earned.map((a: any) => a.title));

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        {earned.length} de {ACHIEVEMENT_DEFINITIONS.length} conquistas desbloqueadas
      </div>

      {isLoading && (
        <div className="text-center py-12 text-muted-foreground text-sm">Carregando conquistas...</div>
      )}

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
