import { useState, useCallback } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Search, Play, Phone, Download } from "lucide-react";
import { toast } from "sonner";

const CallHistoryPanel = () => {
  const { tenant } = useTenant();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const domain = settings.threecplus_domain || "";
  const apiToken = settings.threecplus_api_token || "";

  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [campaignFilter, setCampaignFilter] = useState("");
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const invoke = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
      body: { action, domain, api_token: apiToken, ...extra },
    });
    if (error) throw error;
    return data;
  }, [domain, apiToken]);

  const loadCampaigns = useCallback(async () => {
    if (!domain || !apiToken) return;
    setLoadingCampaigns(true);
    try {
      const data = await invoke("list_campaigns");
      setCampaigns(Array.isArray(data) ? data : data?.data || []);
    } catch {
      // silent
    } finally {
      setLoadingCampaigns(false);
    }
  }, [invoke, domain, apiToken]);

  useState(() => { loadCampaigns(); });

  const fetchCalls = async () => {
    setLoading(true);
    try {
      const data = await invoke("calls_report", {
        startDate: `${startDate} 00:00:00`,
        endDate: `${endDate} 23:59:59`,
        campaign_id: campaignFilter || undefined,
        page: String(page),
      });
      const list = Array.isArray(data) ? data : data?.data || [];
      setCalls(list);
    } catch {
      toast.error("Erro ao buscar histórico de chamadas");
    } finally {
      setLoading(false);
    }
  };

  const handlePlayRecording = async (callId: number) => {
    setPlayingId(callId);
    try {
      const data = await invoke("get_recording", { call_id: callId });
      if (data?.url) {
        setAudioUrl(data.url);
      } else {
        toast.error("Gravação não disponível");
      }
    } catch {
      toast.error("Erro ao carregar gravação");
    } finally {
      setPlayingId(null);
    }
  };

  const formatDuration = (seconds: number | undefined) => {
    if (!seconds) return "—";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    completed: { label: "Completada", variant: "default" },
    answered: { label: "Atendida", variant: "default" },
    no_answer: { label: "Não Atendida", variant: "secondary" },
    busy: { label: "Ocupado", variant: "secondary" },
    failed: { label: "Falha", variant: "destructive" },
    abandoned: { label: "Abandonada", variant: "destructive" },
    amd: { label: "Caixa Postal", variant: "outline" },
  };

  return (
    <div className="mt-4 space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="w-5 h-5 text-primary" />
            Histórico de Chamadas
          </CardTitle>
          <CardDescription>Consulte chamadas realizadas com duração, status e gravação</CardDescription>
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
            <div className="space-y-1">
              <Label className="text-xs">Campanha</Label>
              <Select value={campaignFilter || "all"} onValueChange={(v) => setCampaignFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {campaigns.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={fetchCalls} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audio Player */}
      {audioUrl && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Gravação:</span>
              <audio controls src={audioUrl} className="flex-1 h-8" />
              <Button variant="ghost" size="sm" onClick={() => setAudioUrl(null)}>✕</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      <Card>
        <CardContent className="p-0">
          {loading && calls.length === 0 ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : calls.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              {loading ? "" : "Clique em \"Buscar\" para carregar o histórico de chamadas"}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Agente</TableHead>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Gravação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls.map((call: any) => {
                  const st = statusMap[call.status?.toLowerCase()] || { label: call.status || "—", variant: "outline" as const };
                  return (
                    <TableRow key={call.id}>
                      <TableCell className="font-mono text-sm">{call.phone || call.number || "—"}</TableCell>
                      <TableCell className="text-sm">{call.agent_name || call.agent?.name || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{call.campaign_name || call.campaign?.name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{formatDuration(call.duration || call.billsec)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {call.created_at ? new Date(call.created_at).toLocaleString("pt-BR") : call.date || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePlayRecording(call.id)}
                          disabled={playingId === call.id}
                          title="Ouvir gravação"
                        >
                          {playingId === call.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {calls.length > 0 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => { setPage(p => p - 1); fetchCalls(); }}>
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground self-center">Página {page}</span>
          <Button variant="outline" size="sm" onClick={() => { setPage(p => p + 1); fetchCalls(); }}>
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
};

export default CallHistoryPanel;
