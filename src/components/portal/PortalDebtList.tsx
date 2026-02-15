import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, AlertTriangle, Handshake } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { motion } from "framer-motion";

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
  credorSettings?: Record<string, any>;
}

const PortalDebtList = ({ debts, clientName, onBack, onNegotiate, credorSettings = {} }: PortalDebtListProps) => {
  const pendingDebts = debts.filter((d) => d.status === "pendente");
  const totalDebt = pendingDebts.reduce((s, d) => s + Number(d.valor_parcela), 0);

  const grouped: Record<string, DebtItem[]> = {};
  pendingDebts.forEach((d) => {
    if (!grouped[d.credor]) grouped[d.credor] = [];
    grouped[d.credor].push(d);
  });

  const today = new Date();

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 md:p-8">
      <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
        <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
      </Button>

      {/* Summary */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card className="border-0 shadow-md overflow-hidden">
          <CardContent className="pt-6 pb-6">
            <div className="text-center space-y-2">
              <p className="text-muted-foreground text-sm">
                Olá, <span className="font-semibold text-foreground">{clientName}</span>
              </p>
              <p className="text-3xl font-bold text-foreground">{formatCurrency(totalDebt)}</p>
              <p className="text-sm text-muted-foreground">
                {pendingDebts.length} parcela{pendingDebts.length !== 1 ? "s" : ""} pendente{pendingDebts.length !== 1 ? "s" : ""}
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {pendingDebts.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-10 text-center text-muted-foreground">
            🎉 Parabéns! Você não possui pendências.
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([credor, items], idx) => {
          const credorTotal = items.reduce((s, d) => s + Number(d.valor_parcela), 0);
          const overdue = items.filter((d) => new Date(d.data_vencimento + "T00:00:00") < today);

          return (
            <motion.div
              key={credor}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
            >
              <Card className="border-0 shadow-sm hover:shadow-md transition-shadow rounded-2xl overflow-hidden">
                {/* Creditor color bar */}
                {credorSettings[credor]?.portal_primary_color && (
                  <div className="h-1" style={{ backgroundColor: credorSettings[credor].portal_primary_color }} />
                )}
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {credorSettings[credor]?.portal_logo_url && (
                        <img src={credorSettings[credor].portal_logo_url} alt={credor} className="h-6 w-auto" />
                      )}
                      <CardTitle className="text-lg">{credorSettings[credor]?.nome_fantasia || credor}</CardTitle>
                    </div>
                    <span className="text-sm font-semibold text-foreground">{formatCurrency(credorTotal)}</span>
                  </div>
                  {overdue.length > 0 && (
                    <div className="flex items-center gap-1 text-sm text-destructive">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {overdue.length} parcela{overdue.length > 1 ? "s" : ""} vencida{overdue.length > 1 ? "s" : ""}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    {items.map((d, i) => {
                      const isOverdue = new Date(d.data_vencimento + "T00:00:00") < today;
                      return (
                        <div key={i} className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0 text-sm">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-muted-foreground">
                              Parcela {d.numero_parcela}/{d.total_parcelas}
                            </span>
                            <span className="text-muted-foreground/60">•</span>
                            <span className="text-muted-foreground">Venc: {formatDate(d.data_vencimento)}</span>
                            {isOverdue && (
                              <Badge variant="destructive" className="text-xs py-0 px-1.5">
                                Vencida
                              </Badge>
                            )}
                          </div>
                          <span className="font-medium text-foreground">{formatCurrency(d.valor_parcela)}</span>
                        </div>
                      );
                    })}
                  </div>
                  <Button className="w-full text-white" onClick={() => onNegotiate(credor, items)}>
                    <Handshake className="w-4 h-4 mr-2" /> Negociar esta dívida
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          );
        })
      )}
    </div>
  );
};

export default PortalDebtList;
