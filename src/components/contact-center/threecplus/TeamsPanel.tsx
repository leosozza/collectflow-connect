import { useState, useEffect, useCallback, useMemo } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, RefreshCw, Eye, UsersRound, Info } from "lucide-react";
import { toast } from "sonner";
import { extractList } from "@/lib/threecplusUtils";

const TeamsPanel = () => {
  const { tenant } = useTenant();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const domain = settings.threecplus_domain || "";
  const apiToken = settings.threecplus_api_token || "";

  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewTeam, setViewTeam] = useState<any>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("active");

  const isTeamActive = (t: any) => {
    if (typeof t.active === "boolean") return t.active;
    if (typeof t.status === "string") return t.status !== "inactive" && t.status !== "disabled";
    return true;
  };

  const filteredTeams = useMemo(() => {
    if (statusFilter === "all") return teams;
    return teams.filter((t) => {
      const active = isTeamActive(t);
      return statusFilter === "active" ? active : !active;
    });
  }, [teams, statusFilter]);

  const invoke = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
      body: { action, domain, api_token: apiToken, ...extra },
    });
    if (error) throw error;
    return data;
  }, [domain, apiToken]);

  const fetchTeams = useCallback(async () => {
    if (!domain || !apiToken) return;
    setLoading(true);
    try {
      const data = await invoke("list_teams");
      if (data?.status === 404) { setTeams([]); return; }
      setTeams(extractList(data));
    } catch {
      toast.error("Erro ao carregar equipes");
    } finally {
      setLoading(false);
    }
  }, [invoke, domain, apiToken]);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  const handleView = async (teamId: number) => {
    setViewLoading(true);
    try {
      const data = await invoke("get_team", { team_id: teamId });
      setViewTeam(data);
    } catch {
      toast.error("Erro ao carregar detalhes da equipe");
    } finally {
      setViewLoading(false);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      {/* Banner */}
      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
        <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          Equipes devem ser gerenciadas preferencialmente no <strong>3C Plus</strong>. Este painel é apenas para consulta.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UsersRound className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Equipes</h3>
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="active">Ativas</SelectItem>
              <SelectItem value="inactive">Inativas</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchTeams} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Atualizar
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading && teams.length === 0 ? (
            <div className="p-4 space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filteredTeams.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              {teams.length === 0 ? "Nenhuma equipe encontrada" : "Nenhuma equipe com o filtro selecionado"}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Agentes</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm text-muted-foreground">{t.id}</TableCell>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{t.agents_count ?? t.agents?.length ?? "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleView(t.id)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Team detail */}
      {viewTeam && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Detalhes: {viewTeam.name || viewTeam.data?.name}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setViewTeam(null)}>✕</Button>
            </div>
          </CardHeader>
          <CardContent>
            {viewLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="space-y-2">
                <p className="text-sm"><strong>Agentes:</strong></p>
                {(viewTeam.agents || viewTeam.data?.agents || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum agente nesta equipe</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(viewTeam.agents || viewTeam.data?.agents || []).map((a: any) => (
                      <Badge key={a.id} variant="outline">{a.name || `Agente ${a.id}`}</Badge>
                    ))}
                  </div>
                )}
                <p className="text-sm mt-2"><strong>Supervisores:</strong></p>
                {(viewTeam.supervisors || viewTeam.data?.supervisors || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum supervisor</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(viewTeam.supervisors || viewTeam.data?.supervisors || []).map((s: any) => (
                      <Badge key={s.id} variant="default">{s.name || `Supervisor ${s.id}`}</Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TeamsPanel;
