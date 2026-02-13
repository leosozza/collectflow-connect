import { useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";

const DEBOUNCE_MS = 5000;

export function useActivityTracker() {
  const location = useLocation();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const lastPathRef = useRef<string>("");
  const lastLogRef = useRef<number>(0);

  const log = useCallback(
    async (activityType: string, pagePath?: string, actionDetail?: string, metadata?: Record<string, any>) => {
      if (!user?.id || !tenant?.id) return;
      const now = Date.now();
      if (activityType === "page_view" && now - lastLogRef.current < DEBOUNCE_MS) return;
      lastLogRef.current = now;

      try {
        await supabase.from("user_activity_logs" as any).insert({
          tenant_id: tenant.id,
          user_id: user.id,
          activity_type: activityType,
          page_path: pagePath || null,
          action_detail: actionDetail || null,
          metadata: metadata || {},
        } as any);
      } catch {
        // silent
      }
    },
    [user?.id, tenant?.id]
  );

  // Track page views
  useEffect(() => {
    if (location.pathname !== lastPathRef.current) {
      lastPathRef.current = location.pathname;
      log("page_view", location.pathname);
    }
  }, [location.pathname, log]);

  const trackAction = useCallback(
    (detail: string, metadata?: Record<string, any>) => {
      log("action", location.pathname, detail, metadata);
    },
    [log, location.pathname]
  );

  return { trackAction };
}
