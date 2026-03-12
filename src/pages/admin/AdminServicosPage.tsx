import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Package, Coins, CreditCard } from "lucide-react";
import { fetchServiceCatalog, createService, updateService } from "@/services/serviceCatalogService";
import { fetchAllTokenPackages, createTokenPackage, updateTokenPackage } from "@/services/tokenService";
import { supabase } from "@/integrations/supabase/client";
import type { ServiceCatalogItem, ServiceCatalogCreateInput, ServiceCatalogUpdateInput, ServiceCategory, ServicePriceType, TokenPackage } from "@/types/tokens";
import { CATEGORY_LABELS } from "@/types/tokens";

interface Plan {
  id: string;
  name: string;
  slug: string;
  price_monthly: number;
  limits: Record<string, any>;
  is_active: boolean;
}

const AdminServicosPage = () => {
  const { toast } = useToast();

  // Catalog state
  const [catalog, setCatalog] = useState<ServiceCatalogItem[]>([]);
  const [packages, setPackages] = useState<TokenPackage[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  // Service form
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceCatalogItem | null>(null);
  const [serviceForm, setServiceForm] = useState({
    service_code: "",
    name: "",
    description: "",
    price: 0,
    price_type: "monthly" as ServicePriceType,
    unit_label: "",
    category: "core" as ServiceCategory,
    tokens_required: 0,
    icon: "",
  });

  // Package form
  const [pkgDialogOpen, setPkgDialogOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<TokenPackage | null>(null);
  const [pkgForm, setPkgForm] = useState({
    name: "",
    description: "",
    token_amount: 100,
    bonus_tokens: 0,
    price: 50,
    discount_percentage: 0,
    is_featured: false,
    display_order: 0,
  });

  // Plan form
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [planForm, setPlanForm] = useState({
    name: "",
    slug: "",
    price_monthly: 0,
    max_users: 6,
    max_clients: 500,
    is_custom: false,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([fetchServiceCatalog(), fetchAllTokenPackages()]);
      setCatalog(c);
      setPackages(p);
      const { data: plansData } = await supabase.from("plans").select("*").order("price_monthly", { ascending: true });
      setPlans((plansData as Plan[]) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Service CRUD
  const openNewService = () => {
    setEditingService(null);
    setServiceForm({ service_code: "", name: "", description: "", price: 0, price_type: "monthly", unit_label: "", category: "core", tokens_required: 0, icon: "" });
    setServiceDialogOpen(true);
  };

  const openEditService = (s: ServiceCatalogItem) => {
    setEditingService(s);
    setServiceForm({
      service_code: s.service_code,
      name: s.name,
      description: s.description || "",
      price: s.price,
      price_type: s.price_type,
      unit_label: s.unit_label || "",
      category: s.category as ServiceCategory,
      tokens_required: s.tokens_required,
      icon: s.icon || "",
    });
    setServiceDialogOpen(true);
  };

  const handleSaveService = async () => {
    try {
      if (editingService) {
        const updates: ServiceCatalogUpdateInput = {
          name: serviceForm.name,
          description: serviceForm.description,
          price: serviceForm.price,
          price_type: serviceForm.price_type,
          unit_label: serviceForm.unit_label || undefined,
          category: serviceForm.category,
          tokens_required: serviceForm.tokens_required,
          icon: serviceForm.icon || undefined,
        };
        await updateService(editingService.id, updates);
        toast({ title: "Serviço atualizado!" });
      } else {
        const input: ServiceCatalogCreateInput = {
          service_code: serviceForm.service_code,
          name: serviceForm.name,
          description: serviceForm.description,
          price: serviceForm.price,
          price_type: serviceForm.price_type,
          unit_label: serviceForm.unit_label || undefined,
          category: serviceForm.category,
          tokens_required: serviceForm.tokens_required,
          icon: serviceForm.icon || undefined,
        };
        await createService(input);
        toast({ title: "Serviço criado!" });
      }
      setServiceDialogOpen(false);
      await loadData();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleToggleService = async (s: ServiceCatalogItem) => {
    try {
      await updateService(s.id, { is_active: !s.is_active });
      await loadData();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  // Package CRUD
  const openNewPkg = () => {
    setEditingPkg(null);
    setPkgForm({ name: "", description: "", token_amount: 100, bonus_tokens: 0, price: 50, discount_percentage: 0, is_featured: false, display_order: 0 });
    setPkgDialogOpen(true);
  };

  const openEditPkg = (p: TokenPackage) => {
    setEditingPkg(p);
    setPkgForm({
      name: p.name,
      description: p.description || "",
      token_amount: p.token_amount,
      bonus_tokens: p.bonus_tokens,
      price: p.price,
      discount_percentage: p.discount_percentage,
      is_featured: p.is_featured,
      display_order: p.display_order,
    });
    setPkgDialogOpen(true);
  };

  const handleSavePkg = async () => {
    try {
      if (editingPkg) {
        await updateTokenPackage(editingPkg.id, pkgForm as any);
        toast({ title: "Pacote atualizado!" });
      } else {
        await createTokenPackage(pkgForm as any);
        toast({ title: "Pacote criado!" });
      }
      setPkgDialogOpen(false);
      await loadData();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  // Plan CRUD
  const openEditPlan = (p: Plan) => {
    setEditingPlan(p);
    const limits = p.limits || {};
    setPlanForm({
      name: p.name,
      slug: p.slug,
      price_monthly: p.price_monthly,
      max_users: limits.max_users || 6,
      max_clients: limits.max_clients || 500,
      is_custom: !!limits.custom,
    });
    setPlanDialogOpen(true);
  };

  const handleSavePlan = async () => {
    if (!editingPlan) return;
    try {
      const existingLimits = editingPlan.limits || {};
      const newLimits = {
        ...existingLimits,
        max_users: planForm.max_users,
        max_clients: planForm.max_clients,
        custom: planForm.is_custom,
      };
      const { error } = await supabase
        .from("plans")
        .update({
          name: planForm.name,
          price_monthly: planForm.price_monthly,
          limits: newLimits,
        } as any)
        .eq("id", editingPlan.id);
      if (error) throw error;
      toast({ title: "Plano atualizado!" });
      setPlanDialogOpen(false);
      await loadData();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleTogglePlan = async (p: Plan) => {
    try {
      const { error } = await supabase
        .from("plans")
        .update({ is_active: !p.is_active } as any)
        .eq("id", p.id);
      if (error) throw error;
      await loadData();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
        <span className="text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gestão de Serviços</h1>
        <p className="text-muted-foreground">Gerencie catálogo de serviços, pacotes de tokens e planos</p>
      </div>

      <Tabs defaultValue="catalogo">
        <TabsList>
          <TabsTrigger value="catalogo">
            <Package className="w-4 h-4 mr-1.5" /> Catálogo
          </TabsTrigger>
          <TabsTrigger value="pacotes">
            <Coins className="w-4 h-4 mr-1.5" /> Pacotes de Tokens
          </TabsTrigger>
          <TabsTrigger value="planos">
            <CreditCard className="w-4 h-4 mr-1.5" /> Planos
          </TabsTrigger>
        </TabsList>

        {/* CATÁLOGO */}
        <TabsContent value="catalogo">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Catálogo de Serviços</CardTitle>
                <CardDescription>{catalog.length} serviços cadastrados</CardDescription>
              </div>
              <Button onClick={openNewService} size="sm">
                <Plus className="w-4 h-4 mr-1" /> Novo Serviço
              </Button>
            </CardHeader>
            <CardContent>
              <div className="border border-border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Tokens</TableHead>
                      <TableHead>Ativo</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {catalog.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs">{s.service_code}</TableCell>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {CATEGORY_LABELS[s.category as ServiceCategory] || s.category}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(s.price)}</TableCell>
                        <TableCell className="text-xs">{s.price_type}</TableCell>
                        <TableCell>{s.tokens_required}</TableCell>
                        <TableCell>
                          <Switch checked={s.is_active} onCheckedChange={() => handleToggleService(s)} />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => openEditService(s)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PACOTES */}
        <TabsContent value="pacotes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Pacotes de Tokens</CardTitle>
                <CardDescription>{packages.length} pacotes disponíveis</CardDescription>
              </div>
              <Button onClick={openNewPkg} size="sm">
                <Plus className="w-4 h-4 mr-1" /> Novo Pacote
              </Button>
            </CardHeader>
            <CardContent>
              <div className="border border-border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Bônus</TableHead>
                      <TableHead className="text-right">Preço</TableHead>
                      <TableHead className="text-right">Desconto</TableHead>
                      <TableHead>Destaque</TableHead>
                      <TableHead>Ativo</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {packages.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-right">{p.token_amount.toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-right text-green-600">+{p.bonus_tokens.toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.price)}</TableCell>
                        <TableCell className="text-right">{p.discount_percentage}%</TableCell>
                        <TableCell>{p.is_featured && <Badge>Destaque</Badge>}</TableCell>
                        <TableCell>
                          <Switch
                            checked={p.is_active}
                            onCheckedChange={async (v) => {
                              await updateTokenPackage(p.id, { is_active: v } as any);
                              await loadData();
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => openEditPkg(p)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PLANOS */}
        <TabsContent value="planos">
          <Card>
            <CardHeader>
              <CardTitle>Planos de Assinatura</CardTitle>
              <CardDescription>{plans.length} planos cadastrados</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border border-border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Preço Mensal</TableHead>
                      <TableHead className="text-right">Max Usuários</TableHead>
                      <TableHead className="text-right">Max Clientes</TableHead>
                      <TableHead>Ativo</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plans.map((p) => {
                      const limits = p.limits || {};
                      const isCustom = !!limits.custom;
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="font-mono text-xs">{p.slug}</TableCell>
                          <TableCell>
                            {isCustom ? (
                              <Badge variant="secondary">Personalizado</Badge>
                            ) : (
                              formatCurrency(p.price_monthly)
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {isCustom ? "Sob consulta" : limits.max_users || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {isCustom ? "Sob consulta" : (limits.max_clients || 0).toLocaleString("pt-BR")}
                          </TableCell>
                          <TableCell>
                            <Switch checked={p.is_active} onCheckedChange={() => handleTogglePlan(p)} />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => openEditPlan(p)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* SERVICE DIALOG */}
      <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingService ? "Editar Serviço" : "Novo Serviço"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {!editingService && (
              <div className="space-y-1">
                <Label>Código</Label>
                <Input value={serviceForm.service_code} onChange={(e) => setServiceForm({ ...serviceForm, service_code: e.target.value })} placeholder="ex: crm" />
              </div>
            )}
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={serviceForm.name} onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea value={serviceForm.description} onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Preço</Label>
                <Input type="number" step="0.01" value={serviceForm.price} onChange={(e) => setServiceForm({ ...serviceForm, price: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label>Tipo de Preço</Label>
                <Select value={serviceForm.price_type} onValueChange={(v) => setServiceForm({ ...serviceForm, price_type: v as ServicePriceType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixo</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="per_unit">Por unidade</SelectItem>
                    <SelectItem value="variable">Variável</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Categoria</Label>
                <Select value={serviceForm.category} onValueChange={(v) => setServiceForm({ ...serviceForm, category: v as ServiceCategory })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="core">Core</SelectItem>
                    <SelectItem value="ai_agent">AI Agent</SelectItem>
                    <SelectItem value="integration">Integração</SelectItem>
                    <SelectItem value="addon">Addon</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Tokens necessários</Label>
                <Input type="number" value={serviceForm.tokens_required} onChange={(e) => setServiceForm({ ...serviceForm, tokens_required: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Ícone (Lucide)</Label>
                <Input value={serviceForm.icon} onChange={(e) => setServiceForm({ ...serviceForm, icon: e.target.value })} placeholder="ex: Users" />
              </div>
              <div className="space-y-1">
                <Label>Label da unidade</Label>
                <Input value={serviceForm.unit_label} onChange={(e) => setServiceForm({ ...serviceForm, unit_label: e.target.value })} placeholder="por instância" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServiceDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveService}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PACKAGE DIALOG */}
      <Dialog open={pkgDialogOpen} onOpenChange={setPkgDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPkg ? "Editar Pacote" : "Novo Pacote"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={pkgForm.name} onChange={(e) => setPkgForm({ ...pkgForm, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Input value={pkgForm.description} onChange={(e) => setPkgForm({ ...pkgForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Quantidade de tokens</Label>
                <Input type="number" value={pkgForm.token_amount} onChange={(e) => setPkgForm({ ...pkgForm, token_amount: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label>Tokens bônus</Label>
                <Input type="number" value={pkgForm.bonus_tokens} onChange={(e) => setPkgForm({ ...pkgForm, bonus_tokens: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Preço (R$)</Label>
                <Input type="number" step="0.01" value={pkgForm.price} onChange={(e) => setPkgForm({ ...pkgForm, price: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label>Desconto (%)</Label>
                <Input type="number" step="0.01" value={pkgForm.discount_percentage} onChange={(e) => setPkgForm({ ...pkgForm, discount_percentage: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={pkgForm.is_featured} onCheckedChange={(v) => setPkgForm({ ...pkgForm, is_featured: v })} />
              <Label>Pacote destaque</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPkgDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSavePkg}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PLAN DIALOG */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Plano</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Slug</Label>
              <Input value={planForm.slug} disabled />
              <p className="text-xs text-muted-foreground">O slug não pode ser alterado</p>
            </div>
            <div className="flex items-center gap-2 py-1">
              <Switch checked={planForm.is_custom} onCheckedChange={(v) => setPlanForm({ ...planForm, is_custom: v })} />
              <Label>Plano personalizado (Enterprise)</Label>
            </div>
            {!planForm.is_custom && (
              <>
                <div className="space-y-1">
                  <Label>Preço Mensal (R$)</Label>
                  <Input type="number" step="0.01" value={planForm.price_monthly} onChange={(e) => setPlanForm({ ...planForm, price_monthly: Number(e.target.value) })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Max Usuários</Label>
                    <Input type="number" value={planForm.max_users} onChange={(e) => setPlanForm({ ...planForm, max_users: Number(e.target.value) })} />
                    <p className="text-xs text-muted-foreground">Inclui operadores + admin</p>
                  </div>
                  <div className="space-y-1">
                    <Label>Max Clientes</Label>
                    <Input type="number" value={planForm.max_clients} onChange={(e) => setPlanForm({ ...planForm, max_clients: Number(e.target.value) })} />
                  </div>
                </div>
              </>
            )}
            {planForm.is_custom && (
              <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                Planos personalizados têm limites definidos individualmente por tenant na aba de gerenciamento.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSavePlan}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminServicosPage;
