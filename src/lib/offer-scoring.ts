// Offer Scoring — PRD Section 10.3
// Deterministic, no LLM. Every score is auditable.

interface OfferInput {
  amount: number;
  askingPrice: number;
  financingState: string;
  desiredClosingAt: Date | null;
  idVerified: boolean;
  financingProofPresent: boolean;
  buyerProfileAgeDays: number;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function scoreOffer(input: OfferInput) {
  // Amount: 85% asking = 0, 105% asking = 100
  const scoreAmount = Math.round(
    clamp01((input.amount - input.askingPrice * 0.85) / (input.askingPrice * 0.20)) * 100
  );

  // Financing strength
  const FINANCE_MAP: Record<string, number> = {
    CASH: 100,
    PRE_APPROVED: 85,
    IN_PROCESS: 55,
    NONE: 15,
    UNKNOWN: 30,
  };
  const scoreFinance = FINANCE_MAP[input.financingState] ?? 30;

  // Timing: closes today = 100, in 6 months = 0
  let scoreTiming = 50;
  if (input.desiredClosingAt) {
    const days = Math.max(0, (input.desiredClosingAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    scoreTiming = Math.round(clamp01(1 - days / 180) * 100);
  }

  // Risk flags
  let scoreRisk = 100;
  if (!input.idVerified) scoreRisk -= 25;
  if (!input.financingProofPresent) scoreRisk -= 25;
  if (input.amount < input.askingPrice * 0.80) scoreRisk -= 25;
  if (input.buyerProfileAgeDays < 1) scoreRisk -= 10;
  scoreRisk = Math.max(0, scoreRisk);

  // Composite: 30% amount + 30% finance + 20% timing + 20% risk
  const scoreComposite = Math.round(
    0.30 * scoreAmount +
    0.30 * scoreFinance +
    0.20 * scoreTiming +
    0.20 * scoreRisk
  );

  return {
    scoreAmount,
    scoreFinance,
    scoreTiming,
    scoreRisk,
    scoreComposite,
  };
}

export function getDeviationLabel(amount: number, askingPrice: number): { text: string; color: string } {
  const pct = ((amount - askingPrice) / askingPrice) * 100;
  if (pct >= 0) return { text: `+${pct.toFixed(1)}%`, color: "text-emerald-600" };
  if (pct >= -5) return { text: `${pct.toFixed(1)}%`, color: "text-amber-600" };
  return { text: `${pct.toFixed(1)}%`, color: "text-red-500" };
}
