import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCPF, formatCurrency, formatDate } from "@/lib/formatters";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import { toast } from "sonner";
import ClientAttachments from "@/components/clients/ClientAttachments";
import ClientDetailHeader from "@/components/client-detail/ClientDetailHeader";
import AgreementCalculator from "@/components/client-detail/AgreementCalculator";
import ClientDocuments from "@/components/client-detail/ClientDocuments";
import ClientSignature from "@/components/client-detail/ClientSignature";
import AgreementInstallments from "@/components/client-detail/AgreementInstallments";
import { cancelAgreement, updateAgreement, AgreementFormData } from "@/services/agreementService";

const ClientDetailPage = () => {
  const { cpf } = useParams<{ cpf: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showAcordoDialog, setShowAcordoDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("titulos");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [editingAgreement, setEditingAgreement] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<Partial<AgreementFormData>>({});
  const [editLoading, setEditLoading] = useState(false);

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

  const activeStatuses = ["pending", "pending_approval", "approved"];

  const handleCancelAgreement = async (id: string) => {
    try {
      await cancelAgreement(id);
      toast.success("Acordo cancelado com sucesso.");
      refetch();
      refetchAgreements();
    } catch (err: any) {
      toast.error("Erro ao cancelar acordo: " + err.message);
    }
    setCancelId(null);
  };

  const handleEditOpen = (agreement: any) => {
    setEditingAgreement(agreement);
    setEditForm({
      proposed_total: agreement.proposed_total,
      new_installments: agreement.new_installments,
      new_installment_value: agreement.new_installment_value,
      first_due_date: agreement.first_due_date,
      notes: agreement.notes || "",
    });
  };

  const handleEditProposed = (proposed: number) => {
    const installments = editForm.new_installments || 1;
    setEditForm({ ...editForm, proposed_total: proposed, new_installment_value: proposed / installments });
  };

  const handleEditInstallments = (n: number) => {
    const proposed = editForm.proposed_total || 0;
    setEditForm({ ...editForm, new_installments: n, new_installment_value: n > 0 ? proposed / n : proposed });
  };

  const handleEditSubmit = async () => {
    if (!editingAgreement) return;
    setEditLoading(true);
    try {
      await updateAgreement(editingAgreement.id, editForm);
      toast.success("Acordo atualizado com sucesso.");
      setEditingAgreement(null);
      refetchAgreements();
    } catch (err: any) {
      toast.error("Erro ao atualizar: " + err.message);
    } finally {
      setEditLoading(false);
    }
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
              {agreements.length === 0 ? (
                <p className="text-center text-muted-foreground">Nenhum acordo registrado</p>
              ) : (
                <div className="space-y-6">
                  {agreements.map((agreement: any) => (
                    <div key={agreement.id} className="space-y-4 border-b border-border pb-6 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-foreground">
                          Acordo — {new Date(agreement.created_at).toLocaleDateString("pt-BR")}
                        </h3>
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            agreement.status === "approved" ? "default" :
                            agreement.status === "pending_approval" ? "outline" :
                            "secondary"
                          }>
                            {agreement.status === "approved" ? "Aprovado" :
                             agreement.status === "pending" ? "Pendente" :
                             agreement.status === "pending_approval" ? "Aguardando Liberação" :
                             agreement.status === "rejected" ? "Rejeitado" :
                             agreement.status === "cancelled" ? "Cancelado" :
                             agreement.status}
                          </Badge>
                          {activeStatuses.includes(agreement.status) && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => handleEditOpen(agreement)} title="Editar Acordo">
                                <Pencil className="w-4 h-4 text-muted-foreground" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setCancelId(agreement.id)} title="Cancelar Acordo">
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Valor Original</p>
                          <p className="text-sm font-semibold">{formatCurrency(Number(agreement.original_total))}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Valor Proposto</p>
                          <p className="text-sm font-semibold">{formatCurrency(Number(agreement.proposed_total))}</p>
                        </div>
                        {agreement.discount_percent > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Desconto</p>
                            <p className="text-sm font-semibold text-green-600">{agreement.discount_percent}%</p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Parcelas</p>
                          <p className="text-sm font-semibold">{agreement.new_installments}x de {formatCurrency(Number(agreement.new_installment_value))}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase font-medium mb-1">1º Vencimento</p>
                          <p className="text-sm font-semibold">{formatDate(agreement.first_due_date)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Criado em</p>
                          <p className="text-sm font-semibold">{new Date(agreement.created_at).toLocaleDateString("pt-BR")}</p>
                        </div>
                      </div>
                      {agreement.approval_reason && (
                        <div className="pt-2 border-t border-border">
                          <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Motivo da Liberação</p>
                          <p className="text-sm text-orange-600">{agreement.approval_reason}</p>
                        </div>
                      )}
                      {agreement.notes && (
                        <div className="pt-2 border-t border-border">
                          <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Observações</p>
                          <p className="text-sm text-foreground">{agreement.notes}</p>
                        </div>
                      )}
                      {/* Boleto/Parcelas section for approved agreements */}
                      {agreement.status === "approved" && (
                        <AgreementInstallments agreementId={agreement.id} agreement={agreement} cpf={cpf || ""} />
                      )}
                    </div>
                  ))}
                </div>
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
            hasActiveAgreement={agreements.some((a: any) => a.status === "approved" || a.status === "pending")}
          />
        </DialogContent>
      </Dialog>

      {/* Cancel Agreement Dialog */}
      <AlertDialog open={!!cancelId} onOpenChange={(open) => !open && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Acordo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar este acordo? Os títulos originais permanecerão em aberto para futuras negociações.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não, manter</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancelId && handleCancelAgreement(cancelId)}
            >
              Sim, cancelar acordo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Agreement Dialog */}
      <Dialog open={!!editingAgreement} onOpenChange={(open) => !open && setEditingAgreement(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Acordo</DialogTitle>
          </DialogHeader>
          {editingAgreement && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Cliente</Label>
                  <Input disabled value={editingAgreement.client_name} />
                </div>
                <div>
                  <Label>Credor</Label>
                  <Input disabled value={editingAgreement.credor} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Valor Original (R$)</Label>
                  <Input disabled value={Number(editingAgreement.original_total).toFixed(2)} />
                </div>
                <div>
                  <Label>Valor Proposto (R$)</Label>
                  <CurrencyInput value={editForm.proposed_total || 0} onValueChange={handleEditProposed} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nº Parcelas</Label>
                  <Input type="number" min="1" value={editForm.new_installments || 1} onChange={e => handleEditInstallments(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Valor Parcela (R$)</Label>
                  <Input type="number" disabled value={(editForm.new_installment_value || 0).toFixed(2)} />
                </div>
              </div>
              <div>
                <Label>Primeiro Vencimento</Label>
                <Input type="date" value={editForm.first_due_date || ""} onChange={e => setEditForm({ ...editForm, first_due_date: e.target.value })} />
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea value={editForm.notes || ""} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} rows={2} />
              </div>
              <Button className="w-full" onClick={handleEditSubmit} disabled={editLoading}>
                {editLoading ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientDetailPage;
