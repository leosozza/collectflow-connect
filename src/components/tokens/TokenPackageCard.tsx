import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Coins, Star, Check } from "lucide-react";
import type { TokenPackage } from "@/types/tokens";

interface TokenPackageCardProps {
  pkg: TokenPackage;
  selected: boolean;
  onSelect: (pkg: TokenPackage) => void;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const TokenPackageCard = ({ pkg, selected, onSelect }: TokenPackageCardProps) => {
  const totalTokens = pkg.token_amount + pkg.bonus_tokens;
  const pricePerToken = pkg.price / totalTokens;

  return (
    <Card
      className={`relative cursor-pointer transition-all hover:shadow-md ${
        selected ? "border-primary ring-2 ring-primary/20" : "border-border"
      } ${pkg.is_featured ? "border-primary/50" : ""}`}
      onClick={() => onSelect(pkg)}
    >
      {pkg.is_featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground gap-1">
            <Star className="w-3 h-3" /> Popular
          </Badge>
        </div>
      )}

      {selected && (
        <div className="absolute top-2 right-2">
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
            <Check className="w-4 h-4 text-primary-foreground" />
          </div>
        </div>
      )}

      <CardContent className="p-5 space-y-3">
        <div>
          <h3 className="font-bold text-foreground">{pkg.name}</h3>
          <p className="text-xs text-muted-foreground">{pkg.description}</p>
        </div>

        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-foreground">{formatCurrency(pkg.price)}</span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-sm">
            <Coins className="w-4 h-4 text-primary" />
            <span className="font-medium">{pkg.token_amount.toLocaleString("pt-BR")} tokens</span>
          </div>
          {pkg.bonus_tokens > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-green-600">
              <span className="font-medium">+{pkg.bonus_tokens.toLocaleString("pt-BR")} bônus</span>
            </div>
          )}
          {pkg.discount_percentage > 0 && (
            <Badge variant="secondary" className="text-xs">
              {pkg.discount_percentage}% de economia
            </Badge>
          )}
        </div>

        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">
            {formatCurrency(pricePerToken)} por token
          </p>
        </div>

        <Button
          variant={selected ? "default" : "outline"}
          className="w-full"
          onClick={(e) => { e.stopPropagation(); onSelect(pkg); }}
        >
          {selected ? "Selecionado" : "Selecionar"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default TokenPackageCard;
