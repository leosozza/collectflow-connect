import { useState, useEffect, useCallback } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Plus, RefreshCw, PhoneIncoming, List, Phone } from "lucide-react";
import { toast } from "sonner";

const ReceptiveQueuesPanel = () => {
  const { tenant } = useTenant();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const domain = settings.threecplus_domain || "";
  const apiToken = settings.threecplus_api_token || "";

  const [queues, setQueues] = useState<any[]>([]);
  const [ivrs, setIvrs] = useState<any[]>([]);
  const [numbers, setNumbers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [queueName, setQueueName] = useState("");
  const [saving, setSaving] = useState(false);

  const invoke = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
      body: { action, domain, api_token: apiToken, ...extra },
    });
    if (error) throw error;
    return data;
  }, [domain, apiToken]);

  const extract = (data: any) => {
    if (data?.status === 404) return [];
    return Array.isArray(data) ? data : data?.data || [];
  };

  const fetchAll = useCallback(async () => {
    if (!domain || !apiToken) return;
    setLoading(true);
    try {
      const [q, i, n] = await Promise.all([
        invoke("list_receptive_queues"),
        invoke("list_receptive_ivr"),
        invoke("list_receptive_numbers"),
      ]);
      setQueues(extract(q));
      setIvrs(extract(i));
      setNumbers(extract(n));
    } catch {
      toast.error("Erro ao carregar filas receptivas");
    } finally {
      setLoading(false);
    }
  }, [invoke, domain, apiToken]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCreateQueue = async () => {
    if (!queueName.trim()) { toast.error("Informe o nome"); return; }
    setSaving(true);
    try {
      await invoke("create_receptive_queue", { queue_data: { name: queueName.trim() } });
      toast.success("Fila criada");
      setDialogOpen(false);
      setQueueName("");
      fetchAll();
    } catch {
      toast.error("Erro ao criar fila");
    } finally {
      setSaving(false);
    }
  };

  const renderTable = (data: any[], columns: { key: string; label: string }[]) => {
    if (loading && data.length === 0) {
      return (
        <div className="p-4 space-y-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      );
    }
    if (data.length === 0) {
      return <p className="text-sm text-muted-foreground text-center py-12">Nenhum registro encontrado</p>;
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map(c => <TableHead key={c.key}>{c.label}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item: any, idx: number) => (
            <TableRow key={item.id || idx}>
              {columns.map(c => (
                <TableCell key={c.key} className={c.key === "id" ? "text-muted-foreground text-sm" : ""}>
                  {item[c.key] ?? "—"}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PhoneIncoming className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Filas Receptivas</h3>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Atualizar
          </Button>
          <Button size="sm" onClick={() => { setQueueName(""); setDialogOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Nova Fila
          </Button>
        </div>
      </div>

      <Tabs defaultValue="queues">
        <TabsList>
          <TabsTrigger value="queues" className="gap-1"><List className="w-4 h-4" />Filas</TabsTrigger>
          <TabsTrigger value="ivr" className="gap-1"><PhoneIncoming className="w-4 h-4" />URA</TabsTrigger>
          <TabsTrigger value="numbers" className="gap-1"><Phone className="w-4 h-4" />Números</TabsTrigger>
        </TabsList>

        <TabsContent value="queues">
          <Card>
            <CardContent className="p-0">
              {renderTable(queues, [
                { key: "id", label: "ID" },
                { key: "name", label: "Nome" },
                { key: "strategy", label: "Estratégia" },
                { key: "timeout", label: "Timeout" },
              ])}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ivr">
          <Card>
            <CardContent className="p-0">
              {renderTable(ivrs, [
                { key: "id", label: "ID" },
                { key: "name", label: "Nome" },
                { key: "description", label: "Descrição" },
              ])}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="numbers">
          <Card>
            <CardContent className="p-0">
              {renderTable(numbers, [
                { key: "id", label: "ID" },
                { key: "number", label: "Número" },
                { key: "description", label: "Descrição" },
              ])}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Fila Receptiva</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Nome</Label>
            <Input value={queueName} onChange={(e) => setQueueName(e.target.value)} placeholder="Ex: Atendimento Geral" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateQueue} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReceptiveQueuesPanel;
