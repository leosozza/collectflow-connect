import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCPF, formatCurrency, formatDate } from "@/lib/formatters";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import ClientAttachments from "@/components/clients/ClientAttachments";
import ClientDetailHeader from "@/components/client-detail/ClientDetailHeader";
import AgreementCalculator from "@/components/client-detail/AgreementCalculator";
import ClientDocuments from "@/components/client-detail/ClientDocuments";
import ClientSignature from "@/components/client-detail/ClientSignature";

const ClientDetailPage = () => {
  const { cpf } = useParams<{ cpf: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showAcordoDialog, setShowAcordoDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("titulos");

  // Support ?tab=acordo deep link
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "acordo") {
      setActiveTab("acordo");
      setShowAcordoDialog(true);
    }
  }, [searchParams]);

  const { data: clients = [], isLoading, refetch } = useQuery({
    queryKey: ["client-detail", cpf],
    queryFn: async () => {
      const rawCpf = (cpf || "").replace(/\D/g, "");
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

  const { data: agreements = [], refetch: refetchAgreements } = useQuery({
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
  const totalAberto = clients
    .filter((c) => c.status === "pendente")
    .reduce((sum, c) => sum + Number(c.valor_parcela), 0);
  const pendentes = clients.filter((c) => c.status === "pendente");
  const lastAgreement = agreements[0] || null;

  const handleAgreementCreated = () => {
    setShowAcordoDialog(false);
    refetch();
    refetchAgreements();
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <ClientDetailHeader
        client={first}
        clients={clients}
        cpf={cpf || ""}
        totalAberto={totalAberto}
        onFormalizarAcordo={() => setShowAcordoDialog(true)}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="titulos">Títulos em Aberto</TabsTrigger>
          <TabsTrigger value="acordo">Acordos</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="assinatura">Assinatura</TabsTrigger>
          <TabsTrigger value="anexos">Anexos</TabsTrigger>
        </TabsList>

        <TabsContent value="titulos">
          <Card>
            <CardContent className="p-0">
              {clients.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">Nenhum título encontrado</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Parcela</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Pago</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((c) => {
                      const isOverdue = c.status === "pendente" && new Date(c.data_vencimento) < new Date();
                      const statusLabel = c.status === "pago" ? "Pago" : isOverdue ? "Atrasado" : c.status === "quebrado" ? "Quebrado" : "Em Aberto";
                      const statusClass = c.status === "pago"
                        ? "bg-green-500/10 text-green-600 border-green-500/30"
                        : isOverdue
                        ? "bg-destructive/10 text-destructive border-destructive/30"
                        : c.status === "quebrado"
                        ? "bg-muted text-muted-foreground border-muted"
                        : "bg-warning/10 text-warning border-warning/30";
                      return (
                        <TableRow key={c.id}>
                        <TableCell>{c.numero_parcela}/{c.total_parcelas}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {c.observacoes?.replace(/^Modelo:\s*/i, '') || '—'}
                          </TableCell>
                          <TableCell>{formatDate(c.data_vencimento)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(c.valor_parcela))}</TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(c.valor_pago))}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={statusClass}>
                              {statusLabel}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="acordo">
          <Card>
            <CardContent className="p-6">
              {lastAgreement ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">Último Acordo</h3>
                    <Badge variant={lastAgreement.status === "approved" ? "default" : "secondary"}>
                      {lastAgreement.status === "approved" ? "Aprovado" : lastAgreement.status === "pending" ? "Pendente" : lastAgreement.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Valor Original</p>
                      <p className="text-sm font-semibold">{formatCurrency(Number(lastAgreement.original_total))}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Valor Proposto</p>
                      <p className="text-sm font-semibold">{formatCurrency(Number(lastAgreement.proposed_total))}</p>
                    </div>
                    {lastAgreement.discount_percent > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Desconto</p>
                        <p className="text-sm font-semibold text-green-600">{lastAgreement.discount_percent}%</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Parcelas</p>
                      <p className="text-sm font-semibold">{lastAgreement.new_installments}x de {formatCurrency(Number(lastAgreement.new_installment_value))}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-medium mb-1">1º Vencimento</p>
                      <p className="text-sm font-semibold">{formatDate(lastAgreement.first_due_date)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Criado em</p>
                      <p className="text-sm font-semibold">{new Date(lastAgreement.created_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                  </div>
                  {lastAgreement.notes && (
                    <div className="pt-3 border-t border-border">
                      <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Observações</p>
                      <p className="text-sm text-foreground">{lastAgreement.notes}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center text-muted-foreground">Nenhum acordo registrado</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-foreground mb-3">Histórico</h3>
              {(() => {
                const items: { id: string; date: string; type: string; content: React.ReactNode }[] = [];
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

        <TabsContent value="documentos">
          <ClientDocuments
            client={first}
            clients={clients}
            cpf={cpf || ""}
            totalAberto={totalAberto}
            lastAgreement={lastAgreement}
          />
        </TabsContent>

        <TabsContent value="assinatura">
          <ClientSignature client={first} lastAgreement={lastAgreement} />
        </TabsContent>

        <TabsContent value="anexos">
          <ClientAttachments cpf={cpf || ""} />
        </TabsContent>
      </Tabs>

      <Dialog open={showAcordoDialog} onOpenChange={setShowAcordoDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Formalizar Acordo</DialogTitle>
          </DialogHeader>
          <AgreementCalculator
            clients={clients}
            cpf={cpf || ""}
            clientName={first.nome_completo}
            credor={first.credor}
            onAgreementCreated={handleAgreementCreated}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientDetailPage;
