import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCPF, formatCurrency, formatDate } from "@/lib/formatters";
import { ArrowLeft, Pencil, Trash2, User } from "lucide-react";
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
import ClientUpdateHistory from "@/components/client-detail/ClientUpdateHistory";
import ClientTimeline from "@/components/atendimento/ClientTimeline";
import AgreementCalculator from "@/components/client-detail/AgreementCalculator";
import ClientDocuments from "@/components/client-detail/ClientDocuments";
import ClientSignature from "@/components/client-detail/ClientSignature";
import AgreementInstallments from "@/components/client-detail/AgreementInstallments";
import { cancelAgreement, updateAgreement, AgreementFormData } from "@/services/agreementService";
import { useTenant } from "@/hooks/useTenant";

const statusLabelsMap: Record<string, string> = {
  approved: "Pago",
  pending: "Vigente",
  pending_approval: "Aguardando Liberação",
  rejected: "Rejeitado",
  cancelled: "Cancelado",
  overdue: "Vencido",
};

const statusVariantMap: Record<string, "default" | "outline" | "secondary" | "destructive"> = {
  approved: "default",
  pending: "outline",
  pending_approval: "outline",
  overdue: "destructive",
  cancelled: "secondary",
  rejected: "secondary",
};

// Statuses that show installments
const installmentStatuses = ["pending", "pending_approval", "approved", "overdue"];
// Statuses that allow edit/cancel
const activeStatuses = ["pending", "pending_approval", "approved"];

