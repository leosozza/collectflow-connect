/**
 * ⚠ ARQUIVO CRÍTICO — ler `docs/README.md` antes de editar.
 * Regras: multi-tenant (sempre `tenant_id`), modo de metas (`global` | `per_credor`).
 * NUNCA somar os dois grupos de `operator_goals` (causa inflação da meta — bug 255k).
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyGoals, fetchGoals, fetchTenantGoalsMode } from "@/services/goalService";
import { Trophy, Target, Wallet } from "lucide-react";
import MetaRadialCard from "./MetaRadialCard";
import DashboardCardHeader from "./DashboardCardHeader";
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
  const bp = useBreakpoint();
  const radialSize = bp === "2xl" ? 230 : bp === "xl" ? 190 : 150;

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
      <DashboardCardHeader
        icon={Trophy}
        title={title}
        right={
          <span className="text-[10px] text-white/60 tracking-wide capitalize">
            {monthLabel}
          </span>
        }
      />

      <div className="relative p-2 xl:p-3 flex-1 min-h-0 flex items-center justify-center">
        {/* Colchão movido para o card Visão 360 */}

        {goal === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 text-center py-4 xl:py-6">
            <div className="rounded-full p-2 xl:p-3 bg-primary/10">
              <Target className="w-5 h-5 xl:w-6 xl:h-6 text-primary/70" strokeWidth={2} />
            </div>
            <p className="text-[11px] xl:text-xs text-muted-foreground max-w-[200px]">
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
            size={radialSize}
            duration={2.5}
          />
        )}
      </div>

      {/* Footer com info adicional */}
      {goal > 0 && (
        <div className="px-3 py-1.5 xl:px-4 xl:py-2.5 shrink-0 border-t border-border/60 bg-muted/40 flex items-center justify-between gap-3">
          <div className="flex flex-col leading-tight min-w-0">
            <span className="text-[10px] xl:text-[11px] text-muted-foreground uppercase tracking-wide">Recebido</span>
            <span className="text-sm xl:text-base font-bold text-foreground tabular-nums truncate">
              {formatCurrency(received)}
            </span>
          </div>
          <div className="flex flex-col items-end leading-tight min-w-0">
            <span className="text-[10px] xl:text-[11px] text-muted-foreground uppercase tracking-wide">Faltam</span>
            <span className="text-sm xl:text-base font-bold text-primary tabular-nums truncate">
              {formatCurrency(remaining)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardMetaCard;
