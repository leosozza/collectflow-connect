import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useEffectiveTenantId } from "@/hooks/useEffectiveTenantId";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, DollarSign, Filter, Users, MessageSquare, ShieldAlert, Brain, Headphones } from "lucide-react";
import { useAnalyticsFilters } from "@/hooks/useAnalyticsFilters";
import { AnalyticsFiltersBar } from "@/components/analytics/AnalyticsFiltersBar";
import { RevenueTab } from "@/components/analytics/tabs/RevenueTab";
import { FunnelTab } from "@/components/analytics/tabs/FunnelTab";
import { PerformanceTab } from "@/components/analytics/tabs/PerformanceTab";
import { ChannelsTab } from "@/components/analytics/tabs/ChannelsTab";
import { QualityTab } from "@/components/analytics/tabs/QualityTab";
import { IntelligenceTab } from "@/components/analytics/tabs/IntelligenceTab";

const AnalyticsPage = () => {
  const { profile } = useAuth();
  const { canViewAllAnalytics, canViewOwnAnalytics } = usePermissions();
  const { tenantId, isSupportMode, supportTenantName } = useEffectiveTenantId();
  const navigate = useNavigate();

  // Regra de escopo:
  //  - Super admin em modo suporte → vê tudo do tenant alvo (sem _operator_ids).
  //  - canViewAllAnalytics → vê tudo do tenant.
  //  - canViewOwnAnalytics (sem all) → escopa em [profile.user_id].
  //  - Sem nenhuma das duas e sem suporte → bloqueado.
  const hasAccess = isSupportMode || canViewAllAnalytics || canViewOwnAnalytics;
  const restrictToSelf = !isSupportMode && !canViewAllAnalytics && canViewOwnAnalytics;
  const isOperator = restrictToSelf;

  const f = useAnalyticsFilters(tenantId);

  const scopedRpcParams = f.rpcParams
    ? (restrictToSelf && profile?.user_id
        ? { ...f.rpcParams, _operator_ids: [profile.user_id] }
        : f.rpcParams)
    : null;

  const showChannel = ["funil", "performance", "canais"].includes(f.tab);
  const showScore = ["funil", "inteligencia"].includes(f.tab);

  // Sem permissão alguma → tela bloqueada
  if (!hasAccess) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Analytics</h1>
        </div>
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <ShieldAlert className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">Sem permissão para Analytics</p>
          <p className="text-xs text-muted-foreground">
            Solicite ao seu administrador acesso a "Visualizar (Próprio)" ou "Visualizar (Todos)" no módulo Analytics.
          </p>
        </div>
      </div>
    );
  }

  if (!tenantId || !scopedRpcParams) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Analytics</h1>
        </div>
        <div className="bg-card rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
          {isSupportMode
            ? "Selecione um tenant no Modo Suporte para ver o Analytics."
            : "Carregando contexto do tenant…"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {isSupportMode && (
        <div className="bg-amber-500/15 border border-amber-500/40 rounded-lg px-3 py-2 flex items-center gap-2">
          <Headphones className="w-4 h-4 text-amber-700 dark:text-amber-300" />
          <p className="text-xs text-amber-900 dark:text-amber-200">
            Modo suporte — visualizando tenant <strong>{supportTenantName || tenantId}</strong>.
          </p>
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Analytics</h1>
        </div>
      </div>

      <AnalyticsFiltersBar
        tenantId={tenantId}
        isOperator={isOperator}
        showChannel={showChannel}
        showScore={showScore}
        dateFrom={f.dateFrom}
        dateTo={f.dateTo}
        credores={f.credores}
        operators={f.operators}
        channels={f.channels}
        scoreMin={f.scoreMin}
        scoreMax={f.scoreMax}
        setDateFrom={f.setDateFrom}
        setDateTo={f.setDateTo}
        setCredores={f.setCredores}
        setOperators={f.setOperators}
        setChannels={f.setChannels}
        setScoreMin={f.setScoreMin}
        setScoreMax={f.setScoreMax}
      />

      <Tabs value={f.tab} onValueChange={f.setTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="receita" className="gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Receita</TabsTrigger>
          <TabsTrigger value="funil" className="gap-1.5"><Filter className="w-3.5 h-3.5" /> Funil de Cobrança</TabsTrigger>
          <TabsTrigger value="performance" className="gap-1.5"><Users className="w-3.5 h-3.5" /> Operadores</TabsTrigger>
          <TabsTrigger value="canais" className="gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> Canais</TabsTrigger>
          <TabsTrigger value="qualidade" className="gap-1.5"><ShieldAlert className="w-3.5 h-3.5" /> Quebras & Risco</TabsTrigger>
          <TabsTrigger value="inteligencia" className="gap-1.5"><Brain className="w-3.5 h-3.5" /> Score & Propensão</TabsTrigger>
        </TabsList>

        <TabsContent value="receita" className="mt-4">
          {f.tab === "receita" && <RevenueTab params={scopedRpcParams} periodDays={f.periodDays} />}
        </TabsContent>
        <TabsContent value="funil" className="mt-4">
          {f.tab === "funil" && <FunnelTab params={scopedRpcParams} />}
        </TabsContent>
        <TabsContent value="performance" className="mt-4">
          {f.tab === "performance" && <PerformanceTab params={scopedRpcParams} />}
        </TabsContent>
        <TabsContent value="canais" className="mt-4">
          {f.tab === "canais" && <ChannelsTab params={scopedRpcParams} />}
        </TabsContent>
        <TabsContent value="qualidade" className="mt-4">
          {f.tab === "qualidade" && <QualityTab params={scopedRpcParams} />}
        </TabsContent>
        <TabsContent value="inteligencia" className="mt-4">
          {f.tab === "inteligencia" && <IntelligenceTab params={scopedRpcParams} />}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalyticsPage;
