import { useQuery } from "@tanstack/react-query";
import { fetchRanking, RankingEntry } from "@/services/gamificationService";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

const medals = ["🥇", "🥈", "🥉"];
const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const RankingTab = () => {
  const { profile } = useAuth();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const { data: ranking = [], isLoading } = useQuery({
    queryKey: ["ranking", selectedYear, selectedMonth],
    queryFn: () => fetchRanking(selectedYear, selectedMonth),
  });

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

      <div className="space-y-3">
        {ranking.map((entry: RankingEntry) => {
          const isMe = entry.operator_id === profile?.id;
          const medal = entry.position && entry.position <= 3 ? medals[entry.position - 1] : null;
          const name = entry.profile?.full_name || "Operador";
          const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
          const progressPct = Math.round((entry.points / maxPoints) * 100);
          const receiveRate = entry.payments_count > 0
            ? Math.round((entry.payments_count / (entry.payments_count + entry.breaks_count)) * 100)
            : 0;

          return (
            <div
              key={entry.id}
              className={`rounded-xl border p-4 transition-all ${
                isMe
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-8 h-8 text-lg">
                  {medal || <span className="text-sm font-bold text-muted-foreground">#{entry.position}</span>}
                </div>
                <Avatar className="w-9 h-9">
                  <AvatarImage src={entry.profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${isMe ? "text-primary" : "text-foreground"}`}>
                    {name} {isMe && <span className="text-xs font-normal text-muted-foreground">(você)</span>}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">{formatCurrency(entry.total_received)} recebido</span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">{receiveRate}% taxa</Badge>
                    {entry.breaks_count > 0 && (
                      <Badge variant="destructive" className="text-[10px] h-4 px-1.5">{entry.breaks_count} quebras</Badge>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-foreground">{entry.points.toLocaleString("pt-BR")}</p>
                  <p className="text-[10px] text-muted-foreground">pontos</p>
                </div>
              </div>
              <Progress value={progressPct} className="h-1.5" />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RankingTab;
