import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Printer } from "lucide-react";
import { formatCurrency, formatDate, formatCPF } from "@/lib/formatters";

interface PortalAgreementTermProps {
  checkoutToken: string;
}

const PortalAgreementTerm = ({ checkoutToken }: PortalAgreementTermProps) => {
  const [agreement, setAgreement] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get-agreement", checkout_token: checkoutToken }),
        });
        const data = await res.json();
        if (data.agreement) {
          setAgreement(data.agreement);
          setTenant(data.tenant);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [checkoutToken]);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!agreement) {
    return (
      <div className="max-w-lg mx-auto p-8 text-center">
        <Card><CardContent className="py-8 text-muted-foreground">Acordo não encontrado.</CardContent></Card>
      </div>
    );
  }

  const today = new Date().toLocaleDateString("pt-BR");

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex justify-end print:hidden">
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-2" /> Imprimir
        </Button>
      </div>

      <Card className="print:shadow-none print:border-0">
        <CardContent className="p-8 space-y-6 text-sm text-foreground">
          <div className="text-center space-y-2 border-b pb-6">
            <h1 className="text-xl font-bold">TERMO DE ACORDO</h1>
            <p className="text-muted-foreground">Nº {agreement.id.slice(0, 8).toUpperCase()}</p>
          </div>

          <div className="space-y-4">
            <p>
              Pelo presente instrumento particular, <strong>{tenant?.name || agreement.credor}</strong> ("Credor")
              e <strong>{agreement.client_name}</strong>, inscrito(a) no CPF sob nº <strong>{formatCPF(agreement.client_cpf)}</strong> ("Devedor"),
              celebram o presente Termo de Acordo, nas seguintes condições:
            </p>

            <div className="space-y-2">
              <p><strong>CLÁUSULA 1ª – DO OBJETO</strong></p>
              <p>
                O presente acordo tem por objeto a renegociação da dívida do Devedor junto ao Credor <strong>{agreement.credor}</strong>,
                no valor original de <strong>{formatCurrency(agreement.original_total)}</strong>.
              </p>
            </div>

            <div className="space-y-2">
              <p><strong>CLÁUSULA 2ª – DAS CONDIÇÕES</strong></p>
              <p>O Devedor se compromete a pagar o valor total de <strong>{formatCurrency(agreement.proposed_total)}</strong>,
                {agreement.discount_percent && agreement.discount_percent > 0 && ` com desconto de ${agreement.discount_percent}%,`}
                {" "}em <strong>{agreement.new_installments}</strong> parcela{agreement.new_installments > 1 ? "s" : ""} de{" "}
                <strong>{formatCurrency(agreement.new_installment_value)}</strong>, com primeiro vencimento em{" "}
                <strong>{formatDate(agreement.first_due_date)}</strong>.
              </p>
            </div>

            <div className="space-y-2">
              <p><strong>CLÁUSULA 3ª – DO INADIMPLEMENTO</strong></p>
              <p>
                O não pagamento de qualquer parcela na data do vencimento acarretará o cancelamento automático do presente acordo,
                restabelecendo-se o valor original da dívida, acrescido de juros e multa previstos em contrato.
              </p>
            </div>

            <div className="space-y-2">
              <p><strong>CLÁUSULA 4ª – DA QUITAÇÃO</strong></p>
              <p>
                Após o pagamento integral das parcelas pactuadas, o Credor se compromete a dar plena e irrevogável quitação ao Devedor
                em relação à dívida objeto deste acordo.
              </p>
            </div>
          </div>

          <div className="border-t pt-6 space-y-4">
            <p className="text-center text-muted-foreground">Acordo realizado em {today}</p>
            <div className="grid grid-cols-2 gap-8 pt-8">
              <div className="text-center border-t pt-4">
                <p className="font-semibold">{tenant?.name || agreement.credor}</p>
                <p className="text-xs text-muted-foreground">Credor</p>
              </div>
              <div className="text-center border-t pt-4">
                <p className="font-semibold">{agreement.client_name}</p>
                <p className="text-xs text-muted-foreground">Devedor</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PortalAgreementTerm;
