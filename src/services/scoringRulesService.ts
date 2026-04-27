import { supabase } from "@/integrations/supabase/client";

export type ScoringMetric =
  | "payment_count"
  | "total_received"
  | "agreement_created"
  | "agreement_paid"
  | "agreement_break"
  | "achievement_unlocked"
  | "goal_reached";

export interface ScoringRule {
  id: string;
  tenant_id: string;
  metric: ScoringMetric;
  label: string;
  points: number;
  unit_size: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export const METRIC_DEFAULTS: Record<
  ScoringMetric,
  { label: string; points: number; unit_size: number; description: string; unit_label: string }
> = {
  payment_count:        { label: "Pagamento confirmado",      points: 10,  unit_size: 1,   description: "Pontos por cada pagamento confirmado no mês.", unit_label: "por pagamento" },
  total_received:       { label: "Cada R$ 100 recebidos",     points: 5,   unit_size: 100, description: "Pontos a cada faixa de valor recebido. Ajuste 'Por unidade' para mudar a faixa (ex.: 100 = a cada R$100).", unit_label: "por faixa" },
  agreement_created:    { label: "Acordo formalizado",        points: 0,   unit_size: 1,   description: "Pontos por cada acordo criado no mês (independente de quitação).", unit_label: "por acordo" },
  agreement_paid:       { label: "Acordo totalmente quitado", points: 30,  unit_size: 1,   description: "Pontos quando um acordo do operador é integralmente quitado no mês.", unit_label: "por acordo pago" },
  agreement_break:      { label: "Quebra de acordo",          points: -3,  unit_size: 1,   description: "Pontos descontados por cada acordo cancelado no mês. Use valor negativo.", unit_label: "por quebra" },
  achievement_unlocked: { label: "Conquista desbloqueada",    points: 50,  unit_size: 1,   description: "Pontos por cada conquista que o operador acumular.", unit_label: "por conquista" },
  goal_reached:         { label: "Meta do mês atingida",      points: 100, unit_size: 1,   description: "Bônus único quando o valor recebido atinge a meta do mês.", unit_label: "bônus único" },
};

const getMyTenantId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return (data?.tenant_id as string) || null;
};

export const fetchScoringRules = async (): Promise<ScoringRule[]> => {
  const tenantId = await getMyTenantId();
  if (!tenantId) return [];
  const { data, error } = await supabase
    .from("gamification_scoring_rules")
    .select("*")
    .eq("tenant_id", tenantId);
  if (error) throw error;

  const rows = (data || []) as ScoringRule[];
  // Ordenar conforme a ordem fixa de exibição
  const order: ScoringMetric[] = [
    "payment_count",
    "total_received",
    "agreement_created",
    "agreement_paid",
    "agreement_break",
    "achievement_unlocked",
    "goal_reached",
  ];
  return rows.sort((a, b) => order.indexOf(a.metric) - order.indexOf(b.metric));
};

export const updateScoringRule = async (
  id: string,
  patch: Partial<Pick<ScoringRule, "points" | "unit_size" | "enabled">>,
): Promise<void> => {
  // Clamps defensivos (alinhados com CHECK constraints do banco)
  const clamped: typeof patch = { ...patch };
  if (typeof clamped.points === "number") {
    clamped.points = Math.max(-1000, Math.min(1000, Math.round(clamped.points)));
  }
  if (typeof clamped.unit_size === "number") {
    clamped.unit_size = Math.max(1, Math.round(clamped.unit_size));
  }
  const { error } = await supabase
    .from("gamification_scoring_rules")
    .update(clamped)
    .eq("id", id);
  if (error) throw error;
};

export const restoreDefaultScoringRules = async (): Promise<void> => {
  const tenantId = await getMyTenantId();
  if (!tenantId) return;

  const updates = (Object.entries(METRIC_DEFAULTS) as [ScoringMetric, typeof METRIC_DEFAULTS[ScoringMetric]][]).map(
    ([metric, def]) =>
      supabase
        .from("gamification_scoring_rules")
        .update({ label: def.label, points: def.points, unit_size: def.unit_size, enabled: true })
        .eq("tenant_id", tenantId)
        .eq("metric", metric),
  );
  await Promise.all(updates);
};
