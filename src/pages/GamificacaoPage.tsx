import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { fetchMyPoints, fetchRanking, fetchAllAchievements } from "@/services/gamificationService";
import { fetchMyGoal } from "@/services/goalService";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { Trophy, Star, BarChart3, Target, Flame, Settings } from "lucide-react";
import RankingTab from "@/components/gamificacao/RankingTab";
import AchievementsTab from "@/components/gamificacao/AchievementsTab";
import CampaignsTab from "@/components/gamificacao/CampaignsTab";
import GoalsTab from "@/components/gamificacao/GoalsTab";
import GoalsManagementTab from "@/components/gamificacao/GoalsManagementTab";
import AchievementsManagementTab from "@/components/gamificacao/AchievementsManagementTab";
import CampaignsManagementTab from "@/components/gamificacao/CampaignsManagementTab";

const medals = ["🥇", "🥈", "🥉"];

const GamificacaoPage = () => {
  const { profile } = useAuth();
  const { isTenantAdmin } = useTenant();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const { data: myPoints } = useQuery({
    queryKey: ["my-points", profile?.id, year, month],
    queryFn: () => fetchMyPoints(profile!.id, year, month),
    enabled: !!profile?.id,
  });

  const { data: ranking = [] } = useQuery({
    queryKey: ["ranking", year, month],
    queryFn: () => fetchRanking(year, month),
  });

  const { data: goal } = useQuery({
    queryKey: ["my-goal", year, month],
    queryFn: () => fetchMyGoal(year, month),
  });

  const { data: earnedAchievements = [] } = useQuery({
    queryKey: ["achievements", profile?.id],
    queryFn: () => fetchAllAchievements(profile!.id),
    enabled: !!profile?.id,
  });

  const myRankEntry = ranking.find(r => r.operator_id === profile?.id);
  const myPosition = myRankEntry?.position;
  const myMedal = myPosition && myPosition <= 3 ? medals[myPosition - 1] : myPosition ? `#${myPosition}` : "—";

  const totalReceived = myPoints?.total_received || 0;
  const goalAmount = goal?.target_amount || 0;
  const goalProgress = goalAmount > 0 ? Math.min(100, Math.round((totalReceived / goalAmount) * 100)) : 0;
  const points = myPoints?.points || 0;
  const achievementsCount = earnedAchievements.length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gamificação</h1>
        <p className="text-muted-foreground text-sm">Seu desempenho e ranking do mês</p>
      </div>

      {/* My stats hero */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <div className="text-3xl mb-1">{myMedal}</div>
            <p className="text-2xl font-bold text-foreground">{myPosition ? `${myPosition}º` : "—"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Posição no mês</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <Trophy className="w-6 h-6 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{points.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Pontos totais</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <Star className="w-6 h-6 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{achievementsCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Conquistas</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <BarChart3 className="w-6 h-6 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{formatCurrency(totalReceived)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Recebido no mês</p>
          </CardContent>
        </Card>
      </div>

      {/* Goal progress */}
      {goalAmount > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Meta do Mês
              {goalProgress >= 100 && (
                <Badge className="text-[10px] h-5 px-1.5 ml-1">🏆 Atingida!</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2 text-sm">
              <span className="text-muted-foreground">{formatCurrency(totalReceived)} recebido</span>
              <span className="font-semibold text-foreground">{goalProgress}% de {formatCurrency(goalAmount)}</span>
            </div>
            <Progress value={goalProgress} className="h-3" />
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="ranking">
        <TabsList className="w-full sm:w-auto flex-wrap">
          <TabsTrigger value="ranking" className="flex-1 sm:flex-none gap-1.5">
            <Trophy className="w-3.5 h-3.5" /> Ranking
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="flex-1 sm:flex-none gap-1.5">
            <Flame className="w-3.5 h-3.5" /> Campanhas
          </TabsTrigger>
          <TabsTrigger value="achievements" className="flex-1 sm:flex-none gap-1.5">
            <Star className="w-3.5 h-3.5" /> Conquistas
          </TabsTrigger>
          <TabsTrigger value="goals" className="flex-1 sm:flex-none gap-1.5">
            <Target className="w-3.5 h-3.5" /> Metas
          </TabsTrigger>
          {isTenantAdmin && (
            <TabsTrigger value="manage" className="flex-1 sm:flex-none gap-1.5">
              <Settings className="w-3.5 h-3.5" /> Gerenciar
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="ranking" className="mt-4">
          <RankingTab />
        </TabsContent>

        <TabsContent value="campaigns" className="mt-4">
          <CampaignsTab />
        </TabsContent>

        <TabsContent value="achievements" className="mt-4">
          <AchievementsTab isAdmin={isTenantAdmin} />
        </TabsContent>

        <TabsContent value="goals" className="mt-4">
          <GoalsTab />
        </TabsContent>

        {isTenantAdmin && (
          <TabsContent value="manage" className="mt-4">
            <Tabs defaultValue="manage-campaigns">
              <TabsList>
                <TabsTrigger value="manage-campaigns" className="gap-1.5">
                  <Flame className="w-3.5 h-3.5" /> Campanhas
                </TabsTrigger>
                <TabsTrigger value="manage-achievements" className="gap-1.5">
                  <Star className="w-3.5 h-3.5" /> Conquistas
                </TabsTrigger>
                <TabsTrigger value="manage-goals" className="gap-1.5">
                  <Target className="w-3.5 h-3.5" /> Metas
                </TabsTrigger>
              </TabsList>

              <TabsContent value="manage-campaigns" className="mt-4">
                <CampaignsManagementTab />
              </TabsContent>

              <TabsContent value="manage-achievements" className="mt-4">
                <AchievementsManagementTab />
              </TabsContent>

              <TabsContent value="manage-goals" className="mt-4">
                <GoalsManagementTab />
              </TabsContent>
            </Tabs>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default GamificacaoPage;
