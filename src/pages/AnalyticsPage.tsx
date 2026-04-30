import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, DollarSign, Filter, Users, MessageSquare, ShieldAlert, Brain } from "lucide-react";
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
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const isOperator = profile?.role !== "admin";

  const f = useAnalyticsFilters(tenant?.id);

  // Canal e Score visíveis apenas em abas relevantes
  const showChannel = ["funil", "performance", "canais"].includes(f.tab);
  const showScore = ["funil", "inteligencia"].includes(f.tab);

  if (!tenant?.id || !f.rpcParams) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Analytics</h1>
        </div>
        <div className="bg-card rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
          Carregando contexto do tenant…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Analytics</h1>
        </div>
      </div>

      <AnalyticsFiltersBar
        tenantId={tenant.id}
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
          {f.tab === "receita" && <RevenueTab params={f.rpcParams} periodDays={f.periodDays} />}
        </TabsContent>
        <TabsContent value="funil" className="mt-4">
          {f.tab === "funil" && <FunnelTab params={f.rpcParams} />}
        </TabsContent>
        <TabsContent value="performance" className="mt-4">
          {f.tab === "performance" && <PerformanceTab params={f.rpcParams} />}
        </TabsContent>
        <TabsContent value="canais" className="mt-4">
          {f.tab === "canais" && <ChannelsTab params={f.rpcParams} />}
        </TabsContent>
        <TabsContent value="qualidade" className="mt-4">
          {f.tab === "qualidade" && <QualityTab params={f.rpcParams} />}
        </TabsContent>
        <TabsContent value="inteligencia" className="mt-4">
          {f.tab === "inteligencia" && <IntelligenceTab params={f.rpcParams} />}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalyticsPage;
