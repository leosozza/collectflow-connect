import { useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { updateTenant } from "@/services/tenantService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

const SERVICE_CATALOG = [
  { key: "whatsapp", label: "WhatsApp", description: "Atendimento via WhatsApp (1 instância + 1 agente IA incluso)", price: 99.0 },
  { key: "whatsapp_extra_instance", label: "Instância WhatsApp Adicional", description: "Cada instância adicional de WhatsApp", price: 49.0 },
  { key: "ai_agent", label: "Agente de IA Digital", description: "Agente inteligente para atendimento automatizado", price: null },
  { key: "negativacao", label: "Negativação Serasa/Protesto", description: "Integração com Serasa e Protesto cartorial", price: null },
  { key: "assinatura", label: "Assinatura Digital", description: "Assinatura por click, facial ou desenho", price: null },
];

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
  const [primaryColor, setPrimaryColor] = useState(tenant?.primary_color || "#F97316");
  const [saving, setSaving] = useState(false);
  const [confirmService, setConfirmService] = useState<typeof SERVICE_CATALOG[0] | null>(null);
  const settings = (tenant?.settings as Record<string, any>) || {};

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
      await updateTenant(tenant.id, { name, primary_color: primaryColor });
      await refetch();
      toast({ title: "Configurações salvas!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleService = async (serviceKey: string, enabled: boolean) => {
    if (!tenant) return;
    const currentServices = settings.services || {};
    const newServices = { ...currentServices, [serviceKey]: enabled };
    try {
      await updateTenant(tenant.id, { settings: { ...settings, services: newServices } });
      await refetch();
      toast({ title: enabled ? "Serviço ativado" : "Serviço desativado" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleContractService = async () => {
    if (!confirmService || !tenant) return;
    await handleToggleService(confirmService.key, true);
    setConfirmService(null);
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

  const limits = (plan?.limits as Record<string, any>) || {};
  const contractSigned = !!settings.contract_signed_at;
  const cancellationRequested = !!settings.cancellation_requested_at;
  const services = settings.services || {};
  const enabledServices = settings.enabled_services || {};

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
              <div className="space-y-2">
                <Label>Cor primária</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border-0"
                  />
                  <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-32" />
                </div>
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Salvando..." : "Salvar alterações"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA FINANCEIRO */}
        <TabsContent value="financeiro">
          <Card>
            <CardHeader>
              <CardTitle>Plano Atual</CardTitle>
              <CardDescription>Detalhes do seu plano e uso</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold">{plan?.name || "Sem plano"}</p>
                  <p className="text-sm text-muted-foreground">
                    {plan ? formatCurrency(plan.price_monthly) + "/mês" : ""}
                  </p>
                </div>
                <Badge>{tenant?.status === "active" ? "Ativo" : "Inativo"}</Badge>
              </div>

              {limits.max_users && (
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Usuários</span>
                    <span className="text-muted-foreground">Limite: {limits.max_users}</span>
                  </div>
                  <Progress value={0} className="h-2" />
                </div>
              )}

              {limits.max_clients && (
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Clientes</span>
                    <span className="text-muted-foreground">Limite: {limits.max_clients?.toLocaleString()}</span>
                  </div>
                  <Progress value={0} className="h-2" />
                </div>
              )}

              <div className="border-t border-border pt-4">
                <p className="text-sm font-medium mb-2">Serviços Adicionais Ativos</p>
                <div className="flex flex-wrap gap-2">
                  {SERVICE_CATALOG.filter(s => services[s.key] || enabledServices[s.key]).map(s => (
                    <Badge key={s.key} variant="secondary">
                      {s.label} {s.price ? `- ${formatCurrency(s.price)}/mês` : ""}
                    </Badge>
                  ))}
                  {!SERVICE_CATALOG.some(s => services[s.key] || enabledServices[s.key]) && (
                    <p className="text-xs text-muted-foreground">Nenhum serviço adicional ativo</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
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
              <CardTitle>Serviços Disponíveis</CardTitle>
              <CardDescription>Gerencie as funcionalidades contratadas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {SERVICE_CATALOG.map(s => {
                const isEnabledBySuperAdmin = !!enabledServices[s.key];
                const isActiveByTenant = !!services[s.key];
                const isActive = isEnabledBySuperAdmin || isActiveByTenant;

                return (
                  <div key={s.key} className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{s.label}</p>
                        {isEnabledBySuperAdmin && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Incluso</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{s.description}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      {isEnabledBySuperAdmin ? (
                        <span className="text-xs text-primary font-medium">Ativo</span>
                      ) : s.price !== null ? (
                        <>
                          <span className="text-sm font-semibold text-foreground">{formatCurrency(s.price)}/mês</span>
                          {isActiveByTenant ? (
                            <Switch checked onCheckedChange={() => handleToggleService(s.key, false)} />
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => setConfirmService(s)}>
                              Contratar
                            </Button>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Em breve</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
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

      {/* DIALOG: CONFIRMAR CONTRATAÇÃO */}
      <AlertDialog open={!!confirmService} onOpenChange={(open) => !open && setConfirmService(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Contratação</AlertDialogTitle>
            <AlertDialogDescription>
              O valor de <strong>{confirmService?.price ? formatCurrency(confirmService.price) : ""}/mês</strong> será adicionado à sua próxima fatura, proporcional à data de contratação. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleContractService}>Confirmar Contratação</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TenantSettingsPage;
