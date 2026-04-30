// F-M5-03 audit: programmatic detector for "exactly one user-facing question per turn".
// Replaces the spec's "manual review of 50 conversations" acceptance step with a
// regression-style check that flags any agent turn containing more than one question.

// German interrogative stems — these often start a question even without a clear "?"
const INTERROGATIVE_STEMS = [
  /\bwie\s+(viel|hoch|alt|groß|lang|breit|tief|weit)\b/gi,
  /\bwas\s+(ist|sind|war|wäre|kostet)\b/gi,
  /\bwelche[snmr]?\b/gi,
  /\bwer\b/gi,
  /\bwo\s+(liegt|ist|befindet)\b/gi,
  /\bwann\b/gi,
  /\bwarum\b/gi,
  /\bwieso\b/gi,
  /\bweshalb\b/gi,
  /\bkönnen\s+sie\b/gi,
  /\bkönnten\s+sie\b/gi,
  /\bhaben\s+sie\b/gi,
  /\bhätten\s+sie\b/gi,
  /\bsind\s+sie\b/gi,
  /\bist\s+(es|das|die|der)\b/gi,
  /\bgibt\s+es\b/gi,
  /\bdarf\s+ich\s+fragen\b/gi,
];

export interface QuestionAuditResult {
  questionMarkCount: number;
  interrogativeStemMatches: string[];
  estimatedQuestionCount: number;
  hasMultipleQuestions: boolean;
}

// Audit a single agent turn for multi-question violations.
export function auditAgentTurn(content: string): QuestionAuditResult {
  if (!content || typeof content !== "string") {
    return { questionMarkCount: 0, interrogativeStemMatches: [], estimatedQuestionCount: 0, hasMultipleQuestions: false };
  }
  // Drop bracketed system markers like "[Annahme: ...]"
  const text = content.replace(/\[[^\]]*\]/g, " ").replace(/###[\s\S]*?###/g, " ");

  const questionMarks = (text.match(/\?/g) || []).length;
  const stemMatches: string[] = [];
  for (const re of INTERROGATIVE_STEMS) {
    const m = text.match(re);
    if (m) stemMatches.push(...m.map((s) => s.toLowerCase().trim()));
  }
  const uniqueStems = Array.from(new Set(stemMatches));

  // Heuristic: count distinct sentences ending with `?` plus standalone interrogative
  // sentences without a question mark. Cap to questionMarks*2 to avoid over-counting.
  const sentencesWithQ = text.split(/[?!.]/).filter((s) => /(?:wie|was|welche|wer|wo|wann|warum|können sie|haben sie)\b/i.test(s));
  const estimated = Math.max(questionMarks, Math.min(uniqueStems.length, sentencesWithQ.length));

  return {
    questionMarkCount: questionMarks,
    interrogativeStemMatches: uniqueStems,
    estimatedQuestionCount: estimated,
    hasMultipleQuestions: estimated > 1 || questionMarks > 1,
  };
}

export interface ConversationAuditEntry {
  turnId: string;
  conversationId: string;
  createdAt: string;
  content: string;
  audit: QuestionAuditResult;
}

// Aggregate results across many turns.
export function summarizeAudit(entries: ConversationAuditEntry[]) {
  const violators = entries.filter((e) => e.audit.hasMultipleQuestions);
  const violatorConvIds = new Set(violators.map((v) => v.conversationId));
  return {
    totalTurns: entries.length,
    totalConversations: new Set(entries.map((e) => e.conversationId)).size,
    multiQuestionTurns: violators.length,
    multiQuestionRatePct: entries.length === 0 ? 0 : Math.round((violators.length / entries.length) * 1000) / 10,
    affectedConversations: violatorConvIds.size,
    flagged: violators.slice(0, 200),
  };
}
