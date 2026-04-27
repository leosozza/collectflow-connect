import { useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";

/**
 * Trigger consolidado de gamificação.
 *
 * Toda a lógica (snapshot mensal, scores de campanhas ativas, premiação de meta
 * mensal e concessão de conquistas) roda no servidor através da RPC
 * `recalculate_my_full`, em uma única transação. Isso elimina 6+ queries
 * client-side, garante consistência multi-tenant e usa a mesma SSoT do Ranking
 * e do Dashboard.
 *
 * Em paralelo, a Edge Function `gamification-recalc-tick` (cron a cada 30 min)
 * recalcula automaticamente todos os operadores de tenants com gamificação
 * habilitada — ou seja, o ranking se mantém correto mesmo para operadores que
 * nunca abrem a tela.
 */
export const useGamificationTrigger = () => {
  const { user, profile } = useAuth();
  const { tenantUser } = useTenant();

  const triggerGamificationUpdate = useCallback(async () => {
    if (!profile?.id || !user?.id || !tenantUser?.tenant_id) return null;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    try {
      const { data, error } = await supabase.rpc("recalculate_my_full", {
        _year: year,
        _month: month,
      });
      if (error) {
        console.error("recalculate_my_full error:", error);
        return null;
      }
      return data;
    } catch (err) {
      console.error("Gamification trigger error:", err);
      return null;
    }
  }, [user?.id, profile?.id, tenantUser?.tenant_id]);

  return { triggerGamificationUpdate };
};
