import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchRanking, RankingEntry } from "@/services/gamificationService";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const medals = ["🥇", "🥈", "🥉"];
const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface RankingTabProps {
  highlightCurrentUser?: boolean;
}

const RankingTab = ({ highlightCurrentUser = true }: RankingTabProps) => {
  const { profile } = useAuth();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const { data: ranking = [], isLoading } = useQuery({
    queryKey: ["ranking", selectedYear, selectedMonth],
    queryFn: () => fetchRanking(selectedYear, selectedMonth),
    refetchOnWindowFocus: true,
  });

  // Realtime: invalidate when operator_points changes for this tenant
  useEffect(() => {
    if (!tenant?.id) return;
    const channel = supabase
      .channel(`operator-points-${tenant.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "operator_points", filter: `tenant_id=eq.${tenant.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["ranking", selectedYear, selectedMonth] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.id, selectedYear, selectedMonth, queryClient]);

  const maxPoints = ranking[0]?.points || 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={selectedMonth.toString()} onValueChange={v => setSelectedMonth(Number(v))}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthNames.map((m, i) => (
              <SelectItem key={i} value={(i + 1).toString()}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedYear.toString()} onValueChange={v => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[now.getFullYear(), now.getFullYear() - 1].map(y => (
              <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-muted-foreground text-sm">Carregando ranking...</div>
      )}

      {!isLoading && ranking.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Nenhum dado de pontuação para este período ainda.
        </div>
      )}

      {(() => {
        const top3 = ranking.slice(0, 3);
        const rest = ranking.slice(3);

        // Cascade offset by position: 1 (no offset), 2 (offset right + down), 3 (offset more right + more down)
        const cascadeOffset: Record<number, string> = {
          1: "md:mt-0 md:ml-0",
          2: "md:mt-8 md:ml-8",
          3: "md:mt-16 md:ml-16",
        };

        const renderCard = (entry: RankingEntry, extraClass = "") => {
          const isMe = highlightCurrentUser && entry.operator_id === profile?.id;
          const isTop3 = !!entry.position && entry.position <= 3;
          const medal = isTop3 ? medals[entry.position! - 1] : null;
          const name = entry.profile?.full_name || "Operador";
          const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
          const progressPct = Math.round((entry.points / maxPoints) * 100);
          const receiveRate = entry.payments_count > 0
            ? Math.round((entry.payments_count / (entry.payments_count + entry.breaks_count)) * 100)
            : 0;

          const podiumStyles: Record<number, string> = {
            1: "border-amber-400/60 bg-gradient-to-br from-amber-400/15 via-amber-300/5 to-transparent shadow-[0_8px_30px_-12px_rgba(251,191,36,0.5)]",
            2: "border-slate-400/60 bg-gradient-to-br from-slate-300/15 via-slate-200/5 to-transparent",
            3: "border-orange-500/50 bg-gradient-to-br from-orange-400/15 via-orange-300/5 to-transparent",
          };
          const podiumClass = isTop3 ? podiumStyles[entry.position!] : "";

          return (
            <div
              key={entry.id}
              className={`relative overflow-hidden rounded-xl border-2 p-3 transition-all hover:scale-[1.01] ${
                isMe
                  ? "border-primary bg-gradient-to-br from-primary/15 via-primary/5 to-transparent shadow-lg shadow-primary/20"
                  : isTop3
                    ? podiumClass
                    : "border-border bg-card hover:bg-muted/30"
              } ${extraClass}`}
            >
              <div className="absolute -top-2 -right-1 text-[5rem] font-black opacity-[0.06] select-none pointer-events-none leading-none text-foreground">
                {entry.position}
              </div>

              <div className="flex items-center gap-3 mb-2 relative">
                <div className="flex items-center justify-center w-10 h-10 flex-shrink-0">
                  {medal ? (
                    <span className="text-3xl drop-shadow-md">{medal}</span>
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-xs font-black text-muted-foreground">#{entry.position}</span>
                    </div>
                  )}
                </div>
                <Avatar className="w-10 h-10 ring-2 ring-background shadow-md">
                  <AvatarImage src={entry.profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-xs font-bold bg-primary/15 text-primary">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-bold truncate leading-tight ${isMe ? "text-primary" : "text-foreground"}`}>
                      {name}
                    </p>
                    {isMe && (
                      <span className="text-[9px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded uppercase tracking-wider">
                        Você
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-foreground mt-0.5">
                    {formatCurrency(entry.total_received)}
                    <span className="text-[10px] font-normal text-muted-foreground ml-1">recebido</span>
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xl font-black text-foreground leading-none tracking-tight">
                    {entry.points.toLocaleString("pt-BR")}
                  </p>
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">pontos</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-semibold bg-background/50">
                  🎯 {receiveRate}% taxa
                </Badge>
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-semibold bg-background/50">
                  💰 {entry.payments_count} pagos
                </Badge>
                {entry.breaks_count > 0 && (
                  <Badge variant="destructive" className="text-[10px] h-5 px-1.5 font-semibold">
                    ⚠️ {entry.breaks_count} quebras
                  </Badge>
                )}
              </div>

              <div className="relative pt-3">
                <span className="absolute right-0 top-0 text-[9px] font-bold text-muted-foreground">
                  {progressPct}%
                </span>
                <Progress value={progressPct} className="h-1.5" />
              </div>
            </div>
          );
        };

        return (
          <>
            {top3.length > 0 && (
              <div className="flex flex-col gap-3 md:max-w-[80%]">
                {top3.map(entry => (
                  <div key={entry.id} className={cascadeOffset[entry.position!] || ""}>
                    {renderCard(entry)}
                  </div>
                ))}
              </div>
            )}

            {rest.length > 0 && (
              <div className="flex flex-col gap-3 mt-4">
                {rest.map(entry => renderCard(entry))}
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
};

export default RankingTab;
