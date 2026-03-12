import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Search, Settings2, Package, Check, X, Plus, Minus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { fetchServiceCatalog, fetchTenantServices, activateService, deactivateService, updateTenantServiceQuantity } from "@/services/serviceCatalogService";
import type { ServiceCatalogItem, TenantService } from "@/types/tokens";

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan_name?: string;
  plan_id?: string;
  settings?: Record<string, any>;
  cnpj?: string;
}

interface PlanOption {
  id: string;
  name: string;
  slug: string;
  price_monthly: number;
  limits: Record<string, any>;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const TenantServicesTab = () => {
  const { toast } = useToast();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [catalog, setCatalog] = useState<ServiceCatalogItem[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Manage sheet state
  const [selectedTenant, setSelectedTenant] = useState<TenantRow | null>(null);
  const [tenantServices, setTenantServices] = useState<TenantService[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tenantsRes, catalogRes, plansRes] = await Promise.all([
        supabase.from("tenants").select("*, plans(name)").neq("status", "deleted").order("name"),
        fetchServiceCatalog(),
        supabase.from("plans").select("id, name, slug, price_monthly, limits").eq("is_active", true).order("price_monthly", { ascending: true }),
      ]);
      setTenants((tenantsRes.data || []).map((t: any) => ({ ...t, plan_name: t.plans?.name, plan_id: t.plan_id })));
      setCatalog(catalogRes.filter(s => s.is_active));
      setPlans((plansRes.data as PlanOption[]) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openTenantServices = async (tenant: TenantRow) => {
    setSelectedTenant(tenant);
    setLoadingServices(true);
    try {
      const services = await fetchTenantServices(tenant.id);
      setTenantServices(services);
    } catch (err) {
      console.error(err);
      setTenantServices([]);
    } finally {
      setLoadingServices(false);
    }
  };

  const handleToggleService = async (service: ServiceCatalogItem, currentlyActive: boolean) => {
    if (!selectedTenant) return;
    try {
      if (currentlyActive) {
        await deactivateService(selectedTenant.id, service.id);
        toast({ title: `${service.name} desativado` });
      } else {
        await activateService(selectedTenant.id, service.id, 1);
        toast({ title: `${service.name} ativado` });
      }
      // Refresh
      const services = await fetchTenantServices(selectedTenant.id);
      setTenantServices(services);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleUpdateQuantity = async (serviceId: string, quantity: number) => {
    if (!selectedTenant || quantity < 1) return;
    try {
      await updateTenantServiceQuantity(selectedTenant.id, serviceId, quantity);
      const services = await fetchTenantServices(selectedTenant.id);
      setTenantServices(services);
      toast({ title: "Quantidade atualizada" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleChangePlan = async (tenantId: string, planId: string) => {
    try {
      const { error } = await supabase.from("tenants").update({ plan_id: planId } as any).eq("id", tenantId);
      if (error) throw error;
      toast({ title: "Plano atualizado!" });
      await loadData();
      if (selectedTenant?.id === tenantId) {
        const plan = plans.find(p => p.id === planId);
        setSelectedTenant(prev => prev ? { ...prev, plan_id: planId, plan_name: plan?.name } : null);
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const getActiveServicesForTenant = (tenantId: string): number => {
    // We don't preload all tenant services in list view, so use settings fallback
    const tenant = tenants.find(t => t.id === tenantId);
    const svcs = (tenant?.settings as any)?.enabled_services || {};
    return Object.entries(svcs).filter(([k, v]) => k !== "whatsapp_extra_instances" && v === true).length;
  };

  const getMonthlyTotal = (): number => {
    if (!selectedTenant) return 0;
    const plan = plans.find(p => p.id === (selectedTenant as any).plan_id);
    let total = plan?.price_monthly || 0;
    tenantServices
      .filter(ts => ts.status === "active")
      .forEach(ts => {
        const svc = catalog.find(c => c.id === ts.service_id);
        if (svc) {
          const unitPrice = ts.unit_price_override ?? svc.price;
          total += unitPrice * (ts.quantity || 1);
        }
      });
    return total;
  };

  const filteredTenants = tenants.filter(t => {
    if (!search) return true;
    const q = search.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q) || t.cnpj?.toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
        <span className="text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Gestão de Serviços por Tenant</CardTitle>
          <CardDescription>Gerencie planos e serviços contratados por cada empresa</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CNPJ ou slug..."
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="border border-border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Serviços Ativos</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTenants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Nenhuma empresa encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTenants.map(t => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <p className="font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.slug}</p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.cnpj || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{t.plan_name || "Sem plano"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.status === "active" ? "default" : "destructive"}>
                          {t.status === "active" ? "Ativo" : "Suspenso"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{getActiveServicesForTenant(t.id)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => openTenantServices(t)} className="gap-1.5">
                          <Settings2 className="w-3.5 h-3.5" /> Gerenciar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* SHEET: GERENCIAR SERVIÇOS DO TENANT */}
      <Sheet open={!!selectedTenant} onOpenChange={(open) => !open && setSelectedTenant(null)}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              {selectedTenant?.name}
            </SheetTitle>
            <SheetDescription>Gerencie o plano e serviços contratados</SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* PLANO */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Plano Contratado</h3>
              <Select
                value={(selectedTenant as any)?.plan_id || ""}
                onValueChange={(v) => handleChangePlan(selectedTenant!.id, v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o plano" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.limits?.custom ? "(Personalizado)" : `- ${formatCurrency(p.price_monthly)}/mês`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(() => {
                const plan = plans.find(p => p.id === (selectedTenant as any)?.plan_id);
                if (!plan) return null;
                return (
                  <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg space-y-1">
                    {plan.limits?.custom ? (
                      <p>Plano personalizado — limites definidos manualmente</p>
                    ) : (
                      <>
                        <p>Até {(plan.limits?.max_users || 0) - 1} operadores + 1 admin</p>
                        <p>Até {(plan.limits?.max_clients || 0).toLocaleString("pt-BR")} clientes</p>
                        <p className="font-medium text-foreground">{formatCurrency(plan.price_monthly)}/mês</p>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>

            <Separator />

            {/* SERVIÇOS DO CATÁLOGO */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Serviços Disponíveis</h3>
                {!loadingServices && (
                  <Badge variant="secondary" className="text-xs">
                    {tenantServices.filter(ts => ts.status === "active").length} ativo(s)
                  </Badge>
                )}
              </div>

              {loadingServices ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">Carregando serviços...</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {catalog.map(svc => {
                    const ts = tenantServices.find(t => t.service_id === svc.id);
                    const isActive = ts?.status === "active";
                    return (
                      <div
                        key={svc.id}
                        className={`p-3 rounded-lg border transition-colors ${
                          isActive ? "border-primary/30 bg-primary/5" : "border-border"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 mr-3">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{svc.name}</p>
                              <Badge variant="outline" className="text-[10px]">
                                {svc.category}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{svc.description}</p>
                            <p className="text-xs font-semibold text-primary mt-1">
                              {formatCurrency(ts?.unit_price_override ?? svc.price)}
                              {svc.price_type === "monthly" ? "/mês" : svc.price_type === "per_unit" ? `/${svc.unit_label || "unidade"}` : ""}
                            </p>
                          </div>
                          <Switch
                            checked={isActive}
                            onCheckedChange={() => handleToggleService(svc, isActive)}
                          />
                        </div>

                        {/* Quantity control for per_unit services */}
                        {isActive && svc.price_type === "per_unit" && ts && (
                          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border">
                            <Label className="text-xs">Quantidade:</Label>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                disabled={(ts.quantity || 1) <= 1}
                                onClick={() => handleUpdateQuantity(svc.id, (ts.quantity || 1) - 1)}
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                              <span className="text-sm font-bold w-6 text-center">{ts.quantity || 1}</span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleUpdateQuantity(svc.id, (ts.quantity || 1) + 1)}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                            <span className="text-xs text-muted-foreground ml-auto">
                              Subtotal: {formatCurrency((ts.unit_price_override ?? svc.price) * (ts.quantity || 1))}/mês
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <Separator />

            {/* RESUMO FATURAMENTO */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Resumo de Faturamento</h3>
              <div className="bg-muted p-4 rounded-lg space-y-2">
                {(() => {
                  const plan = plans.find(p => p.id === (selectedTenant as any)?.plan_id);
                  return (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Plano ({plan?.name || "—"})</span>
                        <span>{plan ? (plan.limits?.custom ? "Sob consulta" : formatCurrency(plan.price_monthly)) : "—"}</span>
                      </div>
                      {tenantServices
                        .filter(ts => ts.status === "active")
                        .map(ts => {
                          const svc = catalog.find(c => c.id === ts.service_id);
                          if (!svc) return null;
                          const unitPrice = ts.unit_price_override ?? svc.price;
                          const qty = ts.quantity || 1;
                          return (
                            <div key={ts.id} className="flex justify-between text-sm">
                              <span className="text-muted-foreground">
                                {svc.name} {qty > 1 ? `(×${qty})` : ""}
                              </span>
                              <span>{formatCurrency(unitPrice * qty)}</span>
                            </div>
                          );
                        })}
                      <Separator />
                      <div className="flex justify-between text-sm font-bold">
                        <span>Total Mensal Estimado</span>
                        <span className="text-primary">{formatCurrency(getMonthlyTotal())}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default TenantServicesTab;
