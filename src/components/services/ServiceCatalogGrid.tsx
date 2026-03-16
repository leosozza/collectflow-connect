import { useState, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import ServiceCard from "./ServiceCard";
import TokenBalance from "@/components/tokens/TokenBalance";
import TokenHistoryTable from "@/components/tokens/TokenHistoryTable";
import type { ServiceCatalogItem, TenantService, TenantTokens, TokenTransaction, ServiceCategory } from "@/types/tokens";
import { CATEGORY_LABELS } from "@/types/tokens";

interface ServiceCatalogGridProps {
  catalog: ServiceCatalogItem[];
  tenantServices: TenantService[];
  onActivate: (serviceId: string, quantity: number) => void;
  onDeactivate: (serviceId: string) => void;
  onUpdateQuantity: (serviceId: string, quantity: number) => void;
  tokens?: TenantTokens | null;
  transactions?: TokenTransaction[];
  loadingTokens?: boolean;
  onPurchase?: () => void;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const ServiceCatalogGrid = ({ catalog, tenantServices, onActivate, onDeactivate, onUpdateQuantity, tokens, transactions = [], loadingTokens, onPurchase }: ServiceCatalogGridProps) => {
  // Filter out CRM (already part of the plan)
  const filteredCatalog = catalog.filter(s => s.service_code !== 'crm');

  const categories = useMemo(() => {
    const cats = [...new Set(filteredCatalog.map((s) => s.category))];
    return cats;
  }, [filteredCatalog]);

  const tenantServiceMap = useMemo(() => {
    const map: Record<string, TenantService> = {};
    tenantServices.forEach((ts) => {
      map[ts.service_id] = ts;
    });
    return map;
  }, [tenantServices]);

  const activeServices = tenantServices.filter((ts) => ts.status === "active");
  const monthlyTotal = useMemo(() => {
    return activeServices.reduce((sum, ts) => {
      const svc = filteredCatalog.find((c) => c.id === ts.service_id);
      if (!svc) return sum;
      const price = ts.unit_price_override ?? svc.price;
      const qty = svc.price_type === "per_unit" ? ts.quantity : 1;
      return sum + price * qty;
    }, 0);
  }, [activeServices, filteredCatalog]);

  return (
    <div className="space-y-4">
      {/* Monthly summary */}
      <div className="flex items-center justify-between bg-muted/30 rounded-lg p-4 border border-border">
        <div>
          <p className="text-sm text-muted-foreground">Custo mensal estimado</p>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(monthlyTotal)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Serviços ativos</p>
          <p className="text-2xl font-bold text-primary">{activeServices.length}</p>
        </div>
      </div>

      <Tabs defaultValue={categories[0] || "tokens"}>
        <TabsList className="flex-wrap">
          {categories.map((cat) => (
            <TabsTrigger key={cat} value={cat}>
              {CATEGORY_LABELS[cat as ServiceCategory] || cat}
            </TabsTrigger>
          ))}
          <TabsTrigger value="tokens">Tokens</TabsTrigger>
        </TabsList>

        {categories.map((cat) => (
          <TabsContent key={cat} value={cat}>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredCatalog
                .filter((s) => s.category === cat)
                .map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    tenantService={tenantServiceMap[service.id]}
                    onActivate={onActivate}
                    onDeactivate={onDeactivate}
                    onUpdateQuantity={onUpdateQuantity}
                  />
                ))}
            </div>
          </TabsContent>
        ))}

        <TabsContent value="tokens">
          <div className="space-y-6">
            {tokens !== undefined && onPurchase && (
              <TokenBalance tokens={tokens} onPurchase={onPurchase} />
            )}
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Transações de Tokens</CardTitle>
                <CardDescription>Todas as movimentações de tokens</CardDescription>
              </CardHeader>
              <CardContent>
                <TokenHistoryTable transactions={transactions} loading={loadingTokens || false} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ServiceCatalogGrid;
