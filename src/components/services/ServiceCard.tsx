import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import * as LucideIcons from "lucide-react";
import type { ServiceCatalogItem, TenantService, ServiceCategory } from "@/types/tokens";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/types/tokens";

interface ServiceCardProps {
  service: ServiceCatalogItem;
  tenantService?: TenantService;
  onActivate: (serviceId: string, quantity: number) => void;
  onDeactivate: (serviceId: string) => void;
  onUpdateQuantity: (serviceId: string, quantity: number) => void;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const getIcon = (iconName: string | null) => {
  if (!iconName) return LucideIcons.Package;
  return (LucideIcons as any)[iconName] || LucideIcons.Package;
};

const ServiceCard = ({ service, tenantService, onActivate, onDeactivate, onUpdateQuantity }: ServiceCardProps) => {
  const isActive = tenantService?.status === "active";
  const Icon = getIcon(service.icon);
  const categoryColor = CATEGORY_COLORS[service.category as ServiceCategory] || "#6B7280";
  const [quantity, setQuantity] = useState(tenantService?.quantity || 1);

  const effectivePrice = tenantService?.unit_price_override ?? service.price;
  const totalPrice = service.price_type === "per_unit" ? effectivePrice * (tenantService?.quantity || quantity) : effectivePrice;

  const handleToggle = (checked: boolean) => {
    if (checked) {
      onActivate(service.id, quantity);
    } else {
      onDeactivate(service.id);
    }
  };

  const handleQuantityChange = (newQty: number) => {
    if (newQty < 1) return;
    setQuantity(newQty);
    if (isActive) {
      onUpdateQuantity(service.id, newQty);
    }
  };

  return (
    <Card className={`transition-all ${isActive ? "border-primary/40 bg-primary/5" : "border-border"}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${categoryColor}15`, color: categoryColor }}
            >
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{service.name}</h3>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0"
                style={{ borderColor: categoryColor, color: categoryColor }}
              >
                {CATEGORY_LABELS[service.category as ServiceCategory] || service.category}
              </Badge>
            </div>
          </div>
          {service.price > 0 && (
            <Switch checked={isActive} onCheckedChange={handleToggle} />
          )}
        </div>

        <p className="text-xs text-muted-foreground">{service.description}</p>

        <div className="flex items-end justify-between">
          <div>
            {service.price > 0 ? (
              <div>
                <span className="text-lg font-bold text-foreground">{formatCurrency(effectivePrice)}</span>
                <span className="text-xs text-muted-foreground ml-1">
                  /{service.price_type === "monthly" ? "mês" : service.unit_label || "un"}
                </span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground italic">Preço sob consulta</span>
            )}
          </div>

          {service.price_type === "per_unit" && (isActive || service.price > 0) && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleQuantityChange(quantity - 1)}
                disabled={quantity <= 1}
              >
                -
              </Button>
              <Input
                className="w-12 h-7 text-center text-sm p-0"
                value={quantity}
                onChange={(e) => handleQuantityChange(Number(e.target.value) || 1)}
              />
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleQuantityChange(quantity + 1)}
              >
                +
              </Button>
            </div>
          )}
        </div>

        {isActive && service.price_type === "per_unit" && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Total: <span className="font-semibold text-foreground">{formatCurrency(totalPrice)}/mês</span>
            </p>
          </div>
        )}

        {service.tokens_required > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <LucideIcons.Coins className="w-3 h-3" />
            Consome {service.tokens_required} token(s) por uso
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ServiceCard;
