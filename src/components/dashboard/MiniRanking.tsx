import { useQuery } from "@tanstack/react-query";
import { fetchRanking, RankingEntry } from "@/services/gamificationService";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";

const medals = ["🥇", "🥈", "🥉"];

const MiniRanking = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const now = new Date();

  const { data: ranking = [] } = useQuery({
    queryKey: ["ranking", now.getFullYear(), now.getMonth() + 1],
    queryFn: () => fetchRanking(now.getFullYear(), now.getMonth() + 1),
    staleTime: 60_000,
  });

  const top5 = ranking.slice(0, 5);
  const myEntry = ranking.find(r => r.operator_id === profile?.id);
  const myPosition = myEntry?.position;

  if (top5.length === 0) return null;

  return (
    <Card className="border-border">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" />
          Ranking do Mês
        </CardTitle>
        <button
          onClick={() => navigate("/gamificacao")}
          className="text-xs text-primary hover:underline"
        >
          Ver tudo
        </button>
      </CardHeader>
      <CardContent className="space-y-2 pb-4">
        {top5.map((entry: RankingEntry) => {
          const isMe = entry.operator_id === profile?.id;
          const medal = entry.position && entry.position <= 3 ? medals[entry.position - 1] : `#${entry.position}`;
          const name = entry.profile?.full_name || "Operador";
          const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

          return (
            <div
              key={entry.id}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                isMe ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50"
              }`}
            >
              <span className="text-base w-6 text-center">{medal}</span>
              <Avatar className="w-7 h-7">
                <AvatarImage src={entry.profile?.avatar_url || undefined} />
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium truncate ${isMe ? "text-primary" : "text-foreground"}`}>
                  {name} {isMe && <span className="text-[10px] text-muted-foreground">(você)</span>}
                </p>
                <p className="text-[10px] text-muted-foreground">{formatCurrency(entry.total_received)} recebido</p>
              </div>
              <span className="text-xs font-bold text-foreground">{entry.points.toLocaleString("pt-BR")} pts</span>
            </div>
          );
        })}

        {myPosition && myPosition > 5 && myEntry && (
          <div className="mt-1 pt-2 border-t border-border">
            <div className="flex items-center gap-3 rounded-lg px-3 py-2 bg-primary/10 border border-primary/20">
              <span className="text-sm w-6 text-center text-muted-foreground font-bold">#{myPosition}</span>
              <div className="flex-1">
                <p className="text-xs font-medium text-primary">Você</p>
                <p className="text-[10px] text-muted-foreground">{formatCurrency(myEntry.total_received)} recebido</p>
              </div>
              <span className="text-xs font-bold text-foreground">{myEntry.points.toLocaleString("pt-BR")} pts</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MiniRanking;
