import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Receipt } from "lucide-react";

interface PaymentHistoryCardProps {
  tenantId: string;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-amber-500/10 text-amber-600 border-amber-200" },
  completed: { label: "Confirmado", className: "bg-green-500/10 text-green-600 border-green-200" },
  overdue: { label: "Vencido", className: "bg-destructive/10 text-destructive border-destructive/20" },
  refunded: { label: "Estornado", className: "bg-muted text-muted-foreground" },
};

const billingTypeLabels: Record<string, string> = {
  CREDIT_CARD: "Cartão",
  PIX: "PIX",
  BOLETO: "Boleto",
  credit_card: "Cartão",
  pix: "PIX",
  boleto: "Boleto",
};

const PaymentHistoryCard = ({ tenantId }: PaymentHistoryCardProps) => {
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payment-history", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_records")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Receipt className="w-4 h-4 text-primary" />
          Histórico de Cobranças
        </CardTitle>
        <CardDescription>Últimas cobranças processadas via gateway</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-xs text-muted-foreground uppercase">
                <th className="px-4 py-2.5 text-left font-medium">Data</th>
                <th className="px-4 py-2.5 text-left font-medium">Tipo</th>
                <th className="px-4 py-2.5 text-right font-medium">Valor</th>
                <th className="px-4 py-2.5 text-center font-medium">Método</th>
                <th className="px-4 py-2.5 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground text-xs">Carregando...</td>
                </tr>
              )}
              {!isLoading && payments.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground text-xs">Nenhuma cobrança encontrada</td>
                </tr>
              )}
              {payments.map((p: any) => {
                const st = statusConfig[p.status] || statusConfig.pending;
                return (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      {new Date(p.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-2.5 capitalize">
                      {p.payment_type === "token_purchase" ? "Tokens" : p.payment_type === "subscription" ? "Mensalidade" : p.payment_type}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(p.amount)}</td>
                    <td className="px-4 py-2.5 text-center">
                      {billingTypeLabels[p.billing_type || p.payment_method] || p.payment_method || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge variant="outline" className={st.className}>{st.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentHistoryCard;
