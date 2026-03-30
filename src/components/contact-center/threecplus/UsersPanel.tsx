import { useState, useEffect, useCallback, useMemo } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, RefreshCw, Users2, Info } from "lucide-react";
import { toast } from "sonner";
import { extractList, isUserActive } from "@/lib/threecplusUtils";

const UsersPanel = () => {
  const { tenant } = useTenant();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const domain = settings.threecplus_domain || "";
  const apiToken = settings.threecplus_api_token || "";

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const invoke = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
      body: { action, domain, api_token: apiToken, ...extra },
    });
    if (error) throw error;
    return data;
  }, [domain, apiToken]);

  const fetchUsers = useCallback(async () => {
    if (!domain || !apiToken) return;
    setLoading(true);
    try {
      const data = await invoke("list_users");
      if (data?.status === 404) { setUsers([]); return; }
      setUsers(extractList(data));
    } catch {
      toast.error("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  }, [invoke, domain, apiToken]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    if (statusFilter === "all") return users;
    return users.filter((u) => {
      const active = isUserActive(u);
      return statusFilter === "active" ? active : !active;
    });
  }, [users, statusFilter]);

  const roleLabel = (role: string | any) => {
    if (typeof role === "object" && role !== null) return role.readable_name || role.name || "—";
    const map: Record<string, string> = { admin: "Admin", supervisor: "Supervisor", agent: "Agente" };
    return map[role] || role || "—";
  };

  return (
    <div className="mt-4 space-y-4">
      {/* Banner */}
      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
        <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          Usuários e equipes devem ser gerenciados preferencialmente no <strong>3C Plus</strong>. Este painel é apenas para consulta e visualização.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users2 className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Usuários 3CPlus</h3>
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Atualizar
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading && users.length === 0 ? (
            <div className="p-4 space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filteredUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              {users.length === 0 ? "Nenhum usuário encontrado" : "Nenhum usuário com o filtro selecionado"}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((u: any) => {
                  const active = isUserActive(u);
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="text-sm text-muted-foreground">{u.id}</TableCell>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="text-sm">{u.email || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{roleLabel(u.role || u.type)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={active ? "default" : "destructive"}>
                          {active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UsersPanel;