const ClientDetailPage = () => {
  const { cpf } = useParams<{ cpf: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { tenant } = useTenant();
  const [showAcordoDialog, setShowAcordoDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("titulos");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [editingAgreement, setEditingAgreement] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<Partial<AgreementFormData>>({});
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "acordo") {
      setActiveTab("acordo");
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
      
      // Fetch creator profiles for all agreements
      const creatorIds = [...new Set((data || []).map((a: any) => a.created_by).filter(Boolean))];
      let profilesMap: Record<string, string> = {};
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", creatorIds);
        if (profiles) {
          profiles.forEach((p: any) => { profilesMap[p.user_id] = p.full_name; });
        }
      }
      
      return (data || []).map((a: any) => ({
        ...a,
        creator_name: profilesMap[a.created_by] || (a.portal_origin ? "Portal" : null),
      }));
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
  const lastAgreement = agreements[0] || null;

  const handleAgreementCreated = () => {
    setShowAcordoDialog(false);
    refetch();
    refetchAgreements();
  };

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
      entrada_value: agreement.entrada_value || 0,
      entrada_date: agreement.entrada_date || "",
      notes: agreement.notes || "",
    });
  };

  const recalcInstallmentValue = (proposed: number, entrada: number, installments: number) => {
    const remaining = Math.max(proposed - entrada, 0);
    return installments > 0 ? Math.round((remaining / installments) * 100) / 100 : remaining;
  };

  const handleEditProposed = (proposed: number) => {
    const installments = editForm.new_installments || 1;
    const entrada = (editForm as any).entrada_value || 0;
    setEditForm({ ...editForm, proposed_total: proposed, new_installment_value: recalcInstallmentValue(proposed, entrada, installments) });
  };

  // handleEditInstallments removed — installment count cannot be changed on existing agreements

  const handleEditEntrada = (entrada: number) => {
    const proposed = editForm.proposed_total || 0;
    const installments = editForm.new_installments || 1;
    setEditForm({ ...editForm, entrada_value: entrada, new_installment_value: recalcInstallmentValue(proposed, entrada, installments) });
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
        agreements={agreements}
        onFormalizarAcordo={() => setShowAcordoDialog(true)}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="titulos">Títulos em Aberto</TabsTrigger>
          <TabsTrigger value="acordo">Acordos</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="atualizacoes">Atualizações</TabsTrigger>
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
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Pago</TableHead>
                      <TableHead className="text-right">Saldo Devedor</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((c) => {
                      const isOverdue = c.status === "vencido" || (c.status === "pendente" && new Date(c.data_vencimento) < new Date());
                      const isEmAcordo = c.status === "em_acordo";
                      const statusLabel = c.status === "pago" ? "Pago" : isEmAcordo ? "Em Acordo" : isOverdue ? "Vencido" : c.status === "quebrado" ? "Quebrado" : "Em Aberto";
                      const statusClass = c.status === "pago"
                        ? "bg-green-500/10 text-green-600 border-green-500/30"
                        : isOverdue
                        ? "bg-destructive/10 text-destructive border-destructive/30"
                        : c.status === "quebrado"
                        ? "bg-muted text-muted-foreground border-muted"
                        : isEmAcordo
                        ? "bg-blue-500/10 text-blue-600 border-blue-500/30"
                        : "bg-warning/10 text-warning border-warning/30";
                      const valorEfetivo = Number(c.valor_parcela) || Number(c.valor_saldo) || 0;
                      const saldoDevedor = Math.max(0, valorEfetivo - Number(c.valor_pago));
                      return (
                        <TableRow key={c.id}>
                          <TableCell>{c.numero_parcela}/{c.total_parcelas}</TableCell>
                          <TableCell>{formatDate(c.data_vencimento)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(valorEfetivo)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(c.valor_pago))}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(saldoDevedor)}</TableCell>
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
                          <Badge variant={statusVariantMap[agreement.status] || "secondary"}>
                            {statusLabelsMap[agreement.status] || agreement.status}
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

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                          <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Credor</p>
                          <p className="text-sm font-semibold">{agreement.credor}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Operador / Canal</p>
                          <p className="text-sm font-semibold flex items-center gap-1">
                            <User className="w-3 h-3 text-muted-foreground" />
                            {agreement.creator_name || (agreement.portal_origin ? "Portal" : "—")}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Data do Acordo</p>
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

                      {/* Installments for all active statuses */}
                      {installmentStatuses.includes(agreement.status) && (
                        <AgreementInstallments
                          agreementId={agreement.id}
                          agreement={agreement}
                          cpf={cpf || ""}
                          tenantId={tenant?.id}
                          onRefresh={() => { refetch(); refetchAgreements(); }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <ClientTimeline
            dispositions={[]}
            agreements={agreements}
            clientCpf={cpf}
          />
        </TabsContent>

        <TabsContent value="atualizacoes">
          <ClientUpdateHistory clientIds={clients.map((c) => c.id)} />
        </TabsContent>

        <TabsContent value="documentos">
          <ClientDocuments
            client={first}
            clients={clients}
            cpf={cpf || ""}
            totalAberto={clients
              .filter((c) => c.status !== "pago")
              .reduce((sum, c) => sum + Math.max(0, (Number(c.valor_parcela) || Number(c.valor_saldo) || 0) - Number(c.valor_pago)), 0)}
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
        <DialogContent className="max-w-[95vw] xl:max-w-7xl max-h-[90vh] overflow-y-auto">
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <DialogTitle>Editar Acordo</DialogTitle>
              {editingAgreement && (
                <Badge variant={statusVariantMap[editingAgreement.status] || "secondary"}>
                  {statusLabelsMap[editingAgreement.status] || editingAgreement.status}
                </Badge>
              )}
            </div>
          </DialogHeader>
          {editingAgreement && (
            <div className="space-y-5">
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cliente</span>
                  <span className="font-medium">{editingAgreement.client_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">CPF</span>
                  <span className="font-medium">{editingAgreement.client_cpf}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Credor</span>
                  <span className="font-medium">{editingAgreement.credor}</span>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Valores</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Valor Original</Label>
                    <Input disabled value={`R$ ${editingAgreement.original_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                  </div>
                  <div>
                    <Label className="text-xs">Desconto</Label>
                    <Input disabled value={`${editingAgreement.discount_percent ?? 0}%`} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Valor do Acordo</Label>
                  <CurrencyInput value={editForm.proposed_total || 0} onValueChange={handleEditProposed} />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Entrada</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Valor da Entrada</Label>
                    <CurrencyInput value={(editForm as any).entrada_value || 0} onValueChange={handleEditEntrada} />
                  </div>
                  <div>
                    <Label className="text-xs">Data da Entrada</Label>
                    <Input type="date" value={(editForm as any).entrada_date || ""} onChange={e => setEditForm({ ...editForm, entrada_date: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Parcelamento</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Nº de Parcelas</Label>
                    <Input type="number" disabled value={editForm.new_installments || 1} className="bg-muted cursor-not-allowed" />
                    <p className="text-[10px] text-muted-foreground mt-1">Para alterar a quantidade de parcelas, cancele o acordo atual e gere um novo.</p>
                  </div>
                  <div>
                    <Label className="text-xs">Valor da Parcela</Label>
                    <Input disabled value={`R$ ${(editForm.new_installment_value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">1º Vencimento das Parcelas</Label>
                  <Input type="date" value={editForm.first_due_date || ""} onChange={e => setEditForm({ ...editForm, first_due_date: e.target.value })} />
                </div>
                <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground text-center">
                  {((editForm as any).entrada_value || 0) > 0
                    ? `Entrada R$ ${((editForm as any).entrada_value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} + ${editForm.new_installments || 1}x R$ ${(editForm.new_installment_value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                    : `${editForm.new_installments || 1}x R$ ${(editForm.new_installment_value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                  }
                </div>
              </div>

              <div>
                <Label className="text-xs">Observações</Label>
                <Textarea value={editForm.notes || ""} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} rows={2} />
              </div>

              <AgreementInstallments agreementId={editingAgreement.id} agreement={editingAgreement} cpf={cpf || ""} tenantId={tenant?.id} onRefresh={() => { refetch(); refetchAgreements(); }} />

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
