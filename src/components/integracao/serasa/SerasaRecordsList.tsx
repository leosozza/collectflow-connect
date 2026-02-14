import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { List, Loader2, XCircle } from "lucide-react";
import { fetchSerasaRecords, removeSerasaRecord, type SerasaRecord } from "@/services/serasaService";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "secondary" },
  sent: { label: "Enviado", variant: "default" },
  negativated: { label: "Negativado", variant: "destructive" },
  removed: { label: "Removido", variant: "outline" },
  paid: { label: "Pago", variant: "default" },
  rejected: { label: "Rejeitado", variant: "destructive" },
};

interface Props {
  refreshKey: number;
}

const SerasaRecordsList = ({ refreshKey }: Props) => {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const [records, setRecords] = useState<SerasaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [removing, setRemoving] = useState<string | null>(null);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const data = await fetchSerasaRecords({ status: statusFilter });
      setRecords(data);
    } catch (e: any) {
      toast({ title: "Erro ao carregar registros", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [statusFilter, refreshKey]);

  const handleRemove = async (id: string) => {
    if (!tenant || !user) return;
    setRemoving(id);
    try {
      await removeSerasaRecord(id, tenant.id, user.id);
      toast({ title: "Negativação removida" });
      loadRecords();
    } catch (e: any) {
      toast({ title: "Erro ao remover", description: e.message, variant: "destructive" });
    } finally {
      setRemoving(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <List className="w-5 h-5" />
              Negativações Serasa
            </CardTitle>
            <CardDescription>{records.length} registro(s)</CardDescription>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="sent">Enviado</SelectItem>
              <SelectItem value="negativated">Negativado</SelectItem>
              <SelectItem value="removed">Removido</SelectItem>
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
        ) : records.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro encontrado</p>
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
                {records.map((r) => {
                  const sc = STATUS_CONFIG[r.status] || { label: r.status, variant: "secondary" as const };
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.cpf}</TableCell>
                      <TableCell>{r.nome_devedor}</TableCell>
                      <TableCell>{r.credor}</TableCell>
                      <TableCell className="text-right">
                        R$ {Number(r.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>{new Date(r.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>
                        <Badge variant={sc.variant}>{sc.label}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.serasa_protocol || "—"}</TableCell>
                      <TableCell>
                        {["pending", "sent", "negativated"].includes(r.status) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemove(r.id)}
                            disabled={removing === r.id}
                            title="Remover negativação"
                          >
                            {removing === r.id ? (
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

export default SerasaRecordsList;
