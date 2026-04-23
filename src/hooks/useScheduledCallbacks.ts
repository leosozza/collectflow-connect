import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import { format, startOfDay, endOfDay, isSameDay } from "date-fns";

export interface ScheduledCallback {
  id: string;
  client_id: string;
  operator_id: string;
  scheduled_callback: string;
  disposition_type: string;
  notes: string | null;
  client_name?: string;
  client_cpf?: string;
  client_credor?: string;
  operator_name?: string;
}

export function useScheduledCallbacks(date?: Date) {
  const { user, profile } = useAuth();
  const { tenant } = useTenant();
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const notifiedIds = useRef<Set<string>>(new Set());

  const canViewAll = permissions.canViewAllAgendados;
  const targetDate = date ?? new Date();
  const dateKey = format(targetDate, "yyyy-MM-dd");
  const isToday = isSameDay(targetDate, new Date());

  const { data: callbacks = [], isLoading } = useQuery({
    queryKey: ["scheduled-callbacks", tenant?.id, canViewAll, profile?.id, dateKey],
    queryFn: async () => {
      const start = startOfDay(targetDate).toISOString();
      const end = endOfDay(targetDate).toISOString();

      let query = supabase
        .from("call_dispositions")
        .select("id, client_id, operator_id, scheduled_callback, disposition_type, notes")
        .gte("scheduled_callback", start)
        .lte("scheduled_callback", end)
        .order("scheduled_callback", { ascending: true });

      if (!canViewAll && profile?.id) {
        query = query.eq("operator_id", profile.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const clientIds = [...new Set((data || []).map((d: any) => d.client_id))];
      const operatorIds = [...new Set((data || []).map((d: any) => d.operator_id))];

      let clientMap: Record<string, { nome_completo: string; cpf: string; credor: string | null }> = {};
      if (clientIds.length > 0) {
        const { data: clients } = await supabase
          .from("clients")
          .select("id, nome_completo, cpf, credor")
          .in("id", clientIds);
        for (const c of clients || []) {
          clientMap[c.id] = { nome_completo: c.nome_completo, cpf: c.cpf, credor: (c as any).credor ?? null };
        }
      }

      let operatorMap: Record<string, string> = {};
      if (canViewAll && operatorIds.length > 0) {
        const { data: operators } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", operatorIds);
        for (const o of operators || []) {
          operatorMap[o.id] = o.full_name || "Sem nome";
        }
      }

      return (data || []).map((d: any) => ({
        ...d,
        client_name: clientMap[d.client_id]?.nome_completo || "Cliente",
        client_cpf: clientMap[d.client_id]?.cpf || "",
        client_credor: clientMap[d.client_id]?.credor || "",
        operator_name: operatorMap[d.operator_id] || undefined,
      })) as ScheduledCallback[];
    },
    enabled: !!tenant?.id && !!profile?.id,
    refetchInterval: 60000,
  });

  // Notifications only for today's callbacks
  useEffect(() => {
    if (!callbacks.length || !isToday) return;

    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    for (const cb of callbacks) {
      if (!cb.scheduled_callback || notifiedIds.current.has(cb.id)) continue;
      const cbTime = new Date(cb.scheduled_callback).getTime();
      const diff = cbTime - now;

      if (diff >= 0 && diff <= fiveMinutes) {
        notifiedIds.current.add(cb.id);
        const timeStr = format(new Date(cb.scheduled_callback), "HH:mm");
        toast.info(`Retorno agendado: ${cb.client_name}`, {
          description: `Agendado para ${timeStr}`,
          duration: 15000,
          action: {
            label: "Abrir ficha",
            onClick: () => {
              const cpf = cb.client_cpf?.replace(/\D/g, "");
              if (cpf) window.location.href = `/carteira/${cpf}`;
            },
          },
        });

        if (user && tenant) {
          supabase.rpc("create_notification", {
            _tenant_id: tenant.id,
            _user_id: user.id,
            _title: `Retorno agendado: ${cb.client_name}`,
            _message: `Callback agendado para ${timeStr}`,
            _type: "info",
            _reference_type: "client",
            _reference_id: cb.client_id,
          }).then(() => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
          });
        }
      }
    }
  }, [callbacks, user, tenant, queryClient, isToday]);

  return {
    callbacks,
    isLoading,
    count: callbacks.length,
    canViewAll,
  };
}
