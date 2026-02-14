import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { List, Loader2, XCircle } from "lucide-react";
import { fetchProtestTitles, cancelProtestTitle, type ProtestTitle } from "@/services/protestoService";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "secondary" },
  sent: { label: "Enviado", variant: "default" },
  protested: { label: "Protestado", variant: "destructive" },
  cancelled: { label: "Cancelado", variant: "outline" },
  paid: { label: "Pago", variant: "default" },
  rejected: { label: "Rejeitado", variant: "destructive" },
};

interface Props {
  refreshKey: number;
}

const ProtestoTitlesList = ({ refreshKey }: Props) => {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const [titles, setTitles] = useState<ProtestTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [cancelling, setCancelling] = useState<string | null>(null);

  const loadTitles = async () => {
    setLoading(true);
    try {
      const data = await fetchProtestTitles({ status: statusFilter });
      setTitles(data);
    } catch (e: any) {
      toast({ title: "Erro ao carregar títulos", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTitles();
  }, [statusFilter, refreshKey]);

  const handleCancel = async (id: string) => {
    if (!tenant || !user) return;
    setCancelling(id);
    try {
      await cancelProtestTitle(id, tenant.id, user.id);
      toast({ title: "Título cancelado" });
      loadTitles();
    } catch (e: any) {
      toast({ title: "Erro ao cancelar", description: e.message, variant: "destructive" });
    } finally {
      setCancelling(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <List className="w-5 h-5" />
              Títulos a Protesto
            </CardTitle>
            <CardDescription>{titles.length} título(s)</CardDescription>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="sent">Enviado</SelectItem>
              <SelectItem value="protested">Protestado</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
              <SelectItem value="paid">Pago</SelectItem>
              <SelectItem value="rejected">Rejeitado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : titles.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum título encontrado</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CPF</TableHead>
                  <TableHead>Devedor</TableHead>
                  <TableHead>Credor</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Protocolo</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {titles.map((t) => {
                  const sc = STATUS_CONFIG[t.status] || { label: t.status, variant: "secondary" as const };
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs">{t.cpf}</TableCell>
                      <TableCell>{t.nome_devedor}</TableCell>
                      <TableCell>{t.credor}</TableCell>
                      <TableCell className="text-right">
                        R$ {Number(t.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>{new Date(t.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>
                        <Badge variant={sc.variant}>{sc.label}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{t.cenprot_protocol || "—"}</TableCell>
                      <TableCell>
                        {["pending", "sent"].includes(t.status) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancel(t.id)}
                            disabled={cancelling === t.id}
                          >
                            {cancelling === t.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <XCircle className="w-4 h-4 text-destructive" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProtestoTitlesList;
