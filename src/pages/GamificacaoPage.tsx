import { useEffect } from "react";
import { useUrlState } from "@/hooks/useUrlState";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useGamificationTrigger } from "@/hooks/useGamificationTrigger";
import { fetchMyPoints, fetchRanking, fetchAllAchievements } from "@/services/gamificationService";
import { fetchMyGoal } from "@/services/goalService";
import { fetchMyWallet } from "@/services/rivocoinService";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { Trophy, Star, Target, Flame, Settings, ShoppingBag, Coins, BarChart3, History, Calculator } from "lucide-react";
import ScoringRulesTab from "@/components/gamificacao/ScoringRulesTab";
import RankingTab from "@/components/gamificacao/RankingTab";
import AchievementsTab from "@/components/gamificacao/AchievementsTab";
import CampaignsTab from "@/components/gamificacao/CampaignsTab";
import GoalsTab from "@/components/gamificacao/GoalsTab";
import ShopTab from "@/components/gamificacao/ShopTab";
import WalletTab from "@/components/gamificacao/WalletTab";
import PointsHistoryTab from "@/components/gamificacao/PointsHistoryTab";
import GoalsManagementTab from "@/components/gamificacao/GoalsManagementTab";
import AchievementsManagementTab from "@/components/gamificacao/AchievementsManagementTab";
import CampaignsManagementTab from "@/components/gamificacao/CampaignsManagementTab";
import ShopManagementTab from "@/components/gamificacao/ShopManagementTab";
import RankingManagementTab from "@/components/gamificacao/RankingManagementTab";
import ParticipantsManagementTab from "@/components/gamificacao/ParticipantsManagementTab";

const medals = ["🥇", "🥈", "🥉"];

const GamificacaoPage = () => {
  const { profile } = useAuth();
  const { isTenantAdmin } = useTenant();
  const [urlTab, setUrlTab] = useUrlState("tab", "");
  const { triggerGamificationUpdate } = useGamificationTrigger();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  useEffect(() => {
    triggerGamificationUpdate();
  }, [triggerGamificationUpdate]);

  const { data: myPoints } = useQuery({
    queryKey: ["my-points", profile?.id, year, month],
    queryFn: () => fetchMyPoints(profile!.id, year, month),
    enabled: !!profile?.id,
  });

  const { data: ranking = [] } = useQuery({
    queryKey: ["ranking", year, month],
    queryFn: () => fetchRanking(year, month),
  });

  const { data: wallet } = useQuery({
    queryKey: ["rivocoin-wallet", profile?.id],
    queryFn: () => fetchMyWallet(profile!.id),
    enabled: !!profile?.id,
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
  const points = myPoints?.points || 0;
  const achievementsCount = earnedAchievements.length;
  const rivoBalance = wallet?.balance || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gamificação</h1>
        <p className="text-muted-foreground text-sm">Seu desempenho e ranking do mês</p>
      </div>

      {/* My stats hero */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
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

        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 text-center">
            <Coins className="w-6 h-6 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{rivoBalance.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">RivoCoins</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={urlTab || (isTenantAdmin ? "ranking" : "goals")} onValueChange={setUrlTab} value={urlTab || undefined}>
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
          <TabsTrigger value="shop" className="flex-1 sm:flex-none gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5" /> Loja
          </TabsTrigger>
          <TabsTrigger value="wallet" className="flex-1 sm:flex-none gap-1.5">
            <Coins className="w-3.5 h-3.5" /> Carteira
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1 sm:flex-none gap-1.5">
            <History className="w-3.5 h-3.5" /> Histórico
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
          <AchievementsTab isAdmin={false} />
        </TabsContent>

        <TabsContent value="goals" className="mt-4">
          <GoalsTab />
        </TabsContent>

        <TabsContent value="shop" className="mt-4">
          <ShopTab />
        </TabsContent>

        <TabsContent value="wallet" className="mt-4">
          <WalletTab />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <PointsHistoryTab />
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
                <TabsTrigger value="manage-rankings" className="gap-1.5">
                  <Trophy className="w-3.5 h-3.5" /> Rankings
                </TabsTrigger>
                <TabsTrigger value="manage-shop" className="gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5" /> Loja
                </TabsTrigger>
                <TabsTrigger value="manage-participants" className="gap-1.5">
                  <Target className="w-3.5 h-3.5" /> Participantes
                </TabsTrigger>
                <TabsTrigger value="manage-scoring" className="gap-1.5">
                  <Calculator className="w-3.5 h-3.5" /> Pontuação
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

              <TabsContent value="manage-rankings" className="mt-4">
                <RankingManagementTab />
              </TabsContent>

              <TabsContent value="manage-shop" className="mt-4">
                <ShopManagementTab />
              </TabsContent>

              <TabsContent value="manage-participants" className="mt-4">
                <ParticipantsManagementTab />
              </TabsContent>

              <TabsContent value="manage-scoring" className="mt-4">
                <ScoringRulesTab />
              </TabsContent>
            </Tabs>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default GamificacaoPage;
