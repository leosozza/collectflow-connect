import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export type DashboardBlockId =
  | "metas"
  | "totalRecebido"
  | "acionadosHoje"
  | "agendamentos"
  | "acordosDia"
  | "parcelas"
  | "acordosMes"
  | "totalQuebra"
  | "pendentes"
  | "colchaoAcordos";

export interface DashboardLayout {
  visible: Record<DashboardBlockId, boolean>;
  /** Linear order of all blocks in the unified drag-and-drop grid. */
  order: DashboardBlockId[];
}

export const ALL_DASHBOARD_BLOCKS: DashboardBlockId[] = [
  "metas",
  "totalRecebido",
  "acionadosHoje",
  "agendamentos",
  "acordosDia",
  "parcelas",
  "acordosMes",
  "totalQuebra",
  "pendentes",
  "colchaoAcordos",
];

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  visible: {
    metas: true,
    totalRecebido: true,
    acionadosHoje: true,
    agendamentos: true,
    acordosDia: true,
    parcelas: true,
    acordosMes: true,
    totalQuebra: true,
    pendentes: true,
    colchaoAcordos: true,
  },
  // Ordem linear do grid 3-col (com gridAutoFlow:dense respeitando spans):
  // Linha 1: Meta | TotalRecebido(rs2) | AcionadosHoje
  // Linha 2: Agendamentos | (TotalRecebido) | AcordosDia
  // Linha 3: Parcelas(cs2)              | AcordosMes
  // Linha 4+: TotalQuebra, Pendentes, Colchão
  order: [
    "metas",
    "totalRecebido",
    "acionadosHoje",
    "agendamentos",
    "acordosDia",
    "parcelas",
    "acordosMes",
    "totalQuebra",
    "pendentes",
    "colchaoAcordos",
  ],
};

const STORAGE_PREFIX = "rivo:dashboard-layout:v3";

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
