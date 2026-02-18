import { useState, useEffect, useMemo } from "react";
import { useTenant } from "@/hooks/useTenant";
import { fetchAllTenants, updateTenant } from "@/services/tenantService";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Building2, CheckCircle, Ban, Trash2, RotateCcw, Copy, Check,
  DollarSign, Search, Settings2, Archive, Pencil, Plus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan_name?: string;
  created_at: string;
  settings?: Record<string, any>;
  cnpj?: string;
  deleted_at?: string;
}

const SERVICE_CATALOG = [
  { key: "whatsapp", label: "WhatsApp", description: "Atendimento via WhatsApp (1 instância + 1 agente IA incluso)", price: 99.0 },
  { key: "whatsapp_extra_instance", label: "Instância WhatsApp Adicional", description: "Cada instância adicional de WhatsApp", price: 49.0 },
  { key: "ai_agent", label: "Agente de IA Digital", description: "Agente inteligente para atendimento automatizado", price: null },
  { key: "negativacao", label: "Negativação Serasa/Protesto", description: "Integração com Serasa e Protesto cartorial", price: null },
  { key: "assinatura", label: "Assinatura Digital", description: "Assinatura por click, facial ou desenho", price: null },
];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const SuperAdminPage = () => {
  const { isSuperAdmin } = useTenant();
  const { toast } = useToast();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceSheet, setServiceSheet] = useState<TenantRow | null>(null);
  const [editSheet, setEditSheet] = useState<TenantRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editCnpj, setEditCnpj] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<TenantRow | null>(null);
  const [searchDeleted, setSearchDeleted] = useState("");
  const [copied, setCopied] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientSlug, setNewClientSlug] = useState("");
  const [newClientCnpj, setNewClientCnpj] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);

  const loadTenants = async () => {
    try {
      const data = await fetchAllTenants();
      setTenants(data as TenantRow[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const activeTenants = useMemo(() => tenants.filter(t => t.status !== "deleted"), [tenants]);
  const deletedTenants = useMemo(() => {
    const deleted = tenants.filter(t => t.status === "deleted");
    if (!searchDeleted) return deleted;
    const q = searchDeleted.toLowerCase();
    return deleted.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.cnpj?.toLowerCase().includes(q) ||
      t.slug.toLowerCase().includes(q)
    );
  }, [tenants, searchDeleted]);

  const stats = useMemo(() => {
    const active = tenants.filter(t => t.status === "active").length;
    const suspended = tenants.filter(t => t.status === "suspended").length;
    const deleted = tenants.filter(t => t.status === "deleted").length;
    let revenue = 0;
    tenants.filter(t => t.status === "active").forEach(t => {
      const svcs = (t.settings as any)?.enabled_services || {};
      if (svcs.whatsapp) revenue += 99;
      const extraInstances = svcs.whatsapp_extra_instances || 0;
      revenue += extraInstances * 49;
    });
    return { total: tenants.length, active, suspended, deleted, revenue };
  }, [tenants]);

  const toggleStatus = async (tenant: TenantRow) => {
    const newStatus = tenant.status === "active" ? "suspended" : "active";
    try {
      await updateTenant(tenant.id, { status: newStatus });
      toast({ title: `Empresa ${newStatus === "active" ? "ativada" : "suspensa"}` });
      loadTenants();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const softDelete = async () => {
    if (!deleteTarget) return;
    try {
      // Use raw update for deleted_at and status
      const { error } = await supabase
        .from("tenants")
        .update({ status: "deleted", deleted_at: new Date().toISOString() } as any)
        .eq("id", deleteTarget.id);
      if (error) throw error;
      toast({ title: "Empresa excluída", description: "A empresa foi movida para a aba de excluídos." });
      setDeleteTarget(null);
      loadTenants();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const reactivate = async (tenant: TenantRow) => {
    try {
      const { error } = await supabase
        .from("tenants")
        .update({ status: "active", deleted_at: null } as any)
        .eq("id", tenant.id);
      if (error) throw error;
      toast({ title: "Empresa reativada!" });
      loadTenants();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const toggleService = async (tenant: TenantRow, serviceKey: string, enabled: boolean) => {
    const settings = (tenant.settings || {}) as Record<string, any>;
    const enabledServices = settings.enabled_services || {};
    const newEnabledServices = { ...enabledServices, [serviceKey]: enabled };
    try {
      await updateTenant(tenant.id, { settings: { ...settings, enabled_services: newEnabledServices } });
      toast({ title: enabled ? "Serviço liberado" : "Serviço removido" });
      loadTenants();
      // Update the sheet state
      setServiceSheet(prev => prev ? { ...prev, settings: { ...settings, enabled_services: newEnabledServices } } : null);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const copyRegistrationLink = () => {
    const url = `${window.location.origin}/onboarding?ref=superadmin`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast({ title: "Link copiado!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const openEditSheet = (tenant: TenantRow) => {
    setEditName(tenant.name);
    setEditCnpj(tenant.cnpj || "");
    setEditSlug(tenant.slug);
    setEditSheet(tenant);
  };

  const saveEdit = async () => {
    if (!editSheet) return;
    try {
      const { error } = await supabase
        .from("tenants")
        .update({ name: editName, cnpj: editCnpj } as any)
        .eq("id", editSheet.id);
      if (error) throw error;
      toast({ title: "Empresa atualizada!" });
      setEditSheet(null);
      loadTenants();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const createNewClient = async () => {
    if (!newClientName || !newClientSlug) {
      toast({ title: "Preencha nome e slug", variant: "destructive" });
      return;
    }
    setCreatingClient(true);
    try {
      // Get first active plan
      const { data: plans } = await supabase.from("plans").select("id").eq("is_active", true).limit(1);
      const planId = plans?.[0]?.id;
      if (!planId) throw new Error("Nenhum plano disponível");

      const { error } = await supabase.from("tenants").insert({
        name: newClientName,
        slug: newClientSlug,
        cnpj: newClientCnpj || null,
        plan_id: planId,
        status: "active",
      } as any);
      if (error) throw error;
      toast({ title: "Cliente criado com sucesso!" });
      setNewClientName("");
      setNewClientSlug("");
      setNewClientCnpj("");
      loadTenants();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setCreatingClient(false);
    }
  };

  const getActiveServicesCount = (tenant: TenantRow) => {
    const svcs = (tenant.settings as any)?.enabled_services || {};
    return Object.values(svcs).filter(Boolean).length;
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Acesso restrito a Super Admins.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestão de Tenants</h1>
          <p className="text-muted-foreground">Painel global de empresas e serviços</p>
        </div>
        <Button variant="outline" size="sm" onClick={copyRegistrationLink} className="gap-1.5">
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copiado!" : "Copiar link de cadastro"}
        </Button>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="empresas">Empresas</TabsTrigger>
          <TabsTrigger value="novo">Novo Cliente</TabsTrigger>
        </TabsList>

        {/* ========== DASHBOARD ========== */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Total</span>
                </div>
                <p className="text-2xl font-bold mt-1">{stats.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Ativas</span>
                </div>
                <p className="text-2xl font-bold mt-1">{stats.active}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2">
                  <Ban className="w-4 h-4 text-destructive" />
                  <span className="text-xs text-muted-foreground">Suspensas</span>
                </div>
                <p className="text-2xl font-bold mt-1">{stats.suspended}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2">
                  <Archive className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Excluídas</span>
                </div>
                <p className="text-2xl font-bold mt-1">{stats.deleted}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Receita Est.</span>
                </div>
                <p className="text-2xl font-bold mt-1">{formatCurrency(stats.revenue)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Últimas Empresas Criadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {activeTenants.slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.slug} · {t.plan_name || "Sem plano"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={t.status === "active" ? "default" : "destructive"} className="text-xs">
                        {t.status === "active" ? "Ativo" : "Suspenso"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(t.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </div>
                ))}
                {activeTenants.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma empresa cadastrada</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== EMPRESAS ========== */}
        <TabsContent value="empresas" className="space-y-4">
          <Tabs defaultValue="ativas">
            <TabsList>
              <TabsTrigger value="ativas">Ativas ({activeTenants.length})</TabsTrigger>
              <TabsTrigger value="excluidas">Excluídas ({deletedTenants.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="ativas">
              <Card>
                <CardContent className="pt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Serviços</TableHead>
                        <TableHead>Criado em</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">Carregando...</TableCell>
                        </TableRow>
                      ) : activeTenants.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma empresa</TableCell>
                        </TableRow>
                      ) : (
                        activeTenants.map(t => (
                          <TableRow key={t.id}>
                            <TableCell>
                              <p className="font-medium">{t.name}</p>
                              <p className="text-xs text-muted-foreground">{t.slug}</p>
                            </TableCell>
                            <TableCell>{t.plan_name || "-"}</TableCell>
                            <TableCell>
                              <Badge variant={t.status === "active" ? "default" : "destructive"}>
                                {t.status === "active" ? "Ativo" : "Suspenso"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{getActiveServicesCount(t)} ativos</Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {new Date(t.created_at).toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" title="Editar" onClick={() => openEditSheet(t)}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" title="Gerenciar Serviços" onClick={() => setServiceSheet(t)}>
                                  <Settings2 className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" title={t.status === "active" ? "Suspender" : "Ativar"} onClick={() => toggleStatus(t)}>
                                  {t.status === "active" ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                                </Button>
                                <Button variant="ghost" size="icon" title="Excluir" onClick={() => setDeleteTarget(t)}>
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="excluidas">
              <Card>
                <CardContent className="pt-4 space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, CNPJ ou slug..."
                      className="pl-9"
                      value={searchDeleted}
                      onChange={e => setSearchDeleted(e.target.value)}
                    />
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Empresa</TableHead>
                        <TableHead>CNPJ</TableHead>
                        <TableHead>Excluído em</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deletedTenants.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            {searchDeleted ? "Nenhum resultado encontrado" : "Nenhuma empresa excluída"}
                          </TableCell>
                        </TableRow>
                      ) : (
                        deletedTenants.map(t => (
                          <TableRow key={t.id}>
                            <TableCell>
                              <p className="font-medium">{t.name}</p>
                              <p className="text-xs text-muted-foreground">{t.slug}</p>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{t.cnpj || "-"}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {t.deleted_at ? new Date(t.deleted_at).toLocaleDateString("pt-BR") : "-"}
                            </TableCell>
                            <TableCell>
                              <Button variant="outline" size="sm" onClick={() => reactivate(t)} className="gap-1.5">
                                <RotateCcw className="w-3.5 h-3.5" /> Reativar
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ========== NOVO CLIENTE ========== */}
        <TabsContent value="novo">
          <Card>
            <CardHeader>
              <CardTitle>Cadastrar Novo Cliente</CardTitle>
              <CardDescription>Crie uma nova empresa manualmente no sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-lg">
              <div className="space-y-2">
                <Label>Nome da empresa</Label>
                <Input value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="Ex: Empresa ABC Ltda" />
              </div>
              <div className="space-y-2">
                <Label>Slug (identificador único)</Label>
                <Input value={newClientSlug} onChange={e => setNewClientSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="ex: empresa-abc" />
                <p className="text-xs text-muted-foreground">Apenas letras minúsculas, números e hífens</p>
              </div>
              <div className="space-y-2">
                <Label>CNPJ (opcional)</Label>
                <Input value={newClientCnpj} onChange={e => setNewClientCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
              </div>
              <Button onClick={createNewClient} disabled={creatingClient} className="gap-1.5">
                <Plus className="w-4 h-4" />
                {creatingClient ? "Criando..." : "Criar Empresa"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ========== SHEET: GERENCIAR SERVIÇOS ========== */}
      <Sheet open={!!serviceSheet} onOpenChange={(open) => !open && setServiceSheet(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Serviços - {serviceSheet?.name}</SheetTitle>
            <SheetDescription>Libere ou remova funcionalidades para esta empresa</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {SERVICE_CATALOG.map(svc => {
              const enabledServices = (serviceSheet?.settings as any)?.enabled_services || {};
              const isEnabled = !!enabledServices[svc.key];
              return (
                <div key={svc.key} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="flex-1 mr-3">
                    <p className="text-sm font-medium">{svc.label}</p>
                    <p className="text-xs text-muted-foreground">{svc.description}</p>
                    <p className="text-xs font-semibold text-primary mt-1">
                      {svc.price !== null ? `${formatCurrency(svc.price)}/mês` : "Valor a definir"}
                    </p>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) => serviceSheet && toggleService(serviceSheet, svc.key, checked)}
                  />
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* ========== SHEET: EDITAR EMPRESA ========== */}
      <Sheet open={!!editSheet} onOpenChange={(open) => !open && setEditSheet(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Editar Empresa</SheetTitle>
            <SheetDescription>Atualize os dados da empresa</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Nome da empresa</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={editSlug} disabled />
              <p className="text-xs text-muted-foreground">O slug não pode ser alterado</p>
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input value={editCnpj} onChange={e => setEditCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
            </div>
            <Button onClick={saveEdit} className="w-full">Salvar Alterações</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ========== ALERT: CONFIRMAR EXCLUSÃO ========== */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a empresa <strong>{deleteTarget?.name}</strong>? Ela será movida para a aba de excluídos e poderá ser reativada no futuro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={softDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SuperAdminPage;
