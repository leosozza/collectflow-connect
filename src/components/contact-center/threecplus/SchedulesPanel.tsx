import { useState, useEffect, useCallback } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, RefreshCw, CalendarClock } from "lucide-react";
import { toast } from "sonner";

const SchedulesPanel = () => {
  const { tenant } = useTenant();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const domain = settings.threecplus_domain || "";
  const apiToken = settings.threecplus_api_token || "";

  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const invoke = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
      body: { action, domain, api_token: apiToken, ...extra },
    });
    if (error) throw error;
    return data;
  }, [domain, apiToken]);

  const fetchSchedules = useCallback(async () => {
    if (!domain || !apiToken) return;
    setLoading(true);
    try {
      const data = await invoke("list_schedules");
      if (data?.status === 404) { setSchedules([]); return; }
      setSchedules(Array.isArray(data) ? data : data?.data || []);
    } catch {
      toast.error("Erro ao carregar agendamentos");
    } finally {
      setLoading(false);
    }
  }, [invoke, domain, apiToken]);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  const formatDate = (d: string) => {
    if (!d) return "—";
    try { return new Date(d).toLocaleString("pt-BR"); } catch { return d; }
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Agendamentos / Callbacks</h3>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSchedules} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Atualizar
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading && schedules.length === 0 ? (
            <div className="p-4 space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : schedules.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Nenhum agendamento encontrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Agente</TableHead>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Data Agendada</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-sm text-muted-foreground">{s.id}</TableCell>
                    <TableCell className="font-medium">{s.phone || s.phone_number || "—"}</TableCell>
                    <TableCell>{s.agent?.name || s.agent_name || s.agent_id || "—"}</TableCell>
                    <TableCell>{s.campaign?.name || s.campaign_name || "—"}</TableCell>
                    <TableCell>{formatDate(s.scheduled_at || s.schedule_date || s.date)}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === "pending" ? "secondary" : "default"}>
                        {s.status || "pendente"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SchedulesPanel;
