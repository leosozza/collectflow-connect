import { supabase } from "@/integrations/supabase/client";

/**
 * Recalcula o score operacional para um CPF específico.
 * Chamada complementar ao trigger automático no banco.
 * Falhas são silenciosas (o trigger SQL é o mecanismo primário).
 */
export async function recalcScoreForCpf(cpf: string): Promise<void> {
  try {
    const clean = cpf.replace(/\D/g, "");
    if (clean.length < 11) return;
    await supabase.functions.invoke("calculate-propensity", {
      body: { cpf: clean },
    });
  } catch (err) {
    console.warn("[recalcScore] Falha ao recalcular score para CPF:", err);
  }
}
