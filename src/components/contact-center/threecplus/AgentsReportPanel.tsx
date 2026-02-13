import { useState, useCallback } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Search, Users } from "lucide-react";
import { toast } from "sonner";

const AgentsReportPanel = () => {
  const { tenant } = useTenant();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const domain = settings.threecplus_domain || "";
  const apiToken = settings.threecplus_api_token || "";

  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  const invoke = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
      body: { action, domain, api_token: apiToken, ...extra },
    });
    if (error) throw error;
    return data;
  }, [domain, apiToken]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const data = await invoke("agents_report", {
        startDate: `${startDate} 00:00:00`,
        endDate: `${endDate} 23:59:59`,
      });
      const list = Array.isArray(data) ? data : data?.data || [];
      setAgents(list);
    } catch {
      toast.error("Erro ao buscar relatório de agentes");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number | undefined) => {
    if (!seconds) return "00:00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="mt-4 space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Relatório de Produtividade
          </CardTitle>
          <CardDescription>Métricas de tempo e desempenho dos agentes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Data Início</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-[150px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data Fim</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-[150px]" />
            </div>
            <Button onClick={fetchReport} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading && agents.length === 0 ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : agents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              Clique em "Buscar" para gerar o relatório
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agente</TableHead>
                    <TableHead>Tempo Logado</TableHead>
                    <TableHead>Tempo em Pausa</TableHead>
                    <TableHead>Tempo em Ligação</TableHead>
                    <TableHead>Qtd. Ligações</TableHead>
                    <TableHead>TMA</TableHead>
                    <TableHead>Tempo Ocioso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((agent: any) => (
                    <TableRow key={agent.id || agent.agent_id}>
                      <TableCell className="font-medium">{agent.name || agent.agent_name || `Agente ${agent.id}`}</TableCell>
                      <TableCell className="font-mono text-sm">{formatTime(agent.logged_time || agent.login_time)}</TableCell>
                      <TableCell className="font-mono text-sm">{formatTime(agent.pause_time || agent.paused_time)}</TableCell>
                      <TableCell className="font-mono text-sm">{formatTime(agent.call_time || agent.talking_time)}</TableCell>
                      <TableCell className="text-center">{agent.calls_count ?? agent.total_calls ?? "—"}</TableCell>
                      <TableCell className="font-mono text-sm">{formatTime(agent.average_call_time || agent.aht)}</TableCell>
                      <TableCell className="font-mono text-sm">{formatTime(agent.idle_time || agent.wait_time)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AgentsReportPanel;
