import { useEffect, useState } from "react";

/**
 * Returns the active Tailwind-like breakpoint based on viewport width.
 * - "sm" : < 1024
 * - "lg" : 1024..1279 (compacto — 14"/17" notebook típico, 1366×768/1600×900)
 * - "xl" : 1280..1535 (padrão — Full HD ~1920 ainda cai aqui em janelas)
 * - "2xl": >= 1536 (confortável — monitores grandes)
 */
export type Breakpoint = "sm" | "lg" | "xl" | "2xl";

function compute(width: number): Breakpoint {
  if (width >= 1536) return "2xl";
  if (width >= 1280) return "xl";
  if (width >= 1024) return "lg";
  return "sm";
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(() =>
    typeof window === "undefined" ? "xl" : compute(window.innerWidth),
  );
  useEffect(() => {
    const handler = () => setBp(compute(window.innerWidth));
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return bp;
}
