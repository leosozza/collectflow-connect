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
  const [credorBranding, setCredorBranding] = useState<any>(null);
  const [credorSettings, setCredorSettings] = useState<Record<string, any>>({});

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
        if (!error && data?.credorBranding) setCredorBranding(data.credorBranding);
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
      if (data?.credorSettings) setCredorSettings(data.credorSettings);
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

  // Use creditor-specific settings if available, fallback to tenant settings
  const activeCredorConfig = credorSettings[negotiateCredor] || {};
  const maxDiscount = activeCredorConfig.desconto_maximo || (tenantInfo?.settings?.portal_max_discount as number) || 30;
  const maxInstallments = activeCredorConfig.parcelas_max || (tenantInfo?.settings?.portal_max_installments as number) || 12;
  const credorColor = activeCredorConfig.portal_primary_color || tenantInfo?.primary_color;
  const credorLogo = activeCredorConfig.portal_logo_url || tenantInfo?.logo_url;
  const clientName = debts[0]?.nome_completo || "";

  // Portal-wide branding: prefer creditor branding over tenant defaults
  const portalColor = credorBranding?.portal_primary_color || tenantInfo?.primary_color;
  const portalLogo = credorBranding?.portal_logo_url || tenantInfo?.logo_url;
  const portalName = credorBranding?.nome_fantasia || credorBranding?.razao_social || tenantInfo?.name;
  const portalSettings = credorBranding ? {
    ...tenantInfo?.settings,
    portal_hero_title: credorBranding.portal_hero_title,
    portal_hero_subtitle: credorBranding.portal_hero_subtitle,
  } : tenantInfo?.settings;

  // Checkout / Term views
  if (view === "checkout" && token) {
    return (
      <PortalLayout tenantName={portalName} tenantLogo={portalLogo} primaryColor={portalColor}>
        <PortalCheckout checkoutToken={token} />
      </PortalLayout>
    );
  }

  if (view === "term" && token) {
    return (
      <PortalLayout tenantName={portalName} tenantLogo={portalLogo} primaryColor={portalColor}>
        <PortalAgreementTerm checkoutToken={token} />
      </PortalLayout>
    );
  }

  return (
    <PortalLayout tenantName={portalName} tenantLogo={portalLogo} primaryColor={portalColor}>
      <div className="max-w-5xl mx-auto p-4 md:p-8">
        {view === "hero" && (
          <PortalHero
            tenantName={portalName}
            primaryColor={portalColor}
            settings={portalSettings}
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
            credorSettings={credorSettings}
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
            primaryColor={credorColor}
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
