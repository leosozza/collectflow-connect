import { CampaignWithStats, fetchRecipientStatusCounts, fetchInstanceMetrics } from "@/services/campaignManagementService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, CheckCircle, XCircle, Users, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useQuery } from "@tanstack/react-query";

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  sending: "Enviando",
  completed: "Concluída",
  completed_with_errors: "Concluída c/ erros",
  failed: "Falhou",
  paused: "Pausada",
  cancelled: "Cancelada",
};

const originLabels: Record<string, string> = {
  carteira: "Carteira",
  automacao: "Automação",
  fluxo: "Fluxo",
  gatilho: "Gatilho",
  sistema: "Sistema",
  ia: "IA",
};

const recipientStatusLabels: Record<string, string> = {
  pending: "Pendente",
  sent: "Enviado",
  delivered: "Entregue",
  read: "Lido",
  failed: "Falhou",
  skipped: "Ignorado",
};

const PIE_COLORS = ["hsl(var(--primary))", "hsl(142 76% 36%)", "hsl(0 84% 60%)", "hsl(45 93% 47%)", "hsl(var(--muted-foreground))"];

interface Props {
  campaign: CampaignWithStats;
}

export default function CampaignSummaryTab({ campaign }: Props) {
  // Lightweight status counts (no full recipient load)
  const { data: statusCounts = [] } = useQuery({
    queryKey: ["campaign-status-counts", campaign.id],
    queryFn: () => fetchRecipientStatusCounts(campaign.id),
  });

  // Instance metrics (lightweight aggregation)
  const { data: instanceMetrics = [] } = useQuery({
    queryKey: ["campaign-instance-metrics", campaign.id],
    queryFn: () => fetchInstanceMetrics(campaign.id),
  });

  const deliveryRate = campaign.sent_count > 0
    ? ((campaign.delivered_count / campaign.sent_count) * 100).toFixed(1)
    : "—";

  const pieData = statusCounts.map((s) => ({
    name: recipientStatusLabels[s.status] || s.status,
    value: s.count,
  }));

  const barData = instanceMetrics.map((m) => ({
    name: m.instance_name,
    count: m.recipients,
  }));

  return (
    <div className="p-4 space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <Users className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-xl font-bold">{campaign.total_unique_recipients}</p>
            <p className="text-xs text-muted-foreground">Únicos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Send className="w-5 h-5 mx-auto mb-1 text-blue-500" />
            <p className="text-xl font-bold">{campaign.sent_count}</p>
            <p className="text-xs text-muted-foreground">Enviados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <CheckCircle className="w-5 h-5 mx-auto mb-1 text-green-500" />
            <p className="text-xl font-bold">{campaign.delivered_count}</p>
            <p className="text-xs text-muted-foreground">Entregues</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <XCircle className="w-5 h-5 mx-auto mb-1 text-destructive" />
            <p className="text-xl font-bold">{campaign.failed_count}</p>
            <p className="text-xs text-muted-foreground">Falhas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <TrendingUp className="w-5 h-5 mx-auto mb-1 text-yellow-500" />
            <p className="text-xl font-bold">{deliveryRate}{deliveryRate !== "—" ? "%" : ""}</p>
            <p className="text-xs text-muted-foreground">Taxa de Entrega</p>
          </CardContent>
        </Card>
      </div>

      {/* Campaign info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Informações da Campanha</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Nome</p>
            <p className="font-medium">{campaign.name || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Status</p>
            <Badge variant="outline">{statusLabels[campaign.status] || campaign.status}</Badge>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Origem</p>
            <p className="font-medium">{originLabels[campaign.origin_type || campaign.source] || campaign.source}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Criado por</p>
            <p className="font-medium">{campaign.creator_name}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Criação</p>
            <p className="font-medium">{format(new Date(campaign.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
          </div>
          {campaign.started_at && (
            <div>
              <p className="text-muted-foreground text-xs">Início</p>
              <p className="font-medium">{format(new Date(campaign.started_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
            </div>
          )}
          {campaign.completed_at && (
            <div>
              <p className="text-muted-foreground text-xs">Conclusão</p>
              <p className="font-medium">{format(new Date(campaign.completed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
            </div>
          )}
          <div>
            <p className="text-muted-foreground text-xs">Modo Mensagem</p>
            <p className="font-medium">{campaign.message_mode === "template" ? "Template" : "Personalizada"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Provider</p>
            <p className="font-medium">{campaign.provider_category}</p>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {barData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Distribuição por Instância</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {pieData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Status dos Destinatários</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Message preview */}
      {campaign.message_body && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Mensagem</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm bg-muted p-3 rounded-lg max-h-40 overflow-auto">
              {campaign.message_body}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
