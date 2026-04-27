// Lead Quality Score (0-100) — PRD Section 10.4
// Deterministic, rule-based scoring

interface LeadInput {
  financingState: string | null;
  timing: string | null;
  budget: number | null;
  phone: string | null;
  message: string | null;
  askingPrice: number;
}

const RED_FLAGS = [
  "kein interesse",
  "abgesagt",
  "spam",
  "scam",
  "betrug",
  "no interest",
  "cancel",
  "nicht interessiert",
];

function hasRedFlags(message: string | null): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return RED_FLAGS.some((flag) => lower.includes(flag));
}

export function calculateLeadScore(input: LeadInput): number {
  let score = 0;

  // Financing (max 25 points)
  if (input.financingState === "CASH" || input.financingState === "PRE_APPROVED") {
    score += 25;
  } else if (input.financingState === "IN_PROCESS") {
    score += 15; // 25 * 0.6
  }

  // Timing (max 25 points)
  if (input.timing === "IMMEDIATELY" || input.timing === "WITHIN_3M") {
    score += 25;
  } else if (input.timing === "WITHIN_6M") {
    score += 15; // 25 * 0.6
  }

  // Budget match (15 points)
  if (input.budget != null && input.budget >= input.askingPrice * 0.85) {
    score += 15;
  }

  // Phone provided (10 points)
  if (input.phone) {
    score += 10;
  }

  // Base points for submitting an enquiry (25 points)
  score += 25;

  // Red flags (-20 points)
  if (hasRedFlags(input.message)) {
    score -= 20;
  }

  return Math.max(0, Math.min(100, score));
}

export function getScoreLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Heiß", color: "emerald" };
  if (score >= 50) return { label: "Warm", color: "amber" };
  return { label: "Kalt", color: "slate" };
}
