import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";

export interface ThreeCPlusAgentState {
  status: number | undefined;
  callId: string | number | null;
  isOnline: boolean;
  lastPoll: Date | null;
}

/**
 * Shared hook that polls the 3CPlus agents_status endpoint independently.
 * Works regardless of whether TelefoniaDashboard is mounted.
 * Polls every 5s when on call, 10s otherwise.
 */
export function useThreeCPlusStatus(): ThreeCPlusAgentState {
  const { tenant } = useTenant();
  const { profile } = useAuth();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const domain = settings.threecplus_domain || "";
  const apiToken = settings.threecplus_api_token || "";
  const operatorAgentId = (profile as any)?.threecplus_agent_id as number | null | undefined;

  const [state, setState] = useState<ThreeCPlusAgentState>({
    status: undefined,
    callId: null,
    isOnline: false,
    lastPoll: null,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastStatusRef = useRef<number | undefined>(undefined);

  const poll = useCallback(async () => {
    if (!domain || !apiToken || !operatorAgentId) return;

    try {
      const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
        body: { action: "agents_status", domain, api_token: apiToken },
      });
      if (error || data?.success === false) return;

      const agentList = Array.isArray(data) ? data : data?.data || [];
      const myAgent = agentList.find(
        (a: any) => a.id === operatorAgentId || a.agent_id === operatorAgentId
      );

      if (!myAgent) {
        setState({ status: undefined, callId: null, isOnline: false, lastPoll: new Date() });
        return;
      }

      const isOnline = myAgent.status !== 0 && myAgent.status !== "offline";
      const status = isOnline ? myAgent.status : undefined;

      // Extract call_id from company_calls data if available
      let callId: string | number | null = sessionStorage.getItem("3cp_last_call_id");

      setState({ status, callId, isOnline, lastPoll: new Date() });
      lastStatusRef.current = status;
    } catch {
      // silent — network errors shouldn't break the UI
    }
  }, [domain, apiToken, operatorAgentId]);

  // Start/restart polling with adaptive interval
  useEffect(() => {
    if (!domain || !apiToken || !operatorAgentId) {
      setState({ status: undefined, callId: null, isOnline: false, lastPoll: null });
      return;
    }

    // Initial poll
    poll();

    // Adaptive interval: 5s when on call (status 2), 10s otherwise
    const getInterval = () => {
      return lastStatusRef.current === 2 ? 5000 : 10000;
    };

    const startInterval = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        poll();
        // Re-check interval (adaptive)
        const newMs = getInterval();
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = setInterval(poll, newMs);
        }
      }, getInterval());
    };

    startInterval();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [domain, apiToken, operatorAgentId, poll]);

  return state;
}
