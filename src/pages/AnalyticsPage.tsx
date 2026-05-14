import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useEffectiveTenantId } from "@/hooks/useEffectiveTenantId";
import { ShieldAlert, DollarSign, Filter, Users, MessageSquare, Brain, Headphones } from "lucide-react";
import { useAnalyticsFilters } from "@/hooks/useAnalyticsFilters";
import { AnalyticsFiltersBar } from "@/components/analytics/AnalyticsFiltersBar";
import { RevenueTab } from "@/components/analytics/tabs/RevenueTab";
import { FunnelTab } from "@/components/analytics/tabs/FunnelTab";
import { PerformanceTab } from "@/components/analytics/tabs/PerformanceTab";
import { ChannelsTab } from "@/components/analytics/tabs/ChannelsTab";
import { QualityTab } from "@/components/analytics/tabs/QualityTab";
import { IntelligenceTab } from "@/components/analytics/tabs/IntelligenceTab";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "receita", label: "Receita", icon: DollarSign },
  { key: "funil", label: "Funil de Cobrança", icon: Filter },
  { key: "performance", label: "Operadores", icon: Users },
  { key: "canais", label: "Canais", icon: MessageSquare },
  { key: "qualidade", label: "Quebras & Risco", icon: ShieldAlert },
  { key: "inteligencia", label: "Score & Propensão", icon: Brain },
];

const AnalyticsPage = () => {
  const { profile } = useAuth();
  const { canViewAllAnalytics, canViewOwnAnalytics } = usePermissions();
  const { tenantId, isSupportMode, supportTenantName } = useEffectiveTenantId();
  const navigate = useNavigate();
  const { analyticsTab } = useParams<{ analyticsTab?: string }>();
  const [searchParams] = useSearchParams();

  const hasAccess = isSupportMode || canViewAllAnalytics || canViewOwnAnalytics;
  const restrictToSelf = !isSupportMode && !canViewAllAnalytics && canViewOwnAnalytics;
  const isOperator = restrictToSelf;

  const f = useAnalyticsFilters(tenantId);

  // Retrocompat: /analytics?tab=funil → /analytics/funil
  useEffect(() => {
    const legacy = searchParams.get("tab");
    if (legacy && !analyticsTab) {
      navigate(`/analytics/${legacy}`, { replace: true });
    }
  }, [searchParams, analyticsTab, navigate]);

  const activeTab = TABS.find((t) => t.key === analyticsTab)?.key || "receita";

  const scopedRpcParams = f.rpcParams
    ? (restrictToSelf && profile?.user_id
        ? { ...f.rpcParams, _operator_ids: [profile.user_id] }
        : f.rpcParams)
    : null;

  const showChannel = ["funil", "performance", "canais"].includes(activeTab);
  const showScore = ["funil", "inteligencia"].includes(activeTab);

  if (!hasAccess) {
    return (
      <div className="space-y-5 animate-fade-in">
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

      {/* Navegação Horizontal Premium (padrão Cadastros) */}
      <nav className="flex flex-wrap items-center gap-1 border-b border-border pb-px">
        {TABS.map((item) => {
          const isActive = activeTab === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => navigate(`/analytics/${item.key}?${searchParams.toString()}`)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all relative rounded-t-lg",
                isActive
                  ? "bg-primary/10 text-primary border-b-[3px] border-primary"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border-b-[3px] border-transparent"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

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

      <div className="mt-2">
        {activeTab === "receita" && <RevenueTab params={scopedRpcParams} periodDays={f.periodDays} />}
        {activeTab === "funil" && <FunnelTab params={scopedRpcParams} />}
        {activeTab === "performance" && <PerformanceTab params={scopedRpcParams} />}
        {activeTab === "canais" && <ChannelsTab params={scopedRpcParams} />}
        {activeTab === "qualidade" && <QualityTab params={scopedRpcParams} />}
        {activeTab === "inteligencia" && <IntelligenceTab params={scopedRpcParams} />}
      </div>
    </div>
  );
};

export default AnalyticsPage;
