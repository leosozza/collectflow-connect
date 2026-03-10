import { useState, useEffect } from "react";
import { useTenant } from "@/hooks/useTenant";
import { updateTenant } from "@/services/tenantService";
import { fetchActiveServiceCatalog, fetchTenantServices, activateService, deactivateService, updateTenantServiceQuantity } from "@/services/serviceCatalogService";
import { fetchTenantTokens, fetchTokenPackages, fetchTokenTransactions } from "@/services/tokenService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import TokenBalance from "@/components/tokens/TokenBalance";
import PaymentCheckoutDialog from "@/components/financeiro/PaymentCheckoutDialog";
import PaymentHistoryCard from "@/components/financeiro/PaymentHistoryCard";
import TokenPurchaseDialog from "@/components/tokens/TokenPurchaseDialog";
import TokenHistoryTable from "@/components/tokens/TokenHistoryTable";
import ServiceCatalogGrid from "@/components/services/ServiceCatalogGrid";
import type { ServiceCatalogItem, TenantService, TenantTokens, TokenPackage, TokenTransaction } from "@/types/tokens";

const CONTRATO_PADRAO = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE SOFTWARE

CONTRATANTE: A empresa identificada nos dados cadastrais deste sistema.
CONTRATADA: CollectFlow Connect - Plataforma SaaS de Gestão de Cobrança.

CLÁUSULA 1ª - DO OBJETO
O presente contrato tem por objeto a prestação de serviços de licenciamento de uso do software CollectFlow Connect, plataforma SaaS (Software as a Service) para gestão de cobrança, incluindo funcionalidades de CRM, automação, contact center, geração de acordos, portal do devedor e integrações com serviços terceiros.

CLÁUSULA 2ª - DA VIGÊNCIA
Este contrato tem vigência indeterminada, iniciando-se na data de ativação da conta, podendo ser rescindido por qualquer das partes mediante aviso prévio de 30 (trinta) dias.

CLÁUSULA 3ª - DO VALOR E PAGAMENTO
O valor mensal será definido conforme o plano contratado e serviços adicionais selecionados. O pagamento deverá ser efetuado até o dia 10 de cada mês subsequente ao da utilização.

CLÁUSULA 4ª - DAS OBRIGAÇÕES DA CONTRATADA
a) Manter o sistema disponível com SLA mínimo de 99,5% de uptime;
b) Realizar backups diários dos dados;
c) Garantir a segurança e confidencialidade dos dados armazenados;
d) Fornecer suporte técnico em horário comercial;
e) Realizar atualizações e melhorias contínuas no sistema.

CLÁUSULA 5ª - DAS OBRIGAÇÕES DO CONTRATANTE
a) Utilizar o sistema de acordo com a legislação vigente;
b) Manter os dados de cadastro atualizados;
c) Efetuar os pagamentos nas datas acordadas;
d) Não compartilhar credenciais de acesso com terceiros não autorizados.

CLÁUSULA 6ª - DA PROTEÇÃO DE DADOS (LGPD)
Ambas as partes se comprometem a cumprir a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), sendo a CONTRATADA operadora dos dados pessoais inseridos pelo CONTRATANTE no sistema.

CLÁUSULA 7ª - DA RESCISÃO
O cancelamento pode ser solicitado a qualquer momento, com aviso prévio de 30 dias. Após a rescisão, os dados permanecerão disponíveis para exportação por 90 dias.

