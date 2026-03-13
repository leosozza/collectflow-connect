import { useQuery } from "@tanstack/react-query";
import { fetchLeads, fetchOpportunities, fetchPipelineStages } from "@/services/crmService";
import { Users, UserCheck, TrendingUp, DollarSign, CheckCircle2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Funnel, FunnelChart, LabelList } from "recharts";

const COLORS = ["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#22c55e"];

const CRMReportsPage = () => {
  const { data: leads = [] } = useQuery({ queryKey: ["crm-leads"], queryFn: fetchLeads });
  const { data: opportunities = [] } = useQuery({ queryKey: ["crm-opportunities"], queryFn: fetchOpportunities });
  const { data: stages = [] } = useQuery({ queryKey: ["crm-stages"], queryFn: fetchPipelineStages });

  const totalLeads = leads.length;
  const qualifiedLeads = leads.filter(l => l.status === "qualificado" || l.status === "negociando").length;
  const convertedLeads = leads.filter(l => l.status === "convertido").length;
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;
  const inNegotiation = opportunities.filter(o => o.status === "open").reduce((s, o) => s + (o.estimated_value || 0), 0);
  const wonValue = opportunities.filter(o => o.status === "won").reduce((s, o) => s + (o.estimated_value || 0), 0);

  // Pipeline by stage
  const pipelineByStage = stages.map(s => ({
    name: s.name,
    count: opportunities.filter(o => o.stage_id === s.id && o.status === "open").length,
    value: opportunities.filter(o => o.stage_id === s.id && o.status === "open").reduce((acc, o) => acc + (o.estimated_value || 0), 0),
    color: s.color,
  }));

  // Origin pie
  const originMap = new Map<string, number>();
  leads.forEach(l => { const o = l.lead_origin || "Não informado"; originMap.set(o, (originMap.get(o) || 0) + 1); });
  const originData = Array.from(originMap, ([name, value]) => ({ name, value }));

  const kpis = [
    { label: "Leads Criados", value: totalLeads, icon: Users, color: "text-blue-600" },
    { label: "Leads Qualificados", value: qualifiedLeads, icon: UserCheck, color: "text-amber-600" },
    { label: "Taxa de Conversão", value: `${conversionRate}%`, icon: TrendingUp, color: "text-primary" },
    { label: "Valor em Negociação", value: inNegotiation.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), icon: DollarSign, color: "text-emerald-600" },
    { label: "Valor Fechado", value: wonValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), icon: CheckCircle2, color: "text-green-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Relatórios Comerciais</h2>
        <p className="text-muted-foreground text-sm">Indicadores e métricas de vendas</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map(kpi => (
          <div key={kpi.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full bg-muted flex items-center justify-center ${kpi.color}`}>
              <kpi.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
              <p className="text-lg font-bold text-foreground">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline by stage */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-foreground mb-4">Pipeline por Etapa</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={pipelineByStage}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {pipelineByStage.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Origin */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-foreground mb-4">Origem dos Leads</h3>
          {originData.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={originData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                  {originData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Funnel */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="font-semibold text-foreground mb-4">Funil de Conversão</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[
            { label: "Leads", value: totalLeads, color: "bg-blue-500" },
            { label: "Qualificados", value: qualifiedLeads, color: "bg-amber-500" },
            { label: "Em Negociação", value: leads.filter(l => l.status === "negociando").length, color: "bg-primary" },
            { label: "Convertidos", value: convertedLeads, color: "bg-emerald-500" },
          ].map((step, i) => (
            <div key={step.label} className="text-center">
              <div className={`${step.color} text-white rounded-xl py-6 text-2xl font-bold mb-2`} style={{ opacity: 1 - i * 0.15 }}>
                {step.value}
              </div>
              <p className="text-sm font-medium text-foreground">{step.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CRMReportsPage;
