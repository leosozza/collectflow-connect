import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
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
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { Trophy, Star, Target, Flame, Settings, ShoppingBag, Coins, BarChart3, History, Calculator, HelpCircle } from "lucide-react";
import ScoringRulesTab from "@/components/gamificacao/ScoringRulesTab";
import CampaignsManagementTab from "@/components/gamificacao/CampaignsManagementTab";
import AchievementsManagementTab from "@/components/gamificacao/AchievementsManagementTab";
import GoalsManagementTab from "@/components/gamificacao/GoalsManagementTab";
import RankingManagementTab from "@/components/gamificacao/RankingManagementTab";
import ShopManagementTab from "@/components/gamificacao/ShopManagementTab";
import ParticipantsManagementTab from "@/components/gamificacao/ParticipantsManagementTab";

const medals = ["🥇", "🥈", "🥉"];

// Mapa de aba legada (?tab=...) para sub-rota nova.
const LEGACY_TAB_TO_PATH: Record<string, string> = {
  ranking: "ranking",
  campaigns: "campanhas",
  achievements: "conquistas",
  goals: "metas",
  shop: "loja",
  wallet: "carteira",
  history: "historico",
  manage: "gerenciar",
};

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
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { triggerGamificationUpdate } = useGamificationTrigger();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  useEffect(() => {
    // Defer to idle so it doesn't compete with initial header queries.
    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: { timeout: number }) => number)
      | undefined;
    let handle: number | NodeJS.Timeout;
    if (ric) {
      handle = ric(() => triggerGamificationUpdate(), { timeout: 2000 });
    } else {
      handle = setTimeout(() => triggerGamificationUpdate(), 0);
    }
    return () => {
      const cic = (window as any).cancelIdleCallback as ((h: number) => void) | undefined;
      if (ric && cic) cic(handle as number);
      else clearTimeout(handle as NodeJS.Timeout);
    };
  }, [triggerGamificationUpdate]);

  const adminPaths = ["ranking", "campanhas", "conquistas", "metas", "gerenciar"];
  const operatorPaths = ["ranking", "campanhas", "conquistas", "metas", "loja", "carteira", "historico"];
  const allowedPaths = isTenantAdmin ? adminPaths : operatorPaths;
  const defaultPath = isTenantAdmin ? "ranking" : "metas";

  // Sub-rota atual a partir da URL.
  const currentSub = (() => {
    const seg = location.pathname.replace(/^\/gamificacao\/?/, "").split("/")[0];
    return seg || "";
  })();

  // Redireciona /gamificacao puro ou aba inválida para o default.
  useEffect(() => {
    if (location.pathname === "/gamificacao" || location.pathname === "/gamificacao/") {
      navigate(`/gamificacao/${defaultPath}`, { replace: true });
      return;
    }
    if (currentSub && !allowedPaths.includes(currentSub)) {
      navigate(`/gamificacao/${defaultPath}`, { replace: true });
    }
  }, [location.pathname, currentSub, defaultPath, allowedPaths, navigate]);

  // Compat: ?tab=campaigns → /gamificacao/campanhas
  useEffect(() => {
    const legacy = searchParams.get("tab");
    if (legacy && LEGACY_TAB_TO_PATH[legacy]) {
      const next = LEGACY_TAB_TO_PATH[legacy];
      const params = new URLSearchParams(searchParams);
      params.delete("tab");
      setSearchParams(params, { replace: true });
      navigate(`/gamificacao/${next}`, { replace: true });
    }
  }, [searchParams, setSearchParams, navigate]);

  const { data: myPoints } = useQuery({
    queryKey: ["my-points", profile?.id, year, month],
    queryFn: () => fetchMyPoints(profile!.id, year, month),
    enabled: !isTenantAdmin && !!profile?.id,
    staleTime: 60_000,
  });

  const { data: ranking = [] } = useQuery({
    queryKey: ["ranking", year, month],
    queryFn: () => fetchRanking(year, month),
    staleTime: 60_000,
  });

  const { data: wallet } = useQuery({
    queryKey: ["rivocoin-wallet", profile?.id],
    queryFn: () => fetchMyWallet(profile!.id),
    enabled: !isTenantAdmin && !!profile?.id,
    staleTime: 120_000,
  });

  const { data: earnedAchievements = [] } = useQuery({
    queryKey: ["achievements", profile?.id],
    queryFn: () => fetchAllAchievements(profile!.id),
    enabled: !isTenantAdmin && !!profile?.id,
    staleTime: 120_000,
  });

  const { data: adminAchievementsCount = 0 } = useQuery({
    queryKey: ["all-achievements-count", tenant?.id],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("tenant_id", tenant!.id)
        .in("role", ["operador"] as any)
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
    staleTime: 120_000,
  });

  const { data: adminCampaigns = [] } = useQuery({
    queryKey: ["campaigns", tenant?.id],
    queryFn: () => fetchCampaigns(tenant?.id),
    enabled: isTenantAdmin && !!tenant?.id,
    staleTime: 60_000,
  });

  const { data: scoringRules = [] } = useQuery({
    queryKey: ["scoring-rules"],
    queryFn: fetchScoringRules,
    staleTime: 300_000,
  });

  const myRankEntry = ranking.find(r => r.operator_id === profile?.id);
  const myPosition = myRankEntry?.position;
  const myMedal = myPosition && myPosition <= 3 ? medals[myPosition - 1] : myPosition ? `#${myPosition}` : "—";

  const totalReceived = myPoints?.total_received || 0;
  const points = myPoints?.points || 0;
  const achievementsCount = earnedAchievements.length;
  const rivoBalance = wallet?.balance || 0;
  const adminParticipantsCount = ranking.length;
  const adminPointsTotal = useMemo(
    () => ranking.reduce((sum, entry) => sum + Number(entry.points || 0), 0),
    [ranking],
  );
  const adminReceivedTotal = useMemo(
    () => ranking.reduce((sum, entry) => sum + Number(entry.total_received || 0), 0),
    [ranking],
  );
  const activeCampaignsCount = useMemo(
    () => adminCampaigns.filter(isCampaignActive).length,
    [adminCampaigns],
  );

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

      {/* Tabs como rotas reais */}
      <nav className="flex flex-wrap items-center gap-1 rounded-md bg-muted p-1 w-full sm:w-fit">
        {[
          { to: "ranking", label: "Ranking", icon: Trophy, show: true },
          { to: "campanhas", label: "Campanhas", icon: Flame, show: true },
          { to: "conquistas", label: "Conquistas", icon: Star, show: true },
          { to: "metas", label: "Metas", icon: Target, show: true },
          { to: "loja", label: "Loja", icon: ShoppingBag, show: !isTenantAdmin },
          { to: "carteira", label: "Carteira", icon: Coins, show: !isTenantAdmin },
          { to: "historico", label: "Histórico", icon: History, show: !isTenantAdmin },
          { to: "gerenciar", label: "Gerenciar", icon: Settings, show: isTenantAdmin },
        ]
          .filter((t) => t.show)
          .map((t) => {
            const Icon = t.icon;
            return (
              <NavLink
                key={t.to}
                to={`/gamificacao/${t.to}`}
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "flex-1 sm:flex-none",
                    isActive
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )
                }
              >
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </NavLink>
            );
          })}
      </nav>

      <div className="mt-4">
        <Outlet />
      </div>
    </div>
  );
};

export const ManageSubTabs = () => {
  const [sub, setSub] = useState("manage-campaigns");
  return (
    <Tabs value={sub} onValueChange={setSub}>
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
        {sub === "manage-campaigns" && <CampaignsManagementTab />}
      </TabsContent>
      <TabsContent value="manage-achievements" className="mt-4">
        {sub === "manage-achievements" && <AchievementsManagementTab />}
      </TabsContent>
      <TabsContent value="manage-goals" className="mt-4">
        {sub === "manage-goals" && <GoalsManagementTab />}
      </TabsContent>
      <TabsContent value="manage-rankings" className="mt-4">
        {sub === "manage-rankings" && <RankingManagementTab />}
      </TabsContent>
      <TabsContent value="manage-shop" className="mt-4">
        {sub === "manage-shop" && <ShopManagementTab />}
      </TabsContent>
      <TabsContent value="manage-participants" className="mt-4">
        {sub === "manage-participants" && <ParticipantsManagementTab />}
      </TabsContent>
      <TabsContent value="manage-scoring" className="mt-4">
        {sub === "manage-scoring" && <ScoringRulesTab />}
      </TabsContent>
    </Tabs>
  );
};

export default GamificacaoPage;
