import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import { format } from "date-fns";

export interface ScheduledCallback {
  id: string;
  client_id: string;
  operator_id: string;
  scheduled_callback: string;
  disposition_type: string;
  notes: string | null;
  client_name?: string;
  client_cpf?: string;
  operator_name?: string;
}

export function useScheduledCallbacks() {
  const { user, profile } = useAuth();
  const { tenant } = useTenant();
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const notifiedIds = useRef<Set<string>>(new Set());

  const canViewAll = permissions.canViewAllAgendados;

  const { data: callbacks = [], isLoading } = useQuery({
    queryKey: ["scheduled-callbacks", tenant?.id, canViewAll, profile?.id],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const tomorrow = format(new Date(Date.now() + 86400000), "yyyy-MM-dd");

      let query = supabase
        .from("call_dispositions")
        .select("id, client_id, operator_id, scheduled_callback, disposition_type, notes")
        .gte("scheduled_callback", today)
        .lt("scheduled_callback", tomorrow)
        .order("scheduled_callback", { ascending: true });

      if (!canViewAll && profile?.id) {
        query = query.eq("operator_id", profile.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Enrich with client names
      const clientIds = [...new Set((data || []).map((d: any) => d.client_id))];
      const operatorIds = [...new Set((data || []).map((d: any) => d.operator_id))];

      let clientMap: Record<string, { nome_completo: string; cpf: string }> = {};
      if (clientIds.length > 0) {
        const { data: clients } = await supabase
          .from("clients")
          .select("id, nome_completo, cpf")
          .in("id", clientIds);
        for (const c of clients || []) {
          clientMap[c.id] = { nome_completo: c.nome_completo, cpf: c.cpf };
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
        operator_name: operatorMap[d.operator_id] || undefined,
      })) as ScheduledCallback[];
    },
    enabled: !!tenant?.id && !!profile?.id,
    refetchInterval: 60000,
  });

  // Check for upcoming callbacks and show toast notifications
  useEffect(() => {
    if (!callbacks.length) return;

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

        // Create notification in the bell
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
  }, [callbacks, user, tenant, queryClient]);

  return {
    callbacks,
    isLoading,
    count: callbacks.length,
    canViewAll,
  };
}
