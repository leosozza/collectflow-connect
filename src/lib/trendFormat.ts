/**
 * Formato e cor padrão de variação % no sistema inteiro.
 *
 * Regras (definidas pelo usuário):
 * - Sempre 2 casas decimais (ex.: "+12,34%", "−5,80%", "0,00%").
 * - Cores: positivo → verde, negativo → vermelho, igual (0%) → azul.
 * - `invert=true` em métricas onde subir é ruim (ex.: Quebra, Pendentes).
 */

export type TrendTone = "positive" | "negative" | "neutral";

export interface TrendData {
  value: string;
  tone: TrendTone;
  raw: number;
  /** Compat: alguns componentes ainda usam isPositive. */
  isPositive: boolean;
}

const NBSP_MINUS = "−"; // U+2212, mais bonito que '-'

const formatPct = (pct: number): string => {
  const rounded = Math.round(pct * 100) / 100; // 2 casas
  if (rounded === 0) return "0,00%";
  const abs = Math.abs(rounded)
    .toFixed(2)
    .replace(".", ",");
  return rounded > 0 ? `+${abs}%` : `${NBSP_MINUS}${abs}%`;
};

export function formatTrendPct(
  current: number,
  previous: number,
  opts: { invert?: boolean } = {}
): TrendData | null {
  const c = Number(current) || 0;
  const p = Number(previous) || 0;
  const { invert = false } = opts;

  if (p === 0 && c === 0) return null;

  if (p === 0) {
    // Convenção: subiu de zero → +100,00%
    const tone: TrendTone = invert ? "negative" : "positive";
    return {
      value: "+100,00%",
      tone,
      raw: 100,
      isPositive: tone === "positive",
    };
  }

  const pct = ((c - p) / p) * 100;
  const rounded = Math.round(pct * 100) / 100;

  let tone: TrendTone;
  if (rounded === 0) {
    tone = "neutral";
  } else {
    const isUp = rounded > 0;
    const goodDirection = invert ? !isUp : isUp;
    tone = goodDirection ? "positive" : "negative";
  }

  return {
    value: formatPct(rounded),
    tone,
    raw: rounded,
    isPositive: tone === "positive",
  };
}

export const trendToneClass: Record<TrendTone, string> = {
  positive: "text-emerald-600",
  negative: "text-red-500",
  neutral: "text-blue-500",
};
