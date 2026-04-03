import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { fetchCampaignResponses } from "@/services/campaignManagementService";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  campaignId: string;
}

export default function CampaignResponsesTab({ campaignId }: Props) {
  const { tenantId } = useTenant();

  const { data: responses = [], isLoading } = useQuery({
    queryKey: ["campaign-responses", campaignId],
    queryFn: () => fetchCampaignResponses(campaignId, tenantId!),
    enabled: !!tenantId,
  });

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Respostas vinculadas à campanha</h3>
        <span className="text-sm text-muted-foreground">{responses.length} respostas</span>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-muted-foreground">Carregando...</div>
          ) : responses.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>Nenhuma resposta identificada ainda</p>
              <p className="text-xs mt-1">Respostas são vinculadas por telefone após o início da campanha</p>
            </div>
          ) : (
            <div className="overflow-auto max-h-[60vh]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-3 font-medium">Nome</th>
                    <th className="text-left p-3 font-medium">Telefone</th>
                    <th className="text-left p-3 font-medium">Instância</th>
                    <th className="text-left p-3 font-medium">Respondeu em</th>
                    <th className="text-left p-3 font-medium">Status Conversa</th>
                  </tr>
                </thead>
                <tbody>
                  {responses.map((r: any) => (
                    <tr key={r.id} className="border-b border-border hover:bg-muted/20">
                      <td className="p-3 font-medium">{r.recipient_name}</td>
                      <td className="p-3 text-muted-foreground">{r.phone}</td>
                      <td className="p-3 text-xs">{r.instance_name || "—"}</td>
                      <td className="p-3 text-xs">
                        {r.responded_at ? format(new Date(r.responded_at), "dd/MM/yy HH:mm", { locale: ptBR }) : "—"}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">
                          {r.conversation_status || "—"}
                        </Badge>
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
