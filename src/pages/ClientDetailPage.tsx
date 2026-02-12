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

      {/* Client Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase">
              <User className="w-3.5 h-3.5" /> CPF
            </div>
            <p className="text-lg font-semibold text-foreground">{formattedCpf}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase">
              <Phone className="w-3.5 h-3.5" /> Telefone
            </div>
            <p className="text-lg font-semibold text-foreground">
              {first.phone ? formatPhone(first.phone) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase">
              <Mail className="w-3.5 h-3.5" /> Email
            </div>
            <p className="text-sm font-semibold text-foreground truncate">
              {first.email || "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase">
              <Building className="w-3.5 h-3.5" /> Credor
            </div>
            <p className="text-lg font-semibold text-foreground">{first.credor}</p>
          </CardContent>
        </Card>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total em Aberto</p>
              <p className="text-xl font-bold text-destructive">{formatCurrency(totalAberto)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <DollarSign className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Pago</p>
              <p className="text-xl font-bold text-success">{formatCurrency(totalPago)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <UserCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Parcelas</p>
              <p className="text-xl font-bold text-foreground">
                {clients.filter((c) => c.status === "pago").length}/{clients.length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="titulos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="titulos">Títulos em Aberto</TabsTrigger>
          <TabsTrigger value="historico">Histórico e Ocorrências</TabsTrigger>
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

        {/* Tab: Historico */}
        <TabsContent value="historico" className="space-y-4">
          {/* Agreements */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-foreground mb-3">Acordos</h3>
              {agreements.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum acordo registrado</p>
              ) : (
                <div className="space-y-3">
                  {agreements.map((a) => (
                    <div key={a.id} className="border border-border rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{a.credor}</span>
                        <Badge variant={a.status === "approved" ? "default" : "secondary"}>
                          {a.status === "approved" ? "Aprovado" : a.status === "pending" ? "Pendente" : a.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Original: {formatCurrency(Number(a.original_total))} → Proposta: {formatCurrency(Number(a.proposed_total))}
                        {a.discount_percent ? ` (${a.discount_percent}% desc.)` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {a.new_installments}x de {formatCurrency(Number(a.new_installment_value))} — Início: {formatDate(a.first_due_date)}
                      </p>
                      {a.notes && <p className="text-xs text-muted-foreground italic">{a.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audit logs */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-foreground mb-3">Ocorrências</h3>
              {auditLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma ocorrência registrada</p>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map((log: any) => (
                    <div key={log.id} className="flex items-start gap-3 text-sm border-b border-border pb-2 last:border-0">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("pt-BR")}
                      </span>
                      <div>
                        <span className="font-medium">{log.user_name || "Sistema"}</span>
                        <span className="text-muted-foreground"> — {log.action}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Anexos */}
        <TabsContent value="anexos">
          <ClientAttachments cpf={cpf || ""} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClientDetailPage;
