import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export type DashboardBlockId =
  | "kpisTop"
  | "parcelas"
  | "totalRecebido"
  | "metas"
  | "agendamentos";

export interface DashboardLayout {
  visible: Record<DashboardBlockId, boolean>;
  /** Order of blocks rendered in the right column (parcelas is always left). */
  order: DashboardBlockId[];
}

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  visible: {
    kpisTop: true,
    parcelas: true,
    totalRecebido: true,
    metas: true,
    agendamentos: true,
  },
  order: ["parcelas", "totalRecebido", "metas", "agendamentos"],
};

const STORAGE_PREFIX = "rivo:dashboard-layout:v1";

function sanitize(raw: any): DashboardLayout {
  try {
    if (!raw || typeof raw !== "object") return DEFAULT_DASHBOARD_LAYOUT;
    const visible = { ...DEFAULT_DASHBOARD_LAYOUT.visible, ...(raw.visible || {}) };
    const allIds: DashboardBlockId[] = ["parcelas", "totalRecebido", "metas", "agendamentos"];
    const incoming: DashboardBlockId[] = Array.isArray(raw.order)
      ? raw.order.filter((id: any) => allIds.includes(id))
      : [];
    // Ensure all known ids present (append missing at end)
    const order = [...incoming, ...allIds.filter((id) => !incoming.includes(id))];
    return { visible, order };
  } catch {
    return DEFAULT_DASHBOARD_LAYOUT;
  }
}

export function useDashboardLayout() {
  const { profile } = useAuth();
  const storageKey = useMemo(
    () => `${STORAGE_PREFIX}:${profile?.user_id ?? "anon"}`,
    [profile?.user_id]
  );

  const [layout, setLayoutState] = useState<DashboardLayout>(DEFAULT_DASHBOARD_LAYOUT);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setLayoutState(sanitize(JSON.parse(raw)));
      else setLayoutState(DEFAULT_DASHBOARD_LAYOUT);
    } catch {
      setLayoutState(DEFAULT_DASHBOARD_LAYOUT);
    }
  }, [storageKey]);

  const setLayout = useCallback(
    (next: DashboardLayout) => {
      const safe = sanitize(next);
      setLayoutState(safe);
      try {
        localStorage.setItem(storageKey, JSON.stringify(safe));
      } catch {
        /* ignore quota */
      }
    },
    [storageKey]
  );

  const reset = useCallback(() => setLayout(DEFAULT_DASHBOARD_LAYOUT), [setLayout]);

  return { layout, setLayout, reset };
}
