import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import PortalLayout from "@/components/portal/PortalLayout";
import PortalHero from "@/components/portal/PortalHero";
import PortalDebtList from "@/components/portal/PortalDebtList";
import PortalNegotiation from "@/components/portal/PortalNegotiation";
import PortalCheckout from "@/components/portal/PortalCheckout";
import PortalAgreementTerm from "@/components/portal/PortalAgreementTerm";

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

type PortalView = "hero" | "debts" | "negotiate" | "checkout" | "term";

const PortalPage = () => {
  const { tenantSlug, token } = useParams<{ tenantSlug: string; token?: string }>();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [view, setView] = useState<PortalView>("hero");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [cpf, setCpf] = useState("");
  const [tenantInfo, setTenantInfo] = useState<any>(null);

  // Negotiation state
  const [negotiateCredor, setNegotiateCredor] = useState("");
  const [negotiateDebts, setNegotiateDebts] = useState<DebtItem[]>([]);

  // Determine initial view from route
  useEffect(() => {
    const path = window.location.pathname;
    if (path.includes("/checkout/") && token) {
      setView("checkout");
    } else if (path.includes("/termo/") && token) {
      setView("term");
    }
  }, [token]);

  // Load tenant info
  useEffect(() => {
    const loadTenant = async () => {
      if (!tenantSlug) return;
      try {
        const { data, error } = await supabase.functions.invoke("portal-lookup", {
          body: { action: "tenant-info", tenant_slug: tenantSlug },
        });
        if (!error && data?.tenant) setTenantInfo(data.tenant);
      } catch {
        // ignore
      }
    };
    loadTenant();
  }, [tenantSlug]);

  const handleSearch = async (searchCpf: string) => {
    setCpf(searchCpf);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("portal-lookup", {
        body: { cpf: searchCpf, tenant_slug: tenantSlug },
      });
      if (error) throw error;
      const results = data?.debts || [];
      setDebts(results);
      if (results.length > 0) {
        setView("debts");
      } else {
        toast({ title: "Nenhuma pendência", description: "Nenhuma dívida encontrada para este CPF." });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleNegotiate = (credor: string, credorDebts: DebtItem[]) => {
    setNegotiateCredor(credor);
    setNegotiateDebts(credorDebts);
    setView("negotiate");
  };

  const handleSubmitProposal = async (option: { type: string; total: number; installments: number; installmentValue: number; notes: string }) => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("portal-lookup", {
        body: {
          action: "create-portal-agreement",
          cpf,
          tenant_slug: tenantSlug,
          credor: negotiateCredor,
          original_total: negotiateDebts.reduce((s, d) => s + Number(d.valor_parcela), 0),
          proposed_total: option.total,
          new_installments: option.installments,
          new_installment_value: option.installmentValue,
          notes: `[Portal - ${option.type}] ${option.notes}`.trim(),
        },
      });
      if (error) throw error;
      toast({
        title: "Proposta enviada!",
        description: "Sua proposta será analisada. Você receberá o link de pagamento após aprovação.",
      });
      setView("hero");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const maxDiscount = (tenantInfo?.settings?.portal_max_discount as number) || 30;
  const maxInstallments = (tenantInfo?.settings?.portal_max_installments as number) || 12;
  const clientName = debts[0]?.nome_completo || "";

  // Checkout / Term views
  if (view === "checkout" && token) {
    return (
      <PortalLayout tenantName={tenantInfo?.name} tenantLogo={tenantInfo?.logo_url} primaryColor={tenantInfo?.primary_color}>
        <PortalCheckout checkoutToken={token} />
      </PortalLayout>
    );
  }

  if (view === "term" && token) {
    return (
      <PortalLayout tenantName={tenantInfo?.name} tenantLogo={tenantInfo?.logo_url} primaryColor={tenantInfo?.primary_color}>
        <PortalAgreementTerm checkoutToken={token} />
      </PortalLayout>
    );
  }

  return (
    <PortalLayout tenantName={tenantInfo?.name} tenantLogo={tenantInfo?.logo_url} primaryColor={tenantInfo?.primary_color}>
      <div className="max-w-5xl mx-auto p-4 md:p-8">
        {view === "hero" && (
          <PortalHero
            tenantName={tenantInfo?.name}
            primaryColor={tenantInfo?.primary_color}
            settings={tenantInfo?.settings}
            onSearch={handleSearch}
            loading={loading}
          />
        )}

        {view === "debts" && (
          <PortalDebtList
            debts={debts}
            clientName={clientName}
            onBack={() => setView("hero")}
            onNegotiate={handleNegotiate}
          />
        )}

        {view === "negotiate" && (
          <PortalNegotiation
            credor={negotiateCredor}
            originalTotal={negotiateDebts.reduce((s, d) => s + Number(d.valor_parcela), 0)}
            clientName={clientName}
            clientCpf={cpf}
            maxDiscount={maxDiscount}
            maxInstallments={maxInstallments}
            onBack={() => setView("debts")}
            onSubmit={handleSubmitProposal}
            submitting={submitting}
          />
        )}
      </div>
    </PortalLayout>
  );
};

export default PortalPage;
