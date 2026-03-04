import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { fetchMyWallet, fetchMyTransactions, RivoCoinTransaction } from "@/services/rivocoinService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const WalletTab = () => {
  const { profile } = useAuth();

  const { data: wallet, isLoading: loadingWallet } = useQuery({
    queryKey: ["rivocoin-wallet", profile?.id],
    queryFn: () => fetchMyWallet(profile!.id),
    enabled: !!profile?.id,
  });

  const { data: transactions = [], isLoading: loadingTx } = useQuery({
    queryKey: ["rivocoin-transactions", profile?.id],
    queryFn: () => fetchMyTransactions(profile!.id),
    enabled: !!profile?.id,
  });

  if (loadingWallet || loadingTx) {
    return <div className="text-center py-12 text-muted-foreground text-sm">Carregando carteira...</div>;
  }

  const balance = wallet?.balance || 0;
  const totalEarned = wallet?.total_earned || 0;
  const totalSpent = wallet?.total_spent || 0;

  return (
    <div className="space-y-6">
      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 text-center">
            <Coins className="w-8 h-8 text-primary mx-auto mb-2" />
            <p className="text-3xl font-bold text-foreground">{balance.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground mt-1">Saldo RivoCoins</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-6 h-6 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{totalEarned.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Ganho</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingDown className="w-6 h-6 text-red-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{totalSpent.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Gasto</p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de Transações</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma transação ainda. Conquiste metas para ganhar RivoCoins!
            </p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx: RivoCoinTransaction) => {
                const isEarn = tx.amount > 0;
                return (
                  <div key={tx.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                    <div className={`p-2 rounded-full ${isEarn ? "bg-green-500/10" : "bg-red-500/10"}`}>
                      {isEarn ? <ArrowDownLeft className="w-4 h-4 text-green-500" /> : <ArrowUpRight className="w-4 h-4 text-red-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{tx.description || (isEarn ? "Crédito" : "Débito")}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(tx.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <Badge variant={isEarn ? "default" : "destructive"} className="text-xs">
                      {isEarn ? "+" : ""}{tx.amount}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WalletTab;
