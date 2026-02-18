import { useQuery } from "@tanstack/react-query";
import { fetchMyPointsHistory, OperatorPoints } from "@/services/gamificationService";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";
import { Progress } from "@/components/ui/progress";

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const PointsHistoryTab = () => {
  const { profile } = useAuth();

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["points-history", profile?.id],
    queryFn: () => fetchMyPointsHistory(profile!.id),
    enabled: !!profile?.id,
  });

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground text-sm">Carregando histórico...</div>;
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Nenhum histórico de pontos ainda. Registre pagamentos para começar!
      </div>
    );
  }

  const maxPoints = Math.max(...history.map(h => h.points), 1);

  return (
    <div className="space-y-3">
      {history.map((entry: OperatorPoints) => {
        const receiveRate = (entry.payments_count + entry.breaks_count) > 0
          ? Math.round((entry.payments_count / (entry.payments_count + entry.breaks_count)) * 100)
          : 0;
        const progressPct = Math.round((entry.points / maxPoints) * 100);

        return (
          <div key={entry.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {monthNames[entry.month - 1]} {entry.year}
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-muted-foreground">✅ {entry.payments_count} pagamentos</span>
                  <span className="text-xs text-destructive">❌ {entry.breaks_count} quebras</span>
                  <span className="text-xs text-muted-foreground">{receiveRate}% taxa</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-foreground">{entry.points.toLocaleString("pt-BR")}</p>
                <p className="text-[10px] text-muted-foreground">pontos</p>
              </div>
            </div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground">Total recebido: {formatCurrency(entry.total_received)}</span>
            </div>
            <Progress value={progressPct} className="h-1.5" />
          </div>
        );
      })}
    </div>
  );
};

export default PointsHistoryTab;
