import { useState, useEffect, useCallback } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, RefreshCw, Route } from "lucide-react";
import { toast } from "sonner";

const RoutesPanel = () => {
  const { tenant } = useTenant();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const domain = settings.threecplus_domain || "";
  const apiToken = settings.threecplus_api_token || "";

  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const invoke = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
      body: { action, domain, api_token: apiToken, ...extra },
    });
    if (error) throw error;
    return data;
  }, [domain, apiToken]);

  const fetchRoutes = useCallback(async () => {
    if (!domain || !apiToken) return;
    setLoading(true);
    try {
      const data = await invoke("list_routes");
      if (data?.status === 404) { setRoutes([]); return; }
      const list = Array.isArray(data) ? data : data?.data || [];
      setRoutes(list);
    } catch {
      toast.error("Erro ao carregar rotas");
    } finally {
      setLoading(false);
    }
  }, [invoke, domain, apiToken]);

  useEffect(() => { fetchRoutes(); }, [fetchRoutes]);

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Route className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-lg font-semibold">Rotas 3CPlus</h3>
            <p className="text-xs text-muted-foreground">Rotas de saída configuradas na conta</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRoutes} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Atualizar
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading && routes.length === 0 ? (
            <div className="p-4 space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : routes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Nenhuma rota encontrada</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routes.map((r: any, idx: number) => (
                  <TableRow key={r.id || idx}>
                    <TableCell className="text-sm text-muted-foreground">{r.id ?? idx}</TableCell>
                    <TableCell className="font-medium">{r.name || r.description || "—"}</TableCell>
                    <TableCell className="text-sm">{r.type || r.route_type || "—"}</TableCell>
                    <TableCell className="text-sm">{r.priority ?? r.weight ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={r.active === false ? "destructive" : "default"}>
                        {r.active === false ? "Inativo" : "Ativo"}
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

export default RoutesPanel;
