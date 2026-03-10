import { Coins, AlertTriangle, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TenantTokens } from "@/types/tokens";

interface TokenBalanceProps {
  tokens: TenantTokens | null;
  onPurchase: () => void;
  compact?: boolean;
}

const formatNumber = (n: number) => n.toLocaleString("pt-BR");

const TokenBalance = ({ tokens, onPurchase, compact = false }: TokenBalanceProps) => {
  const balance = tokens?.token_balance ?? 0;
  const threshold = tokens?.low_balance_threshold ?? 100;
  const isLow = balance > 0 && balance < threshold;
  const isZero = balance === 0;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Coins className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">{formatNumber(balance)}</span>
        {isLow && <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-400 text-amber-600">Baixo</Badge>}
        {isZero && <Badge variant="destructive" className="text-[10px] px-1 py-0">Zerado</Badge>}
      </div>
    );
  }

  return (
    <Card className={`border ${isZero ? "border-destructive/50 bg-destructive/5" : isLow ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20" : "border-border"}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground font-medium">Saldo de Tokens</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-foreground">{formatNumber(balance)}</p>
              <span className="text-sm text-muted-foreground">tokens</span>
            </div>
            {tokens && tokens.reserved_balance > 0 && (
              <p className="text-xs text-muted-foreground">
                {formatNumber(tokens.reserved_balance)} reservados · {formatNumber(balance - tokens.reserved_balance)} disponíveis
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {isZero && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="w-3 h-3" /> Sem tokens
              </Badge>
            )}
            {isLow && !isZero && (
              <Badge variant="outline" className="gap-1 border-amber-400 text-amber-600">
                <TrendingDown className="w-3 h-3" /> Saldo baixo
              </Badge>
            )}
            <Button onClick={onPurchase} size="sm" variant={isZero ? "default" : "outline"}>
              <Coins className="w-4 h-4 mr-1.5" /> Comprar Tokens
            </Button>
          </div>
        </div>

        {tokens && (
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Total comprado</p>
              <p className="text-sm font-semibold">{formatNumber(tokens.lifetime_purchased)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total consumido</p>
              <p className="text-sm font-semibold">{formatNumber(tokens.lifetime_consumed)}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TokenBalance;
