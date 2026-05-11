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
        integrationsCount,
        clientsCount,
        clientsStatusCount,
        workflowsCount,
      ] = await Promise.all([
        supabase.from("tenants").select("name, cnpj, logo_url, setup_completed_at, setup_steps_state").eq("id", tenantId).maybeSingle(),
        safeCount("credores", tenantId),
        safeCount("tipos_devedor", tenantId),
        safeCount("tipos_divida", tenantId),
        safeCount("tipos_status", tenantId),
        safeCount("scripts_abordagem", tenantId),
        safeCount("call_disposition_types", tenantId),
        safeCount("tenant_users", tenantId, (q) => q.eq("role", "operador")),
        safeCount("whatsapp_instances", tenantId),
        safeCount("integration_tokens", tenantId),
        safeCount("clients", tenantId),
        safeCount("clients", tenantId, (q) => q.neq("status", "pendente")),
        safeCount("workflow_flows", tenantId),
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

      // Etapa 2 — Cadastros base
      const cadastrosMin = credoresCount > 0 && (tiposDevedorCount + tiposDividaCount + statusCobrancaCount) > 0;
      const cadastrosFull = credoresCount > 0 && tiposDevedorCount > 0 && tiposDividaCount > 0 && statusCobrancaCount > 0 && scriptsCount > 0 && dispositionsCount > 0;
      const cadastrosDetail = credoresCount === 0
        ? "Nenhum credor cadastrado"
        : `${credoresCount} credor(es), ${tiposDevedorCount + tiposDividaCount + statusCobrancaCount} tipos/status${scriptsCount > 0 ? `, ${scriptsCount} script(s)` : ""}`;

      // Etapa 3 — Equipe
      const equipeOk = operatorsCount > 0;
      const equipeDetail = operatorsCount > 0 ? `${operatorsCount} operador(es) ativo(s)` : "Nenhum operador cadastrado";

      // Etapa 4 — Canais
      const canaisOk = whatsappCount > 0 || !!manualSteps.canais;
      const canaisDetail = whatsappCount > 0 ? `${whatsappCount} instância(s) de WhatsApp` : "Nenhum canal conectado";

      // Etapa 5 — Gateways
      const gatewaysOk = integrationsCount > 0 || !!manualSteps.gateways;
      const gatewaysDetail = integrationsCount > 0 ? `${integrationsCount} integração(ões) ativa(s)` : "Nenhum gateway configurado";

      // Etapa 6 — Carteira
      const carteiraOk = clientsCount > 0;
      const carteiraInProgress = clientsCount > 0 && clientsStatusCount === 0;
      const carteiraDetail = clientsCount === 0
        ? "Carteira vazia"
        : carteiraInProgress
          ? `${clientsCount} parcela(s), aguardando classificação de status`
          : `${clientsCount} parcela(s) carregadas`;

      // Etapa 7 — Automação
      const automacaoOk = workflowsCount > 0 || !!manualSteps.automacao;
      const automacaoDetail = workflowsCount > 0 ? `${workflowsCount} workflow(s)` : "Nenhuma automação configurada";

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
        {
          id: "automacao",
          title: "Automação e workflows",
          description: "Disparos automáticos, régua de cobrança e score",
          detail: automacaoDetail,
          status: automacaoOk ? "complete" : "pending",
          ctaPath: "/automacao",
          ctaLabel: "Configurar automação",
          optional: true,
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
    ...(query.data || { steps: [], completedCount: 0, totalCount: 7, criticalPending: 7, setupCompletedAt: null }),
    loading: query.isLoading,
    refetch: query.refetch,
  };
}
