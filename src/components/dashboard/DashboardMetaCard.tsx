/**
 * ⚠ ARQUIVO CRÍTICO — ler `docs/README.md` antes de editar.
 * Regras: multi-tenant (sempre `tenant_id`), modo de metas (`global` | `per_credor`).
 * NUNCA somar os dois grupos de `operator_goals` (causa inflação da meta — bug 255k).
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyGoals, fetchGoals, fetchTenantGoalsMode } from "@/services/goalService";
import { Trophy, Target, Wallet } from "lucide-react";
import MetaRadialCard from "./MetaRadialCard";
import { formatCurrency } from "@/lib/formatters";

interface DashboardMetaCardProps {
  year: number;
  month: number; // 1-12
  monthLabel: string;
  selectedOperatorUserId: string | null; // user_id from global filter
  received: number; // total_recebido from dashboard RPC
  tenantId: string | null;
  colchao?: number;
}

const DashboardMetaCard = ({
  year,
  month,
  monthLabel,
  selectedOperatorUserId,
  received,
  tenantId,
  colchao = 0,
}: DashboardMetaCardProps) => {
  const { profile } = useAuth();
  const { isTenantAdmin } = useTenant();

  // Tenant goals mode (global vs per_credor)
  const { data: goalsMode = "global" } = useQuery({
    queryKey: ["tenant-goals-mode", tenantId],
    queryFn: () => fetchTenantGoalsMode(tenantId!),
    enabled: !!tenantId,
  });

  // Operator: own goal(s)
  const { data: myGoals = [] } = useQuery({
    queryKey: ["dash-meta-my-goals", year, month, profile?.id, tenantId, goalsMode],
    queryFn: () => fetchMyGoals(year, month, tenantId || undefined, goalsMode),
    enabled: !isTenantAdmin && !!profile?.id,
  });

  // Admin: all goals for the period (filtered by tenant goals mode)
  const { data: allGoals = [] } = useQuery({
    queryKey: ["dash-meta-goals-all", year, month, tenantId, goalsMode],
    queryFn: () => fetchGoals(year, month, undefined, tenantId || undefined, goalsMode),
    enabled: isTenantAdmin,
  });

  // Admin + 1 operator: resolve user_id -> profile.id and name
  const { data: selectedProfile } = useQuery({
    queryKey: ["dash-meta-profile-by-user", selectedOperatorUserId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("user_id", selectedOperatorUserId!)
        .maybeSingle();
      return data;
    },
    enabled: isTenantAdmin && !!selectedOperatorUserId,
  });

  const { goal, title } = useMemo(() => {
    if (!isTenantAdmin) {
      const total = myGoals.reduce((s, g) => s + Number(g.target_amount || 0), 0);
      return {
        goal: total,
        title: "Meta do Mês",
      };
    }
    if (selectedOperatorUserId && selectedProfile?.id) {
      const opGoals = allGoals.filter((g) => g.operator_id === selectedProfile.id);
      const total = opGoals.reduce((s, g) => s + Number(g.target_amount || 0), 0);
      return {
        goal: total,
        title: `Meta: ${selectedProfile.full_name}`,
      };
    }
    const total = allGoals.reduce((s, g) => s + Number(g.target_amount || 0), 0);
    return { goal: total, title: "Meta da Equipe" };
  }, [isTenantAdmin, myGoals, allGoals, selectedOperatorUserId, selectedProfile]);

  const pct = goal > 0 ? Math.min(100, Math.round((received / goal) * 100)) : 0;
  const remaining = Math.max(goal - received, 0);

  return (
    <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-[0_1px_2px_0_rgb(0_0_0_/_0.04)] hover:shadow-[0_4px_16px_-4px_hsl(var(--primary)/0.15)] transition-shadow w-full h-full min-h-0 flex flex-col">
      {/* Header escuro RIVO */}
      <div className="px-4 py-2.5 shrink-0 bg-secondary text-secondary-foreground flex items-center gap-2">
        <div className="rounded-lg p-1.5 inline-flex bg-primary/15 ring-1 ring-primary/30">
          <Trophy className="w-3.5 h-3.5 text-primary" strokeWidth={2.5} />
        </div>
        <h2 className="text-[12px] font-semibold tracking-[0.04em] uppercase text-white/95">
          {title}
        </h2>
        <span className="ml-auto text-[10px] text-white/55 tracking-wide capitalize">
          {monthLabel}
        </span>
      </div>

      <div className="relative p-3 flex-1 min-h-0 flex items-center justify-center">
        {/* Colchão — discreto no canto superior esquerdo */}
        {goal > 0 && colchao > 0 && (
          <div
            className="absolute top-2 left-3 flex flex-col leading-tight"
            title="Parcelas com vencimento no mês originadas de acordos criados em meses anteriores (entrada + parcelas mensais)."
          >
            <span className="flex items-center gap-1 text-[9px] uppercase tracking-[0.08em] text-muted-foreground/70 font-medium">
              <Wallet className="w-2.5 h-2.5 text-primary/60" strokeWidth={2.25} />
              Colchão
            </span>
            <span className="text-xs font-semibold text-foreground tabular-nums mt-0.5">
              {formatCurrency(colchao)}
            </span>
          </div>
        )}

        {goal === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 text-center py-6">
            <div className="rounded-full p-3 bg-primary/10">
              <Target className="w-6 h-6 text-primary/70" strokeWidth={2} />
            </div>
            <p className="text-xs text-muted-foreground max-w-[200px]">
              Nenhuma meta definida para este período.
            </p>
          </div>
        ) : (
          <MetaRadialCard
            percent={pct}
            received={received}
            goal={goal}
            monthLabel={monthLabel}
            year={year}
            month={month}
            size={230}
            duration={1.4}
          />
        )}
      </div>

      {/* Footer com info adicional */}
      {goal > 0 && (
        <div className="px-4 py-2 shrink-0 border-t border-border/40 bg-muted/30 flex items-center justify-between text-[10px]">
          <div className="flex flex-col">
            <span className="text-muted-foreground/70 uppercase tracking-wide">Recebido</span>
            <span className="font-semibold text-foreground tabular-nums">
              {formatCurrency(received)}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground/70 uppercase tracking-wide">Faltam</span>
            <span className="font-semibold text-primary tabular-nums">
              {formatCurrency(remaining)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardMetaCard;
