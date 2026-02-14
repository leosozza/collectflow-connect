import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, ScrollText, Loader2 } from "lucide-react";
import { fetchProtestLogs, type ProtestLog } from "@/services/protestoService";
import { useToast } from "@/hooks/use-toast";

interface Props {
  refreshKey: number;
}

const ProtestoLogsCard = ({ refreshKey }: Props) => {
  const { toast } = useToast();
  const [logs, setLogs] = useState<ProtestLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchProtestLogs();
        setLogs(data);
      } catch (e: any) {
        toast({ title: "Erro ao carregar logs", description: e.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [refreshKey]);

  const ACTION_LABELS: Record<string, string> = {
    send: "Envio",
    batch_send: "Envio em Lote",
    cancel: "Cancelamento",
    auto_cancel: "Cancelamento Automático",
    status_update: "Atualização de Status",
    reject: "Rejeição",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScrollText className="w-5 h-5" />
          Log de Operações
        </CardTitle>
        <CardDescription>
          {logs.length === 0 ? "Nenhuma operação registrada" : `${logs.length} operação(ões)`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma operação registrada ainda
          </p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 text-sm">
                {log.status === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-success mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-card-foreground">
                    {ACTION_LABELS[log.action] || log.action}
                  </p>
                  <p className="text-muted-foreground break-all">{log.message}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(log.created_at).toLocaleString("pt-BR")}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProtestoLogsCard;
