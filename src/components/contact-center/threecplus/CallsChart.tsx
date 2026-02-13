import { useState, useCallback, useEffect } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Loader2, RefreshCw, BarChart3 } from "lucide-react";
import { toast } from "sonner";

const CallsChart = () => {
  const { tenant } = useTenant();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const domain = settings.threecplus_domain || "";
  const apiToken = settings.threecplus_api_token || "";

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const invoke = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
      body: { action, domain, api_token: apiToken, ...extra },
    });
    if (error) throw error;
    return data;
  }, [domain, apiToken]);

  useEffect(() => {
    if (!domain || !apiToken) return;
    (async () => {
      try {
        const data = await invoke("list_campaigns");
        const list = Array.isArray(data) ? data : data?.data || [];
        setCampaigns(list);
        const running = list.find((c: any) => c.status === "running");
        if (running) setSelectedCampaign(String(running.id));
      } catch { /* silent */ }
    })();
  }, [domain, apiToken, invoke]);

  const fetchMetrics = useCallback(async () => {
    if (!selectedCampaign) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const data = await invoke("campaign_graphic_metrics", {
        campaign_id: selectedCampaign,
        startDate: `${today} 00:00:00`,
        endDate: `${today} 23:59:59`,
      });

      // The API returns data per hour
      const raw = Array.isArray(data) ? data : data?.data || data?.metrics || [];
      const formatted = raw.map((item: any) => ({
        hora: item.hour ?? item.time ?? "",
        Total: item.total ?? 0,
        Atendidas: item.answered ?? item.completed ?? 0,
        Abandonadas: item.abandoned ?? 0,
        AMD: item.amd ?? 0,
        "Não Atendidas": item.no_answer ?? 0,
      }));
      setChartData(formatted);
    } catch {
      toast.error("Erro ao carregar métricas gráficas");
    } finally {
      setLoading(false);
    }
  }, [selectedCampaign, invoke]);

  useEffect(() => {
    if (selectedCampaign) fetchMetrics();
  }, [selectedCampaign, fetchMetrics]);

  return (
    <div className="mt-4 space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-primary" />
              <div>
                <CardTitle className="text-base">Métricas por Hora</CardTitle>
                <CardDescription>Desempenho das chamadas hora a hora - hoje</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Selecione campanha" />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={fetchMetrics} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && chartData.length === 0 ? (
            <Skeleton className="h-[300px] w-full" />
          ) : chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              Selecione uma campanha para visualizar as métricas
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="hora" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Atendidas" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Abandonadas" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="AMD" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Não Atendidas" fill="hsl(220, 14%, 60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CallsChart;
