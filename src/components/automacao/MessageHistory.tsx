import { useState, useEffect } from "react";
import { useTenant } from "@/hooks/useTenant";
import { fetchMessageLogs, MessageLog } from "@/services/automacaoService";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  sent: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  pending: "bg-yellow-100 text-yellow-800",
};

const MessageHistory = () => {
  const { tenant } = useTenant();
  const [logs, setLogs] = useState<(MessageLog & { client_name?: string; rule_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!tenant) return;
    setLoading(true);
    fetchMessageLogs(tenant.id, {
      channel: channelFilter === "all" ? undefined : channelFilter,
      status: statusFilter === "all" ? undefined : statusFilter,
    })
      .then(setLogs)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [tenant, channelFilter, statusFilter]);

  const totalSent = logs.filter((l) => l.status === "sent").length;
  const totalFailed = logs.filter((l) => l.status === "failed").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Canal:</span>
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="email">Email</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="sent">Enviado</SelectItem>
              <SelectItem value="failed">Falha</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex gap-4 text-sm">
          <span className="text-green-600 font-medium">✓ {totalSent} enviados</span>
          <span className="text-red-600 font-medium">✗ {totalFailed} falhas</span>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhuma mensagem enviada ainda.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Regra</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Destino</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-sm">
                  {format(new Date(log.created_at), "dd/MM/yyyy HH:mm")}
                </TableCell>
                <TableCell>{log.client_name || "-"}</TableCell>
                <TableCell>{log.rule_name || "-"}</TableCell>
                <TableCell>
                  <Badge variant="outline">{log.channel === "whatsapp" ? "WhatsApp" : "Email"}</Badge>
                </TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[log.status] || ""}`}>
                    {log.status === "sent" ? "Enviado" : log.status === "failed" ? "Falha" : "Pendente"}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {log.phone || log.email_to || "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

export default MessageHistory;
