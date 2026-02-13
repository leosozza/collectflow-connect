import { useState, useEffect, useCallback } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Plus, RefreshCw, Play, MessageSquare } from "lucide-react";
import { toast } from "sonner";

const SMSPanel = () => {
  const { tenant } = useTenant();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const domain = settings.threecplus_domain || "";
  const apiToken = settings.threecplus_api_token || "";

  const [lists, setLists] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const invoke = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
      body: { action, domain, api_token: apiToken, ...extra },
    });
    if (error) throw error;
    return data;
  }, [domain, apiToken]);

  const fetchLists = useCallback(async () => {
    if (!domain || !apiToken) return;
    setLoading(true);
    try {
      const data = await invoke("list_sms_mailings");
      if (data?.status === 404) { setLists([]); return; }
      setLists(Array.isArray(data) ? data : data?.data || []);
    } catch {
      toast.error("Erro ao carregar listas SMS");
    } finally {
      setLoading(false);
    }
  }, [invoke, domain, apiToken]);

  useEffect(() => { fetchLists(); }, [fetchLists]);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error("Informe o nome"); return; }
    setSaving(true);
    try {
      await invoke("create_sms_mailing", {
        sms_data: { name: name.trim(), message: message.trim() || undefined },
      });
      toast.success("Lista SMS criada");
      setDialogOpen(false);
      setName("");
      setMessage("");
      fetchLists();
    } catch {
      toast.error("Erro ao criar lista SMS");
    } finally {
      setSaving(false);
    }
  };

  const handleStart = async (listId: number) => {
    try {
      await invoke("start_sms_mailing", { sms_list_id: listId });
      toast.success("Disparo SMS iniciado");
      fetchLists();
    } catch {
      toast.error("Erro ao iniciar disparo SMS");
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">SMS em Massa</h3>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchLists} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Atualizar
          </Button>
          <Button size="sm" onClick={() => { setName(""); setMessage(""); setDialogOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Nova Lista SMS
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading && lists.length === 0 ? (
            <div className="p-4 space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : lists.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Nenhuma lista SMS encontrada</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Registros</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lists.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-sm text-muted-foreground">{l.id}</TableCell>
                    <TableCell className="font-medium">{l.name}</TableCell>
                    <TableCell>{l.total_records ?? l.count ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={l.status === "completed" ? "default" : "secondary"}>
                        {l.status || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStart(l.id)}
                        className="gap-1"
                        disabled={l.status === "sending"}
                      >
                        <Play className="w-3 h-3" /> Disparar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Lista SMS</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome da Lista</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Campanha Janeiro" />
            </div>
            <div>
              <Label>Mensagem (opcional)</Label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Texto do SMS..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SMSPanel;
