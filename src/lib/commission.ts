export interface CommissionTier {
  min: number;
  max: number | null;
  rate: number;
}

export interface CommissionGrade {
  id: string;
  name: string;
  tiers: CommissionTier[];
  created_at: string;
  updated_at: string;
}

/**
 * Calculate commission based on tiered grade.
 * The rate is flat (not marginal) — the entire amount uses the bracket's rate.
 */
export const calculateTieredCommission = (
  totalReceived: number,
  tiers: CommissionTier[]
): { rate: number; commission: number } => {
  if (!tiers || tiers.length === 0) return { rate: 0, commission: 0 };

  // Sort tiers by min ascending
  const sorted = [...tiers].sort((a, b) => a.min - b.min);

  for (const tier of sorted) {
    const inRange =
      totalReceived >= tier.min &&
      (tier.max === null || totalReceived <= tier.max);
    if (inRange) {
      return {
        rate: tier.rate,
        commission: totalReceived * (tier.rate / 100),
      };
    }
  }

  // Fallback: use last tier if above all ranges
  const last = sorted[sorted.length - 1];
  return {
    rate: last.rate,
    commission: totalReceived * (last.rate / 100),
  };
};
