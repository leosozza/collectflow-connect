import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { fetchCampaignAgreements } from "@/services/campaignManagementService";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Handshake } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const agreementStatusLabels: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  overdue: "Vencido",
  cancelled: "Cancelado",
  completed: "Quitado",
};

const agreementStatusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-700",
  approved: "bg-green-500/20 text-green-700",
  overdue: "bg-orange-500/20 text-orange-700",
  cancelled: "bg-destructive/20 text-destructive",
  completed: "bg-emerald-500/20 text-emerald-700",
};

interface Props {
  campaignId: string;
}

export default function CampaignAgreementsTab({ campaignId }: Props) {
  const { tenantId } = useTenant();

  const { data: agreements = [], isLoading } = useQuery({
    queryKey: ["campaign-agreements", campaignId],
    queryFn: () => fetchCampaignAgreements(campaignId, tenantId!),
    enabled: !!tenantId,
  });

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Acordos gerados após a campanha</h3>
        <span className="text-sm text-muted-foreground">{agreements.length} acordos</span>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-muted-foreground">Carregando...</div>
          ) : agreements.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Handshake className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>Nenhum acordo vinculado a esta campanha</p>
              <p className="text-xs mt-1">Acordos são vinculados por CPF dos clientes da campanha</p>
            </div>
          ) : (
            <div className="overflow-auto max-h-[60vh]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-3 font-medium">Cliente</th>
                    <th className="text-left p-3 font-medium">CPF</th>
                    <th className="text-left p-3 font-medium">Credor</th>
                    <th className="text-right p-3 font-medium">Valor</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Operador</th>
                    <th className="text-left p-3 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {agreements.map((a: any) => (
                    <tr key={a.id} className="border-b border-border hover:bg-muted/20">
                      <td className="p-3 font-medium">{a.client_name}</td>
                      <td className="p-3 text-muted-foreground text-xs">{a.client_cpf}</td>
                      <td className="p-3 text-xs">{a.credor}</td>
                      <td className="p-3 text-right font-medium">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(a.proposed_total || 0)}
                      </td>
                      <td className="p-3">
                        <Badge className={`text-xs ${agreementStatusColors[a.status] || ""}`}>
                          {agreementStatusLabels[a.status] || a.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{a.creator_name || "—"}</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {format(new Date(a.created_at), "dd/MM/yy", { locale: ptBR })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
