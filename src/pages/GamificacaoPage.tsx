import { useEffect } from "react";
import { useUrlState } from "@/hooks/useUrlState";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useGamificationTrigger } from "@/hooks/useGamificationTrigger";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyPoints, fetchRanking, fetchAllAchievements } from "@/services/gamificationService";
import { fetchMyWallet } from "@/services/rivocoinService";
import { fetchScoringRules } from "@/services/scoringRulesService";
import { fetchCampaigns, Campaign } from "@/services/campaignService";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import { Trophy, Star, Target, Flame, Settings, ShoppingBag, Coins, BarChart3, History, Calculator, HelpCircle } from "lucide-react";
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
const adminTabs = ["ranking", "campaigns", "achievements", "goals", "manage"];
const operatorTabs = ["ranking", "campaigns", "achievements", "goals", "shop", "wallet", "history"];

const isValidDate = (s?: string | null) => {
  if (!s) return false;
  const ts = Date.parse(s);
  if (isNaN(ts)) return false;
  const y = new Date(ts).getFullYear();
  return y >= 2000 && y <= 2100;
};

const isCampaignActive = (campaign: Campaign) => {
  if (campaign.status !== "ativa") return false;
  if (!isValidDate(campaign.start_date) || !isValidDate(campaign.end_date)) return false;
  return new Date(campaign.end_date).getTime() >= new Date(new Date().toDateString()).getTime();
};

