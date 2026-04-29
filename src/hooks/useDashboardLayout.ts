import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export type DashboardBlockId =
  | "metas"
  | "totalRecebido"
  | "kpisOperacionais"
  | "kpisFinanceiros"
  | "agendamentos"
  | "parcelas";

export interface DashboardLayout {
  visible: Record<DashboardBlockId, boolean>;
  /** Linear order of all blocks in the unified drag-and-drop grid. */
  order: DashboardBlockId[];
}

export const ALL_DASHBOARD_BLOCKS: DashboardBlockId[] = [
  "kpisOperacionais",
  "kpisFinanceiros",
  "agendamentos",
  "parcelas",
  "metas",
  "totalRecebido",
];

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  visible: {
    kpisOperacionais: true,
    kpisFinanceiros: true,
    agendamentos: true,
    parcelas: true,
    metas: true,
    totalRecebido: true,
  },
  // Linha 1 (topo): KPIs Operacionais | KPIs Financeiros
  // Linha 2 (base): Agendamentos | Parcelas | Metas
  // Linha 3 (extra): Total Recebido (gráfico)
  order: [
    "kpisOperacionais",
    "kpisFinanceiros",
    "agendamentos",
    "parcelas",
    "metas",
    "totalRecebido",
  ],
};

const STORAGE_PREFIX = "rivo:dashboard-layout:v7";

function sanitize(raw: any): DashboardLayout {
  try {
    if (!raw || typeof raw !== "object") return DEFAULT_DASHBOARD_LAYOUT;
    const visible = { ...DEFAULT_DASHBOARD_LAYOUT.visible, ...(raw.visible || {}) };
    const incoming: DashboardBlockId[] = Array.isArray(raw.order)
      ? raw.order.filter((id: any) => ALL_DASHBOARD_BLOCKS.includes(id))
      : [];
    const order = [
      ...incoming,
      ...ALL_DASHBOARD_BLOCKS.filter((id) => !incoming.includes(id)),
    ];
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
