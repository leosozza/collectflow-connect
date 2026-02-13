import { useState, useEffect, useCallback } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Plus, RefreshCw, Eye, Edit, UsersRound } from "lucide-react";
import { toast } from "sonner";

const TeamsPanel = () => {
  const { tenant } = useTenant();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const domain = settings.threecplus_domain || "";
  const apiToken = settings.threecplus_api_token || "";

  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [viewTeam, setViewTeam] = useState<any>(null);
  const [viewLoading, setViewLoading] = useState(false);

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
      setTeams(Array.isArray(data) ? data : data?.data || []);
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

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Informe o nome"); return; }
    setSaving(true);
    try {
      if (editing) {
        await invoke("update_team", { team_id: editing.id, team_data: { name: name.trim() } });
        toast.success("Equipe atualizada");
      } else {
        await invoke("create_team", { team_data: { name: name.trim() } });
        toast.success("Equipe criada");
      }
      setDialogOpen(false);
      setEditing(null);
      setName("");
      fetchTeams();
    } catch {
      toast.error("Erro ao salvar equipe");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UsersRound className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Equipes</h3>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchTeams} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Atualizar
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setName(""); setDialogOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Nova Equipe
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading && teams.length === 0 ? (
            <div className="p-4 space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : teams.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Nenhuma equipe encontrada</p>
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
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => handleView(t.id)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(t); setName(t.name); setDialogOpen(true); }}>
                        <Edit className="w-4 h-4" />
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Equipe" : "Nova Equipe"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Equipe Cobrança" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeamsPanel;