const GamificacaoPage = () => {
  const { profile } = useAuth();
  const { tenant, isTenantAdmin } = useTenant();
  const [urlTab, setUrlTab] = useUrlState("tab", "");
  const { triggerGamificationUpdate } = useGamificationTrigger();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  useEffect(() => {
    triggerGamificationUpdate();
  }, [triggerGamificationUpdate]);

  const allowedTabs = isTenantAdmin ? adminTabs : operatorTabs;
  const defaultTab = isTenantAdmin ? "ranking" : "goals";
  const currentTab = urlTab && allowedTabs.includes(urlTab) ? urlTab : defaultTab;

  useEffect(() => {
    if (urlTab && !allowedTabs.includes(urlTab)) {
      setUrlTab(defaultTab);
    }
  }, [urlTab, defaultTab, setUrlTab, isTenantAdmin]);

  const { data: myPoints } = useQuery({
    queryKey: ["my-points", profile?.id, year, month],
    queryFn: () => fetchMyPoints(profile!.id, year, month),
    enabled: !isTenantAdmin && !!profile?.id,
  });

  const { data: ranking = [] } = useQuery({
    queryKey: ["ranking", year, month],
    queryFn: () => fetchRanking(year, month),
  });

  const { data: wallet } = useQuery({
    queryKey: ["rivocoin-wallet", profile?.id],
    queryFn: () => fetchMyWallet(profile!.id),
    enabled: !isTenantAdmin && !!profile?.id,
  });

  const { data: earnedAchievements = [] } = useQuery({
    queryKey: ["achievements", profile?.id],
    queryFn: () => fetchAllAchievements(profile!.id),
    enabled: !isTenantAdmin && !!profile?.id,
  });

  const { data: adminAchievementsCount = 0 } = useQuery({
    queryKey: ["all-achievements-count", tenant?.id],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("tenant_id", tenant!.id)
        .in("role", ["operador", "supervisor", "gerente"] as any)
        .range(0, 999);
      const profileIds = (profiles || []).map((p: any) => p.id);
      if (profileIds.length === 0) return 0;
      const { count, error } = await supabase
        .from("achievements")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant!.id)
        .in("profile_id", profileIds);
      if (error) throw error;
      return count || 0;
    },
    enabled: isTenantAdmin && !!tenant?.id,
  });

  const { data: adminCampaigns = [] } = useQuery({
    queryKey: ["campaigns", tenant?.id],
    queryFn: () => fetchCampaigns(tenant?.id),
    enabled: isTenantAdmin && !!tenant?.id,
  });

  const { data: scoringRules = [] } = useQuery({
    queryKey: ["scoring-rules"],
    queryFn: fetchScoringRules,
  });

  const myRankEntry = ranking.find(r => r.operator_id === profile?.id);
  const myPosition = myRankEntry?.position;
  const myMedal = myPosition && myPosition <= 3 ? medals[myPosition - 1] : myPosition ? `#${myPosition}` : "—";

  const totalReceived = myPoints?.total_received || 0;
  const points = myPoints?.points || 0;
  const achievementsCount = earnedAchievements.length;
  const rivoBalance = wallet?.balance || 0;
  const adminParticipantsCount = ranking.length;
  const adminPointsTotal = ranking.reduce((sum, entry) => sum + Number(entry.points || 0), 0);
  const adminReceivedTotal = ranking.reduce((sum, entry) => sum + Number(entry.total_received || 0), 0);
  const activeCampaignsCount = adminCampaigns.filter(isCampaignActive).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gamificação</h1>
        <p className="text-muted-foreground text-sm">
          {isTenantAdmin ? "Visão geral da equipe e gestão da gamificação" : "Seu desempenho e ranking do mês"}
        </p>
      </div>

      {isTenantAdmin ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <Card className="border-border">
            <CardContent className="p-4 text-center">
              <Target className="w-6 h-6 text-primary mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{adminParticipantsCount.toLocaleString("pt-BR")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Participantes ranqueados</p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-4 text-center">
              <Trophy className="w-6 h-6 text-primary mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{adminPointsTotal.toLocaleString("pt-BR")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Pontos da equipe</p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-4 text-center">
              <Star className="w-6 h-6 text-primary mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{adminAchievementsCount.toLocaleString("pt-BR")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Conquistas concedidas</p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-4 text-center">
              <BarChart3 className="w-6 h-6 text-primary mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{formatCurrency(adminReceivedTotal)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Recebido da equipe</p>
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 text-center">
              <Flame className="w-6 h-6 text-primary mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{activeCampaignsCount.toLocaleString("pt-BR")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Campanhas ativas</p>
            </CardContent>
          </Card>
        </div>
      ) : (
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <div className="text-3xl mb-1">{myMedal}</div>
            <p className="text-2xl font-bold text-foreground">{myPosition ? `${myPosition}º` : "—"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Posição no mês</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 text-center relative">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6 text-muted-foreground hover:text-foreground"
                  aria-label="Como os pontos são calculados"
                >
                  <HelpCircle className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">Como você ganha pontos</p>
                  <p className="text-xs text-muted-foreground">
                    Regras configuradas pelo administrador para o mês atual:
                  </p>
                  <ul className="space-y-1.5 mt-2">
                    {scoringRules.filter(r => r.enabled).length === 0 && (
                      <li className="text-xs text-muted-foreground">Nenhuma regra ativa.</li>
                    )}
                    {scoringRules.filter(r => r.enabled).map(r => (
                      <li key={r.id} className="flex items-start justify-between gap-3 text-xs">
                        <span className="text-foreground flex-1">{r.label}</span>
                        <span className={`font-mono font-semibold whitespace-nowrap ${r.points < 0 ? "text-destructive" : "text-primary"}`}>
                          {r.points > 0 ? "+" : ""}{r.points} pts
                          {r.unit_size > 1 && <span className="text-muted-foreground"> /{r.unit_size}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </PopoverContent>
            </Popover>
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
      )}

      {/* Tabs */}
      <Tabs defaultValue={defaultTab} onValueChange={setUrlTab} value={currentTab}>
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
          {!isTenantAdmin && (
            <>
              <TabsTrigger value="shop" className="flex-1 sm:flex-none gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5" /> Loja
              </TabsTrigger>
              <TabsTrigger value="wallet" className="flex-1 sm:flex-none gap-1.5">
                <Coins className="w-3.5 h-3.5" /> Carteira
              </TabsTrigger>
              <TabsTrigger value="history" className="flex-1 sm:flex-none gap-1.5">
                <History className="w-3.5 h-3.5" /> Histórico
              </TabsTrigger>
            </>
          )}
          {isTenantAdmin && (
            <TabsTrigger value="manage" className="flex-1 sm:flex-none gap-1.5">
              <Settings className="w-3.5 h-3.5" /> Gerenciar
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="ranking" className="mt-4">
          <RankingTab highlightCurrentUser={!isTenantAdmin} />
        </TabsContent>

        <TabsContent value="campaigns" className="mt-4">
          <CampaignsTab highlightCurrentUser={!isTenantAdmin} />
        </TabsContent>

        <TabsContent value="achievements" className="mt-4">
          <AchievementsTab isAdmin={isTenantAdmin} />
        </TabsContent>

        <TabsContent value="goals" className="mt-4">
          <GoalsTab />
        </TabsContent>

        {!isTenantAdmin && (
          <>
            <TabsContent value="shop" className="mt-4">
              <ShopTab />
            </TabsContent>

            <TabsContent value="wallet" className="mt-4">
              <WalletTab />
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <PointsHistoryTab />
            </TabsContent>
          </>
        )}

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
