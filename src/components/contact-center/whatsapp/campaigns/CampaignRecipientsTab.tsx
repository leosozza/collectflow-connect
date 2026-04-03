import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchManagedRecipients, fetchCampaignInstances } from "@/services/campaignManagementService";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const recipientStatusLabels: Record<string, string> = {
  pending: "Pendente",
  sent: "Enviado",
  delivered: "Entregue",
  read: "Lido",
  failed: "Falhou",
  skipped: "Ignorado",
};

const recipientStatusColors: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  delivered: "bg-green-500/20 text-green-700 dark:text-green-300",
  read: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  failed: "bg-destructive/20 text-destructive",
  skipped: "bg-yellow-500/20 text-yellow-700",
};

interface Props {
  campaignId: string;
  selectedInstanceIds?: string[];
}

const PAGE_SIZE = 50;

export default function CampaignRecipientsTab({ campaignId, selectedInstanceIds }: Props) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [instanceFilter, setInstanceFilter] = useState("all");
  const [page, setPage] = useState(1);

  // Fetch real instances for filter dropdown
  const { data: instances = [] } = useQuery({
    queryKey: ["campaign-instances", selectedInstanceIds],
    queryFn: () => fetchCampaignInstances(selectedInstanceIds || []),
    enabled: !!selectedInstanceIds && selectedInstanceIds.length > 0,
  });

  const { data: result, isLoading } = useQuery({
    queryKey: ["campaign-recipients", campaignId, statusFilter, instanceFilter, page],
    queryFn: () =>
      fetchManagedRecipients(
        campaignId,
        { status: statusFilter, instanceId: instanceFilter },
        page,
        PAGE_SIZE
      ),
  });

  const recipients = result?.data || [];
  const total = result?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="sent">Enviado</SelectItem>
            <SelectItem value="delivered">Entregue</SelectItem>
            <SelectItem value="read">Lido</SelectItem>
            <SelectItem value="failed">Falhou</SelectItem>
          </SelectContent>
        </Select>

        {instances.length > 1 && (
          <Select value={instanceFilter} onValueChange={(v) => { setInstanceFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Instância" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas instâncias</SelectItem>
              {instances.map((inst) => (
                <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <span className="text-sm text-muted-foreground ml-auto">{total} destinatários</span>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-muted-foreground">Carregando...</div>
          ) : recipients.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">Nenhum destinatário</div>
          ) : (
            <div className="overflow-auto max-h-[60vh]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-3 font-medium">Nome</th>
                    <th className="text-left p-3 font-medium">Telefone</th>
                    <th className="text-left p-3 font-medium">Instância</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Envio</th>
                    <th className="text-left p-3 font-medium">Score</th>
                    <th className="text-left p-3 font-medium">Perfil</th>
                    <th className="text-left p-3 font-medium">Erro</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((r) => (
                    <tr key={r.id} className="border-b border-border hover:bg-muted/20">
                      <td className="p-3 font-medium max-w-[160px] truncate">{r.recipient_name}</td>
                      <td className="p-3 text-muted-foreground">{r.phone}</td>
                      <td className="p-3 text-xs">{r.instance_name || "—"}</td>
                      <td className="p-3">
                        <Badge className={`text-xs ${recipientStatusColors[r.status] || ""}`}>
                          {recipientStatusLabels[r.status] || r.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {r.sent_at ? format(new Date(r.sent_at), "dd/MM HH:mm", { locale: ptBR }) : "—"}
                      </td>
                      <td className="p-3 text-center">{r.client_score ?? "—"}</td>
                      <td className="p-3 text-xs">{r.client_profile || "—"}</td>
                      <td className="p-3 text-xs text-destructive max-w-[200px] truncate" title={r.error_message || ""}>
                        {r.error_message || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Página {page} de {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              Próximo <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
