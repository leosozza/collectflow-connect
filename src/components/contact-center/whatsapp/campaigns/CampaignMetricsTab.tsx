import { useQuery } from "@tanstack/react-query";
import { fetchInstanceMetrics, CampaignWithStats } from "@/services/campaignManagementService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Props {
  campaignId: string;
  campaign: CampaignWithStats;
}

export default function CampaignMetricsTab({ campaignId, campaign }: Props) {
  // Reuse same queryKey as SummaryTab to share cache
  const { data: instanceMetrics = [], isLoading: metricsLoading } = useQuery({
    queryKey: ["campaign-instance-metrics", campaignId],
    queryFn: () => fetchInstanceMetrics(campaignId),
  });

  // Use campaign-level counters instead of loading all recipients again
  const total = campaign.total_unique_recipients;
  const sent = campaign.sent_count;
  const delivered = campaign.delivered_count;
  const failed = campaign.failed_count;
  const pending = total - sent - failed;

  return (
    <div className="p-4 space-y-4">
      {/* Global metrics from campaign counters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Métricas Globais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-500">{sent}</p>
              <p className="text-xs text-muted-foreground">Enviados</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-500">{delivered}</p>
              <p className="text-xs text-muted-foreground">Entregues</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-destructive">{failed}</p>
              <p className="text-xs text-muted-foreground">Falhas</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-muted-foreground">{Math.max(pending, 0)}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4 text-center text-sm">
            <div>
              <p className="font-medium">{total > 0 ? ((sent / total) * 100).toFixed(1) : 0}%</p>
              <p className="text-xs text-muted-foreground">Taxa de Envio</p>
            </div>
            <div>
              <p className="font-medium">{sent > 0 ? ((delivered / sent) * 100).toFixed(1) : 0}%</p>
              <p className="text-xs text-muted-foreground">Taxa de Entrega</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics by instance */}
      {instanceMetrics.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Desempenho por Instância</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={instanceMetrics}>
                <XAxis dataKey="instance_name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="sent" name="Enviados" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="delivered" name="Entregues" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="failed" name="Falhas" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <div className="overflow-auto mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-2 font-medium">Instância</th>
                    <th className="text-right p-2 font-medium">Destinatários</th>
                    <th className="text-right p-2 font-medium">Enviados</th>
                    <th className="text-right p-2 font-medium">Entregues</th>
                    <th className="text-right p-2 font-medium">Falhas</th>
                    <th className="text-right p-2 font-medium">Taxa</th>
                  </tr>
                </thead>
                <tbody>
                  {instanceMetrics.map((m) => (
                    <tr key={m.instance_id} className="border-b border-border">
                      <td className="p-2 font-medium">{m.instance_name}</td>
                      <td className="p-2 text-right">{m.recipients}</td>
                      <td className="p-2 text-right">{m.sent}</td>
                      <td className="p-2 text-right text-green-600">{m.delivered}</td>
                      <td className="p-2 text-right text-destructive">{m.failed}</td>
                      <td className="p-2 text-right">
                        {m.recipients > 0 ? ((m.sent / m.recipients) * 100).toFixed(0) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