CLÁUSULA 8ª - DO FORO
Fica eleito o foro da comarca da sede da CONTRATADA para dirimir quaisquer questões oriundas deste contrato.`;

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const TenantSettingsPage = () => {
  const { tenant, plan, isTenantAdmin, refetch } = useTenant();
  const { toast } = useToast();
  const [name, setName] = useState(tenant?.name || "");
  const [saving, setSaving] = useState(false);

  // Services state
  const [catalog, setCatalog] = useState<ServiceCatalogItem[]>([]);
  const [tenantServices, setTenantServices] = useState<TenantService[]>([]);

  // Tokens state
  const [tokens, setTokens] = useState<TenantTokens | null>(null);
  const [packages, setPackages] = useState<TokenPackage[]>([]);
  const [transactions, setTransactions] = useState<TokenTransaction[]>([]);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const settings = (tenant?.settings as Record<string, any>) || {};
  const limits = (plan?.limits as Record<string, any>) || {};
  const contractSigned = !!settings.contract_signed_at;
  const cancellationRequested = !!settings.cancellation_requested_at;

  useEffect(() => {
    if (!tenant?.id) return;
    loadData();
  }, [tenant?.id]);

  const loadData = async () => {
    if (!tenant?.id) return;
    setLoadingData(true);
    try {
      const [catalogData, servicesData, tokensData, packagesData, txData] = await Promise.all([
        fetchActiveServiceCatalog(),
        fetchTenantServices(tenant.id),
        fetchTenantTokens(tenant.id),
        fetchTokenPackages(),
        fetchTokenTransactions(tenant.id, { limit: 50 }),
      ]);
      setCatalog(catalogData);
      setTenantServices(servicesData);
      setTokens(tokensData);
      setPackages(packagesData);
      setTransactions(txData);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoadingData(false);
    }
  };

  if (!isTenantAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
      </div>
    );
  }

  const handleSave = async () => {
    if (!tenant) return;
    setSaving(true);
    try {
      await updateTenant(tenant.id, { name });
      await refetch();
      toast({ title: "Configurações salvas!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleActivateService = async (serviceId: string, quantity: number) => {
    if (!tenant) return;
    try {
      await activateService(tenant.id, serviceId, quantity);
      await loadData();
      toast({ title: "Serviço ativado!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleDeactivateService = async (serviceId: string) => {
    if (!tenant) return;
    try {
      await deactivateService(tenant.id, serviceId);
      await loadData();
      toast({ title: "Serviço desativado" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleUpdateQuantity = async (serviceId: string, quantity: number) => {
    if (!tenant) return;
    try {
      await updateTenantServiceQuantity(tenant.id, serviceId, quantity);
      await loadData();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleCancelRequest = async () => {
    if (!tenant) return;
    try {
      await updateTenant(tenant.id, {
        settings: { ...settings, cancellation_requested_at: new Date().toISOString() },
      });
      await refetch();
      toast({ title: "Solicitação de cancelamento registrada", description: "O cancelamento será efetivado em 30 dias." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleSignContract = async () => {
    if (!tenant) return;
    try {
      await updateTenant(tenant.id, {
        settings: { ...settings, contract_signed_at: new Date().toISOString() },
      });
      await refetch();
      toast({ title: "Contrato assinado com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações da Empresa</h1>
        <p className="text-muted-foreground">Gerencie os dados, plano e serviços da sua empresa</p>
      </div>

      <Tabs defaultValue="dados">
        <TabsList>
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="contrato">Contrato</TabsTrigger>
          <TabsTrigger value="servicos">Serviços</TabsTrigger>
          <TabsTrigger value="tokens">Tokens</TabsTrigger>
          <TabsTrigger value="cancelamento">Cancelamento</TabsTrigger>
        </TabsList>

        {/* ABA DADOS */}
        <TabsContent value="dados">
          <Card>
            <CardHeader>
              <CardTitle>Dados da Empresa</CardTitle>
              <CardDescription>Informações gerais do tenant</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da empresa</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={tenant?.slug || ""} disabled />
                <p className="text-xs text-muted-foreground">O slug não pode ser alterado</p>
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Salvando..." : "Salvar alterações"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA FINANCEIRO */}
        <TabsContent value="financeiro">
          <div className="space-y-6">
            {/* Resumo Financeiro */}
            <Card>
              <CardHeader>
                <CardTitle>Resumo Financeiro</CardTitle>
                <CardDescription>Visão geral do plano e custos mensais</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground">Plano</p>
                    <p className="text-lg font-bold">{plan?.name || "Sem plano"}</p>
                    {plan && <p className="text-sm text-muted-foreground">{formatCurrency(plan.price_monthly)}/mês</p>}
                  </div>
                  <Badge>{tenant?.status === "active" ? "Ativo" : "Inativo"}</Badge>
                  {tokens && (
                    <div className="ml-auto text-right">
                      <p className="text-sm text-muted-foreground">Saldo de Tokens</p>
                      <p className="text-lg font-bold">{tokens.token_balance.toLocaleString("pt-BR")}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Extrato de Serviços */}
            <Card>
              <CardHeader>
                <CardTitle>Extrato de Serviços Contratados</CardTitle>
                <CardDescription>Detalhamento dos custos mensais da sua empresa</CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const activeServices = tenantServices.filter(ts => ts.status === "active");
                  const serviceRows = activeServices.map(ts => {
                    const catalogItem = catalog.find(c => c.id === ts.service_id);
                    const unitPrice = ts.unit_price_override ?? catalogItem?.price ?? 0;
                    const qty = ts.quantity || 1;
                    const subtotal = catalogItem?.price_type === "per_unit" ? unitPrice * qty : unitPrice;
                    return {
                      name: catalogItem?.name || "Serviço",
                      category: catalogItem?.category || "-",
                      quantity: qty,
                      unitPrice,
                      subtotal,
                      priceType: catalogItem?.price_type || "fixed",
                    };
                  });
                  const planPrice = plan?.price_monthly || 0;
                  const servicesTotal = serviceRows.reduce((sum, r) => sum + r.subtotal, 0);
                  const grandTotal = planPrice + servicesTotal;

                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Serviço</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Categoria</th>
                            <th className="text-center py-3 px-4 font-medium text-muted-foreground">Qtd</th>
                            <th className="text-right py-3 px-4 font-medium text-muted-foreground">Valor Unit.</th>
                            <th className="text-right py-3 px-4 font-medium text-muted-foreground">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Plano base */}
                          <tr className="border-b border-border/50">
                            <td className="py-3 px-4 font-medium">{plan?.name || "Plano Base"}</td>
                            <td className="py-3 px-4 text-muted-foreground">Plano</td>
                            <td className="py-3 px-4 text-center">1</td>
                            <td className="py-3 px-4 text-right">{formatCurrency(planPrice)}</td>
                            <td className="py-3 px-4 text-right font-medium">{formatCurrency(planPrice)}</td>
                          </tr>

                          {serviceRows.map((row, i) => (
                            <tr key={i} className="border-b border-border/50">
                              <td className="py-3 px-4 font-medium">{row.name}</td>
                              <td className="py-3 px-4 text-muted-foreground capitalize">{row.category}</td>
                              <td className="py-3 px-4 text-center">{row.priceType === "per_unit" ? row.quantity : "-"}</td>
                              <td className="py-3 px-4 text-right">{formatCurrency(row.unitPrice)}</td>
                              <td className="py-3 px-4 text-right font-medium">{formatCurrency(row.subtotal)}</td>
                            </tr>
                          ))}

                          {activeServices.length === 0 && (
                            <tr className="border-b border-border/50">
                              <td colSpan={5} className="py-3 px-4 text-center text-muted-foreground text-xs">
                                Nenhum serviço adicional contratado
                              </td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot>
                          <tr className="bg-muted/50">
                            <td colSpan={4} className="py-4 px-4 text-right font-bold text-base">Total Mensal</td>
                            <td className="py-4 px-4 text-right font-bold text-base text-primary">{formatCurrency(grandTotal)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {tokens && (
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setPurchaseOpen(true)}>Comprar Tokens</Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ABA CONTRATO */}
        <TabsContent value="contrato">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Contrato de Prestação de Serviços</CardTitle>
                  <CardDescription>Contrato padrão de contratação do sistema</CardDescription>
                </div>
                {contractSigned ? (
                  <Badge className="bg-green-500/10 text-green-600 border-green-200 gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Assinado
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1.5">
                    <XCircle className="w-3.5 h-3.5" /> Pendente
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-[500px] overflow-y-auto bg-muted/30 rounded-lg p-6 border border-border">
                <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-relaxed">{CONTRATO_PADRAO}</pre>
              </div>
              {!contractSigned && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="w-full">Assinar Contrato</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar Assinatura</AlertDialogTitle>
                      <AlertDialogDescription>
                        Ao confirmar, você declara ter lido e aceito todos os termos do contrato de prestação de serviços.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleSignContract}>Confirmar Assinatura</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {contractSigned && (
                <p className="text-xs text-muted-foreground">
                  Contrato assinado em {new Date(settings.contract_signed_at).toLocaleDateString("pt-BR")}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA SERVIÇOS */}
        <TabsContent value="servicos">
          <Card>
            <CardHeader>
              <CardTitle>Catálogo de Serviços</CardTitle>
              <CardDescription>Gerencie as funcionalidades contratadas</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingData ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
                  <span className="text-muted-foreground">Carregando serviços...</span>
                </div>
              ) : (
                <ServiceCatalogGrid
                  catalog={catalog}
                  tenantServices={tenantServices}
                  onActivate={handleActivateService}
                  onDeactivate={handleDeactivateService}
                  onUpdateQuantity={handleUpdateQuantity}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA TOKENS */}
        <TabsContent value="tokens">
          <div className="space-y-6">
            <TokenBalance tokens={tokens} onPurchase={() => setPurchaseOpen(true)} />

            <Card>
              <CardHeader>
                <CardTitle>Histórico de Transações</CardTitle>
                <CardDescription>Todas as movimentações de tokens</CardDescription>
              </CardHeader>
              <CardContent>
                <TokenHistoryTable transactions={transactions} loading={loadingData} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ABA CANCELAMENTO */}
        <TabsContent value="cancelamento">
          <Card>
            <CardHeader>
              <CardTitle>Cancelamento</CardTitle>
              <CardDescription>Solicitar cancelamento do plano</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Aviso Importante</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    O cancelamento pode ser solicitado a qualquer momento, porém será efetivado após um período de <strong>30 dias</strong> a contar da data da solicitação.
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">
                    Após o cancelamento, seus dados permanecerão disponíveis para exportação por 90 dias.
                  </p>
                </div>
              </div>

              {cancellationRequested ? (
                <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                  <p className="text-sm font-medium text-destructive">Cancelamento Solicitado</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Solicitado em {new Date(settings.cancellation_requested_at).toLocaleDateString("pt-BR")}.
                    O cancelamento será efetivado em {new Date(new Date(settings.cancellation_requested_at).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-BR")}.
                  </p>
                </div>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full">Solicitar Cancelamento</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar Cancelamento</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja solicitar o cancelamento? O cancelamento será efetivado em 30 dias.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Voltar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleCancelRequest} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Confirmar Cancelamento
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG: COMPRAR TOKENS */}
      <TokenPurchaseDialog
        open={purchaseOpen}
        onOpenChange={setPurchaseOpen}
        packages={packages}
        tenantId={tenant?.id || ""}
        onPurchaseComplete={loadData}
      />
    </div>
  );
};

export default TenantSettingsPage;
