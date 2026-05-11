import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

export type StepStatus = "pending" | "in_progress" | "complete";

export interface SetupStep {
  id: string;
  title: string;
  description: string;
  detail: string;
  status: StepStatus;
  ctaPath: string;
  ctaLabel: string;
  optional?: boolean;
}

export interface TenantSetupStatus {
  steps: SetupStep[];
  completedCount: number;
  totalCount: number;
  criticalPending: number;
  setupCompletedAt: string | null;
  loading: boolean;
}

async function safeCount(table: string, tenantId: string, extra?: (q: any) => any) {
  try {
    let q = supabase.from(table as any).select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
    if (extra) q = extra(q);
    const { count, error } = await q;
    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}

export function useTenantSetupStatus() {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;

  const query = useQuery({
    queryKey: ["tenant-setup-status", tenantId],
    enabled: !!tenantId,
    staleTime: 30_000,
    queryFn: async (): Promise<Omit<TenantSetupStatus, "loading">> => {
      if (!tenantId) {
        return { steps: [], completedCount: 0, totalCount: 0, criticalPending: 0, setupCompletedAt: null };
      }

      const probe = async (table: string, extra?: (q: any) => any): Promise<boolean> => {
        try {
          let q = supabase.from(table as any).select("id").eq("tenant_id", tenantId).limit(1);
          if (extra) q = extra(q);
          const { data, error } = await q;
          if (error) return false;
          return (data?.length || 0) > 0;
        } catch {
          return false;
        }
      };

      const [
        tenantRow,
        credoresCount,
        tiposDevedorCount,
        tiposDividaCount,
        statusCobrancaCount,
        scriptsCount,
        dispositionsCount,
        operatorsCount,
        whatsappCount,
        hasClients,
        hasClientsClassified,
        hasAsaasCustomer,
        hasNegociarie,
      ] = await Promise.all([
        supabase.from("tenants").select("name, cnpj, logo_url, setup_completed_at, setup_steps_state, settings").eq("id", tenantId).maybeSingle(),
        safeCount("credores", tenantId),
        safeCount("tipos_devedor", tenantId),
        safeCount("tipos_divida", tenantId),
        safeCount("tipos_status", tenantId),
        safeCount("scripts_abordagem", tenantId),
        safeCount("call_disposition_types", tenantId),
        safeCount("tenant_users", tenantId, (q) => q.eq("role", "operador")),
        safeCount("whatsapp_instances", tenantId),
        probe("clients"),
        probe("clients", (q) => q.neq("status", "pendente")),
        probe("asaas_customers"),
        probe("negociarie_cobrancas"),
      ]);

      const t: any = tenantRow.data || {};
      const manualSteps = (t.setup_steps_state || {}) as Record<string, boolean>;
      const setupCompletedAt = t.setup_completed_at || null;

      // Etapa 1 — Empresa
      const empresaOk = !!t.name && !!t.cnpj;
      const empresaDetail = !t.cnpj
        ? "CNPJ não preenchido"
        : !t.logo_url
          ? "Logo recomendado (opcional)"
          : "Dados principais preenchidos";

      // Etapa 2 — Cadastros base (scripts/dispositions são opcionais e só aparecem no detalhe)
      const tiposTotal = tiposDevedorCount + tiposDividaCount + statusCobrancaCount;
      const cadastrosFull = credoresCount > 0 && tiposTotal > 0;
      const cadastrosMin = credoresCount > 0 && tiposTotal === 0;
      const extras: string[] = [];
      if (scriptsCount > 0) extras.push(`${scriptsCount} script(s)`);
      if (dispositionsCount > 0) extras.push(`${dispositionsCount} disposition(s)`);
      const cadastrosDetail = credoresCount === 0
        ? "Nenhum credor cadastrado"
        : tiposTotal === 0
          ? `${credoresCount} credor(es), faltam tipos/status`
          : `${credoresCount} credor(es), ${tiposTotal} tipos/status${extras.length ? `, ${extras.join(", ")}` : ""}`;

      // Etapa 3 — Equipe
      const equipeOk = operatorsCount > 0;
      const equipeDetail = operatorsCount > 0 ? `${operatorsCount} operador(es) ativo(s)` : "Nenhum operador cadastrado";

      // Etapa 4 — Canais
      const canaisOk = whatsappCount > 0 || !!manualSteps.canais;
      const canaisDetail = whatsappCount > 0 ? `${whatsappCount} instância(s) de WhatsApp` : "Nenhum canal conectado";

      // Etapa 5 — Gateways: credenciais ficam em tenants.settings (JSONB) ou refletidas em uso
      const settings = (t.settings || {}) as Record<string, any>;
      const gatewayProviders: string[] = [];
      const hasCobcloud = !!(settings.cobcloud_token_client || settings.cobcloud_token_company || settings.cobcloud_token_assessoria);
      const hasAsaas = !!settings.asaas_api_key || hasAsaasCustomer;
      const hasNegociarieKey = !!(settings.negociarie_api_key || settings.negociarie_token) || hasNegociarie;
      if (hasCobcloud) gatewayProviders.push("Cobcloud");
      if (hasAsaas) gatewayProviders.push("Asaas");
      if (hasNegociarieKey) gatewayProviders.push("Negociarie");
      const gatewaysOk = gatewayProviders.length > 0 || !!manualSteps.gateways;
      const gatewaysDetail = gatewayProviders.length > 0
        ? `${gatewayProviders.join(" + ")} ativo(s)`
        : "Nenhum gateway configurado";

      // Etapa 6 — Carteira (probe leve, evita count exact em tabelas grandes)
      const carteiraOk = hasClients;
      const carteiraInProgress = hasClients && !hasClientsClassified;
      const carteiraDetail = !hasClients
        ? "Carteira vazia"
        : carteiraInProgress
          ? "Aguardando classificação de status"
          : "Carteira ativa";

      const steps: SetupStep[] = [
        {
          id: "empresa",
          title: "Dados da empresa",
          description: "Razão social, CNPJ, logo e identidade visual",
          detail: empresaDetail,
          status: empresaOk ? "complete" : "pending",
          ctaPath: "/central-empresa",
          ctaLabel: "Configurar empresa",
        },
        {
          id: "cadastros",
          title: "Credores e cadastros base",
          description: "Credores, tipos de devedor/dívida, status, scripts e dispositions",
          detail: cadastrosDetail,
          status: cadastrosFull ? "complete" : cadastrosMin ? "in_progress" : "pending",
          ctaPath: "/cadastros",
          ctaLabel: "Configurar cadastros",
        },
        {
          id: "equipe",
          title: "Equipe e permissões",
          description: "Criar operadores e definir acesso",
          detail: equipeDetail,
          status: equipeOk ? "complete" : "pending",
          ctaPath: "/usuarios",
          ctaLabel: "Gerenciar usuários",
        },
        {
          id: "canais",
          title: "Canais de comunicação",
          description: "Conectar WhatsApp, telefonia e e-mail",
          detail: canaisDetail,
          status: canaisOk ? "complete" : "pending",
          ctaPath: "/contact-center/whatsapp",
          ctaLabel: "Conectar canais",
        },
        {
          id: "gateways",
          title: "Gateways de pagamento",
          description: "Asaas, Negociarie e outras integrações financeiras",
          detail: gatewaysDetail,
          status: gatewaysOk ? "complete" : "pending",
          ctaPath: "/configuracoes/integracao",
          ctaLabel: "Configurar gateways",
        },
        {
          id: "carteira",
          title: "Importação da carteira",
          description: "Subir a primeira leva de cobranças via planilha ou MaxList",
          detail: carteiraDetail,
          status: carteiraOk ? (carteiraInProgress ? "in_progress" : "complete") : "pending",
          ctaPath: "/carteira",
          ctaLabel: "Importar carteira",
        },
      ];

      const completedCount = steps.filter((s) => s.status === "complete").length;
      // Critical = não-opcionais
      const criticalPending = steps.filter((s) => !s.optional && s.status !== "complete").length;

      return {
        steps,
        completedCount,
        totalCount: steps.length,
        criticalPending,
        setupCompletedAt,
      };
    },
  });

  return {
    ...(query.data || { steps: [], completedCount: 0, totalCount: 6, criticalPending: 6, setupCompletedAt: null }),
    loading: query.isLoading,
    refetch: query.refetch,
  };
}
