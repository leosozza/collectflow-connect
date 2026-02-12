import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCPF, formatCurrency, formatDate, formatPhone } from "@/lib/formatters";
import { ArrowLeft, User, Phone, Mail, Building, UserCheck, DollarSign, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import ClientAttachments from "@/components/clients/ClientAttachments";

const ClientDetailPage = () => {
  const { cpf } = useParams<{ cpf: string }>();
  const navigate = useNavigate();

  // Fetch all client records for this CPF (handle both raw and formatted)
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["client-detail", cpf],
    queryFn: async () => {
      const rawCpf = (cpf || "").replace(/\D/g, "");
      // Try both raw digits and formatted CPF
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .or(`cpf.eq.${rawCpf},cpf.eq.${formatCPF(rawCpf)}`)
        .order("numero_parcela", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!cpf,
  });

  // Fetch agreements for this CPF
  const { data: agreements = [] } = useQuery({
    queryKey: ["client-agreements", cpf],
    queryFn: async () => {
      const rawCpf = (cpf || "").replace(/\D/g, "");
      const { data, error } = await supabase
        .from("agreements")
        .select("*")
        .or(`client_cpf.eq.${rawCpf},client_cpf.eq.${formatCPF(rawCpf)}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!cpf,
  });

  // Fetch audit logs related to this CPF
  const { data: auditLogs = [] } = useQuery({
    queryKey: ["client-audit", cpf],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("entity_type", "client")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      // Filter by CPF in details
      return (data || []).filter((log: any) => {
        const details = log.details as any;
        return details?.cpf === cpf || details?.cpf === formatCPF(cpf || "");
      });
    },
    enabled: !!cpf,
  });

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;
  }

  if (clients.length === 0) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-muted-foreground">Cliente não encontrado</p>
        <Button variant="outline" onClick={() => navigate("/carteira")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  const first = clients[0];
  const formattedCpf = formatCPF(cpf || "");
  const totalAberto = clients
    .filter((c) => c.status === "pendente")
    .reduce((sum, c) => sum + Number(c.valor_parcela), 0);
  const totalPago = clients.reduce((sum, c) => sum + Number(c.valor_pago), 0);
  const pendentes = clients.filter((c) => c.status === "pendente");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/carteira")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{first.nome_completo}</h1>
          <p className="text-muted-foreground text-sm">Detalhes do cliente</p>
        </div>
      </div>

      {/* Client Info - Clean list style */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase font-medium mb-1">CPF</p>
            <p className="text-sm font-semibold text-foreground">{formattedCpf}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Telefone</p>
            <p className="text-sm font-semibold text-foreground">{first.phone ? formatPhone(first.phone) : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Email</p>
            <p className="text-sm font-semibold text-foreground truncate">{first.email || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Credor</p>
            <p className="text-sm font-semibold text-foreground">{first.credor}</p>
          </div>
        </div>
        <div className="border-t border-border mt-4 pt-4 grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Total em Aberto</p>
            <p className="text-lg font-bold text-destructive">{formatCurrency(totalAberto)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Pago</p>
            <p className="text-lg font-bold text-success">{formatCurrency(totalPago)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Parcelas</p>
            <p className="text-lg font-bold text-foreground">
              {clients.filter((c) => c.status === "pago").length}/{clients.length}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="titulos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="titulos">Títulos em Aberto</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="anexos">Anexos</TabsTrigger>
        </TabsList>

        {/* Tab: Titulos */}
        <TabsContent value="titulos">
          <Card>
            <CardContent className="p-0">
              {pendentes.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">Nenhum título em aberto</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Parcela</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Pago</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendentes.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.numero_parcela}/{c.total_parcelas}</TableCell>
                        <TableCell>{formatDate(c.data_vencimento)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(c.valor_parcela))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(c.valor_pago))}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                            Pendente
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-foreground mb-3">Histórico</h3>
              {(() => {
                // Merge agreements and audit logs into a single chronological list
                const items: { id: string; date: string; type: "acordo" | "ocorrencia"; content: React.ReactNode }[] = [];

                agreements.forEach((a) => {
                  items.push({
                    id: `a-${a.id}`,
                    date: a.created_at,
                    type: "acordo",
                    content: (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={a.status === "approved" ? "default" : "secondary"} className="text-xs">
                            Acordo {a.status === "approved" ? "Aprovado" : a.status === "pending" ? "Pendente" : a.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{a.credor}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Original: {formatCurrency(Number(a.original_total))} → Proposta: {formatCurrency(Number(a.proposed_total))}
                          {a.discount_percent ? ` (${a.discount_percent}% desc.)` : ""} — {a.new_installments}x de {formatCurrency(Number(a.new_installment_value))}
                        </p>
                        {a.notes && <p className="text-xs text-muted-foreground italic">{a.notes}</p>}
                      </div>
                    ),
                  });
                });

                auditLogs.forEach((log: any) => {
                  items.push({
                    id: `l-${log.id}`,
                    date: log.created_at,
                    type: "ocorrencia",
                    content: (
                      <div>
                        <span className="text-sm font-medium">{log.user_name || "Sistema"}</span>
                        <span className="text-sm text-muted-foreground"> — {log.action}</span>
                      </div>
                    ),
                  });
                });

                items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                if (items.length === 0) {
                  return <p className="text-sm text-muted-foreground">Nenhum registro encontrado</p>;
                }

                return (
                  <div className="space-y-3">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-start gap-3 border-b border-border pb-3 last:border-0">
                        <span className="text-xs text-muted-foreground whitespace-nowrap pt-0.5">
                          {new Date(item.date).toLocaleString("pt-BR")}
                        </span>
                        <div className="flex-1">{item.content}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClientDetailPage;
