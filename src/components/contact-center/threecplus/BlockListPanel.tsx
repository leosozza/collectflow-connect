import { useState, useEffect, useCallback } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Plus, RefreshCw, Trash2, ShieldBan } from "lucide-react";
import { toast } from "sonner";

const BlockListPanel = () => {
  const { tenant } = useTenant();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const domain = settings.threecplus_domain || "";
  const apiToken = settings.threecplus_api_token || "";

  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const invoke = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
      body: { action, domain, api_token: apiToken, ...extra },
    });
    if (error) throw error;
    return data;
  }, [domain, apiToken]);

  const fetchBlocks = useCallback(async () => {
    if (!domain || !apiToken) return;
    setLoading(true);
    try {
      const data = await invoke("list_block_list");
      if (data?.status === 404) {
        setBlocks([]);
        return;
      }
      setBlocks(Array.isArray(data) ? data : data?.data || []);
    } catch {
      toast.error("Erro ao carregar lista de bloqueio");
    } finally {
      setLoading(false);
    }
  }, [invoke, domain, apiToken]);

  useEffect(() => { fetchBlocks(); }, [fetchBlocks]);

  const handleAdd = async () => {
    const phone = newPhone.replace(/\D/g, "");
    if (!phone) { toast.error("Informe o telefone"); return; }
    setAdding(true);
    try {
      await invoke("add_block_list", { phone_number: phone });
      toast.success("Número bloqueado");
      setNewPhone("");
      fetchBlocks();
    } catch {
      toast.error("Erro ao bloquear número");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: number) => {
    setDeleting(id);
    try {
      await invoke("remove_block_list", { block_id: id });
      toast.success("Número desbloqueado");
      fetchBlocks();
    } catch {
      toast.error("Erro ao desbloquear");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <ShieldBan className="w-5 h-5 text-primary" />
            <div>
              <CardTitle className="text-base">Lista de Bloqueio (Do Not Call)</CardTitle>
              <CardDescription>Números que não serão discados pelo sistema</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Telefone (DDD + Número)"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              className="max-w-xs"
            />
            <Button onClick={handleAdd} disabled={adding} className="gap-2">
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Bloquear
            </Button>
            <Button variant="outline" size="icon" onClick={fetchBlocks} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>

          {loading && blocks.length === 0 ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : blocks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum número bloqueado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blocks.map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono">{b.phone_number || b.phone || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {b.created_at ? new Date(b.created_at).toLocaleString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleRemove(b.id)} disabled={deleting === b.id}>
                        {deleting === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
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

export default BlockListPanel;
