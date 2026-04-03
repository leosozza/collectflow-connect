import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";
import { fetchManagedCampaigns, fetchCampaignDashboardStats } from "@/services/campaignManagementService";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Search, Send, CheckCircle, XCircle, MessageSquare, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import CampaignDetailView from "./campaigns/CampaignDetailView";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sending: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  completed: "bg-green-500/20 text-green-700 dark:text-green-300",
  completed_with_errors: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
  failed: "bg-destructive/20 text-destructive",
  paused: "bg-orange-500/20 text-orange-700 dark:text-orange-300",
  cancelled: "bg-muted text-muted-foreground",
};

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

export default function CampaignManagementTab() {
  const { tenant, tenantUser } = useTenant();
  const permissions = usePermissions();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  const tenantId = tenant?.id;
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  const onlyOwn = !permissions.canViewAllCampanhas && permissions.canViewOwnCampanhas;

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["managed-campaigns", tenantId, statusFilter, search, onlyOwn],
    queryFn: () =>
      fetchManagedCampaigns(tenantId!, {
        status: statusFilter,
        search: search || undefined,
        onlyOwn,
        userId: onlyOwn ? tenantUser?.user_id : undefined,
      }),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const { data: stats } = useQuery({
    queryKey: ["campaign-dashboard-stats", tenantId, onlyOwn],
    queryFn: () =>
      fetchCampaignDashboardStats(tenantId!, onlyOwn ? tenantUser?.user_id : undefined),
    enabled: !!tenantId,
  });

  if (selectedCampaignId) {
    return (
      <CampaignDetailView
        campaignId={selectedCampaignId}
        onBack={() => setSelectedCampaignId(null)}
      />
    );
  }

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      {/* Dashboard cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Send className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Campanhas</p>
              <p className="text-lg font-bold">{stats?.totalCampaigns || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <MessageSquare className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Enviadas</p>
              <p className="text-lg font-bold">{stats?.totalSent || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Entregues</p>
              <p className="text-lg font-bold">{stats?.totalDelivered || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <XCircle className="w-4 h-4 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Falhas</p>
              <p className="text-lg font-bold">{stats?.totalFailed || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar campanha..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="sending">Enviando</SelectItem>
            <SelectItem value="completed">Concluída</SelectItem>
            <SelectItem value="completed_with_errors">Concluída c/ erros</SelectItem>
            <SelectItem value="failed">Falhou</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Campaigns table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando campanhas...</div>
          ) : campaigns.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>Nenhuma campanha encontrada</p>
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-3 font-medium">Campanha</th>
                    <th className="text-left p-3 font-medium">Origem</th>
                    <th className="text-left p-3 font-medium">Criado por</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-right p-3 font-medium">Selecionados</th>
                    <th className="text-right p-3 font-medium">Únicos</th>
                    <th className="text-right p-3 font-medium">Enviados</th>
                    <th className="text-right p-3 font-medium">Falhas</th>
                    <th className="text-left p-3 font-medium">Progresso</th>
                    <th className="text-left p-3 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => {
                    const progress =
                      c.total_unique_recipients > 0
                        ? ((c.sent_count + c.failed_count) / c.total_unique_recipients) * 100
                        : 0;
                    return (
                      <tr
                        key={c.id}
                        className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => setSelectedCampaignId(c.id)}
                      >
                        <td className="p-3 font-medium max-w-[200px] truncate">
                          {c.name || `Campanha ${c.id.slice(0, 6)}`}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-xs">
                            {originLabels[c.origin_type || c.source] || c.source}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">{c.creator_name || "—"}</td>
                        <td className="p-3">
                          <Badge className={`text-xs ${statusColors[c.status] || ""}`}>
                            {statusLabels[c.status] || c.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">{c.total_selected}</td>
                        <td className="p-3 text-right">{c.total_unique_recipients}</td>
                        <td className="p-3 text-right">{c.sent_count}</td>
                        <td className="p-3 text-right text-destructive">{c.failed_count}</td>
                        <td className="p-3 w-[120px]">
                          <Progress value={Math.min(progress, 100)} className="h-2" />
                        </td>
                        <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">
                          {format(new Date(c.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
