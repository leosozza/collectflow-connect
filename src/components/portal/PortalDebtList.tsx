import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, AlertTriangle, Handshake } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";

interface DebtItem {
  nome_completo: string;
  credor: string;
  numero_parcela: number;
  total_parcelas: number;
  valor_parcela: number;
  valor_pago: number;
  data_vencimento: string;
  status: string;
}

interface PortalDebtListProps {
  debts: DebtItem[];
  clientName: string;
  onBack: () => void;
  onNegotiate: (credor: string, debts: DebtItem[]) => void;
}

const PortalDebtList = ({ debts, clientName, onBack, onNegotiate }: PortalDebtListProps) => {
  const pendingDebts = debts.filter((d) => d.status === "pendente");
  const totalDebt = pendingDebts.reduce((s, d) => s + Number(d.valor_parcela), 0);

  // Group by credor
  const grouped: Record<string, DebtItem[]> = {};
  pendingDebts.forEach((d) => {
    if (!grouped[d.credor]) grouped[d.credor] = [];
    grouped[d.credor].push(d);
  });

  const today = new Date();

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 md:p-8">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
      </Button>

      {/* Summary */}
      <Card className="border-primary/30">
        <CardContent className="pt-6">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">Olá, <span className="font-semibold text-foreground">{clientName}</span></p>
            <p className="text-3xl font-bold text-foreground">{formatCurrency(totalDebt)}</p>
            <p className="text-sm text-muted-foreground">
              {pendingDebts.length} parcela{pendingDebts.length !== 1 ? "s" : ""} pendente{pendingDebts.length !== 1 ? "s" : ""}
            </p>
          </div>
        </CardContent>
      </Card>

      {pendingDebts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            🎉 Parabéns! Você não possui pendências.
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([credor, items]) => {
          const credorTotal = items.reduce((s, d) => s + Number(d.valor_parcela), 0);
          const overdue = items.filter((d) => new Date(d.data_vencimento + "T00:00:00") < today);

          return (
            <Card key={credor}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{credor}</CardTitle>
                  <Badge variant="outline" className="font-semibold">{formatCurrency(credorTotal)}</Badge>
                </div>
                {overdue.length > 0 && (
                  <div className="flex items-center gap-1 text-sm text-destructive">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {overdue.length} parcela{overdue.length > 1 ? "s" : ""} vencida{overdue.length > 1 ? "s" : ""}
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {items.map((d, i) => {
                    const isOverdue = new Date(d.data_vencimento + "T00:00:00") < today;
                    return (
                      <div key={i} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                        <div>
                          <span className="text-muted-foreground">Parcela {d.numero_parcela}/{d.total_parcelas}</span>
                          <span className="ml-2 text-muted-foreground">• Venc: {formatDate(d.data_vencimento)}</span>
                          {isOverdue && <Badge variant="destructive" className="ml-2 text-xs">Vencida</Badge>}
                        </div>
                        <span className="font-medium text-foreground">{formatCurrency(d.valor_parcela)}</span>
                      </div>
                    );
                  })}
                </div>
                <Button className="w-full" onClick={() => onNegotiate(credor, items)}>
                  <Handshake className="w-4 h-4 mr-2" /> Negociar esta dívida
                </Button>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
};

export default PortalDebtList;
