import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";

export interface ThreeCPlusAgentState {
  status: number | undefined;
  callId: string | number | null;
  isOnline: boolean;
  lastPoll: Date | null;
  activeCallPhone: string | null;
  activeCallCpf: string | null;
  activeCallClientDbId: string | null;
}

/**
 * Mark a callId as "hung up" so the polling won't overwrite local state
 * with stale data from a call that the operator already handled.
 */
let _dismissedCallIds = new Set<string>();

export function dismissCallId(callId: string | number | null) {
  if (callId) _dismissedCallIds.add(String(callId));
}

export function clearDismissedCallIds() {
  _dismissedCallIds.clear();
}

/**
 * Shared hook that polls the 3CPlus agents_status + company_calls endpoints independently.
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
    activeCallPhone: null,
    activeCallCpf: null,
    activeCallClientDbId: null,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastStatusRef = useRef<number | undefined>(undefined);

  const poll = useCallback(async () => {
    if (!domain || !apiToken || !operatorAgentId) return;

    try {
      // Parallel fetch: agents_status + company_calls
      const invoke = (action: string) =>
        supabase.functions.invoke("threecplus-proxy", {
          body: { action, domain, api_token: apiToken },
        });

      const [agentsRes, callsRes] = await Promise.all([
        invoke("agents_status").catch(() => ({ data: null, error: true })),
        invoke("company_calls").catch(() => ({ data: null, error: true })),
      ]);

      // Process agents_status
      const agentsData = agentsRes.data;
      if (!agentsData || agentsData?.success === false) {
        setState(prev => ({ ...prev, lastPoll: new Date() }));
        return;
      }

      const agentList = Array.isArray(agentsData) ? agentsData : agentsData?.data || [];
      const myAgent = agentList.find(
        (a: any) => a.id === operatorAgentId || a.agent_id === operatorAgentId
      );

      if (!myAgent) {
        setState({
          status: undefined, callId: null, isOnline: false, lastPoll: new Date(),
          activeCallPhone: null, activeCallCpf: null, activeCallClientDbId: null,
        });
        return;
      }

      const isOnline = myAgent.status !== 0 && myAgent.status !== "offline";
      const status = isOnline ? myAgent.status : undefined;

      // Process company_calls — extract active call for this agent
      let activeCallPhone: string | null = null;
      let activeCallCpf: string | null = null;
      let activeCallClientDbId: string | null = null;
      let callId: string | number | null = sessionStorage.getItem("3cp_last_call_id");

      const callsData = callsRes.data;
      if (callsData && callsData?.success !== false) {
        const rawCalls = callsData?.data || callsData;
        let allCalls: any[] = [];
        if (Array.isArray(rawCalls)) {
          allCalls = rawCalls;
        } else if (typeof rawCalls === "object" && rawCalls !== null) {
          for (const statusKey of Object.keys(rawCalls)) {
            const group = rawCalls[statusKey];
            if (Array.isArray(group)) allCalls.push(...group);
          }
        }

        const agentIdStr = String(operatorAgentId);
        const myCalls = allCalls.filter(
          (c: any) => String(c.agent) === agentIdStr || String(c.agent_id) === agentIdStr
        );
        const liveCall = myCalls.find((c: any) => !c.hangup_time && String(c.status) !== "4") || null;
        const finishedCall = myCalls.find((c: any) => !!c.hangup_time || String(c.status) === "4") || null;
        const activeCall = liveCall || finishedCall;

        if (activeCall) {
          const telephonyId = activeCall.telephony_id || activeCall.call_id || activeCall.id;
          if (telephonyId) {
            // Guard: skip if this callId was already dismissed (hung up / tabulated)
            if (_dismissedCallIds.has(String(telephonyId))) {
              // Don't update callId or contact info — stale data
              callId = null;
              activeCallPhone = null;
              activeCallCpf = null;
              activeCallClientDbId = null;
            } else {
              callId = telephonyId;
              sessionStorage.setItem("3cp_last_call_id", String(telephonyId));
              activeCallPhone = activeCall.phone || myAgent?.phone || myAgent?.remote_phone || null;
              activeCallCpf = activeCall.identifier || activeCall.mailing_identifier || null;
              activeCallClientDbId = activeCall.Extra3 || activeCall.extra3 || activeCall.mailing_extra3 || null;
            }
          }
        }
      }

      setState({ status, callId, isOnline, lastPoll: new Date(), activeCallPhone, activeCallCpf, activeCallClientDbId });
      lastStatusRef.current = status;

      // Auto-clear dismissed IDs when agent goes back to idle (status 1) — fresh cycle
      if (status === 1 || status === undefined) {
        _dismissedCallIds.clear();
      }
      lastStatusRef.current = status;
    } catch {
      // silent — network errors shouldn't break the UI
    }
  }, [domain, apiToken, operatorAgentId]);

  // Start/restart polling with adaptive interval
  useEffect(() => {
    if (!domain || !apiToken || !operatorAgentId) {
      setState({
        status: undefined, callId: null, isOnline: false, lastPoll: null,
        activeCallPhone: null, activeCallCpf: null, activeCallClientDbId: null,
      });
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
