# Direkta Exposé Agent — Improvement Brief v1
**For**: Engineering / Claude Code
**Source spec**: `Direkta_Lastenheft_Pflichtenheft_v1_2.docx`, §10.5 Exposé Agent specification
**Goal**: Move the agent from "scripted form-filler with branches" to "goal-driven actor with a belief state", as required by §4.5 and §10.5.

---

## 1. The core gap

The current agent tracks `knownFields` / `missingFields` as flat lists. The spec calls for "a structured working memory of what is known, what is missing, and what has been confirmed by the seller" (§4.5). Every smart behavior below depends on a richer working-memory representation. Build this first; everything else gets easier.

---

## 2. Required changes (priority order)

### P0 — Foundation
| # | Change | Why |
|---|---|---|
| 1 | Replace `knownFields` with `WorkingMemory`: per-field `{ value, confidence, source, lastConfirmedTurn, conflictsWith? }` | Unlocks confidence flags, conflict detection, smart re-asking |
| 2 | Continuous NER-style extraction on **every** user turn (not only Bulk Mode) | Sellers drip info; re-asking already-stated facts is the #1 frustration signal |
| 3 | Question scorer: each missing field gets `(blocks_pricing, blocks_draft, blocks_publish, info_value)`; agent always asks highest-scoring missing field | Replaces fixed per-property-type sequence |

### P1 — Reasoning behaviors
| # | Change | Why |
|---|---|---|
| 4 | Multi-source conflict detection (user-stated vs. `energy.extract` vs. `photo.analyse`) — surface, don't overwrite | Trust |
| 5 | Photo grounding loop: `photo.analyse` results feed back into the question planner; visible attributes that aren't in WM become candidate prompts | Makes the agent feel like it *looked* |
| 6 | Plausibility rules as **soft** asks, not blocks: year-built vs. condition, energy-class vs. year, postcode vs. city, m²-per-room sanity | Catches errors before publish without slowing happy path |
| 7 | Targeted re-ask on `listing.review` failures (re-ask for the missing GEG field or photo, don't re-draft text) | Today's loop is too coarse |

### P2 — Adaptiveness
| # | Change | Why |
|---|---|---|
| 8 | Archetype detection (A/B/C/D from spec §3.1.1) from first 3 turns → injected into system prompt → tone/verbosity adapts | Spec already defines 4 archetypes; we don't use them |
| 9 | MFH "template + delta" entry mode for buildings >4 units | 12 units × 8 questions = unusable today |
| 10 | Smarter "weiß ich nicht" branching: lookup / infer-from-comparables / skip-with-confidence-flag | Single fallback today |
| 11 | Silent completeness checkpoints every ~8 turns; offer early draft when WM passes a threshold | Seller has no sense of progress |
| 12 | Cost-aware compression: when run cost > €1.40, agent skips optional questions and shortens its own messages | Cap exists but is binary |

---

## 3. Data structure to introduce

```typescript
type FieldSource = 'user' | 'ocr' | 'photo' | 'inferred' | 'default';

interface FieldBelief<T> {
  value: T | null;
  confidence: number;          // 0..1
  source: FieldSource;
  lastConfirmedTurn: number | null;
  conflictsWith?: Array<{ source: FieldSource; value: T; turn: number }>;
}

interface WorkingMemory {
  // Replaces the flat knownFields/missingFields
  livingArea:    FieldBelief<number>;
  rooms:         FieldBelief<number>;
  bathrooms:     FieldBelief<number>;
  yearBuilt:     FieldBelief<number>;
  condition:     FieldBelief<PropertyCondition>;
  energyClass:   FieldBelief<string>;
  energyValue:   FieldBelief<number>;
  attributes:    FieldBelief<string[]>;
  // ... etc per spec §4.1 / §10.1
  archetypeGuess: 'A' | 'B' | 'C' | 'D' | null;
  runCostCents:   number;
  turnCount:      number;
}
```

Add three pure functions:

- `extractFromUserTurn(text, currentWM): Partial<WorkingMemory>` — runs every turn, even outside Bulk Mode.
- `nextQuestion(wm): { field, prompt } | { action: 'draft' | 'review' | 'handoff' }` — replaces the per-property-type if/else ladder.
- `detectConflicts(wm): Conflict[]` — runs after every tool call.

---

## 4. Acceptance criteria (how we know it works)

These are testable via conversation replays. Add them to the agent test suite.

1. **No re-asks on already-stated facts.** If the seller's first message is "75qm 3-Zimmer Wohnung, 2. OG mit Balkon, Baujahr 2001, Hamburg", the agent's next question is **not** about area, rooms, floor, balcony, year, or city.
2. **Conflict surfaced.** If the seller says "Baujahr 1990" and the Energieausweis OCR returns 1987, the next agent message asks which is correct.
3. **Photo-grounded prompt.** If a photo is classified as containing a fireplace and `attributes` doesn't include "Kamin", the agent asks about it within 2 turns.
4. **MFH bulk mode.** For a 10-unit MFH, total turns to complete unit data ≤ 25 (currently ≥ 80).
5. **Confidence flag in handoff.** When `handoff.commit` runs, every field with `source !== 'user'` or `confidence < 0.7` appears on the Review screen marked "Bitte prüfen".
6. **Cost guardrail.** Run cost stays ≤ €2.00 in 95% of conversations; at €1.40 the agent shortens its own messages and stops asking optional questions.
7. **Targeted re-draft.** If `listing.review` fails *only* on missing GEG fields, the agent asks for those fields, not a full text re-draft.
8. **Plausibility soft-ask.** "Erstbezug" + "Baujahr 1962" triggers a confirmation question, not a block.

---

## 5. Out of scope for this iteration

- Voice input
- Real-time photo enhancement
- Multi-language (DE only, per spec)
- Replacing the LLM provider (the `TextGenerationProvider` interface from §10.1 stays as-is)
- IS24 portal logic (that's M6, separate agent)

---

# Prompt to paste into Claude Code

> **You are working on the Direkta Exposé Agent (M5).** The full product spec is `Direkta_Lastenheft_Pflichtenheft_v1_2.docx`, especially §4.5 and §10.5. The current agent's behavior is documented in the behavior map I'm including. The agent today works but is a scripted form-filler with branches; the spec calls for a goal-driven actor with a structured working memory. We need to close that gap.
>
> **Before writing any code**, do the following:
> 1. Read the spec sections §4.5 (M5 Exposé Agent) and §10.5 (Agent loop, tool surface, hard constraints).
> 2. Map the current code: locate the agent loop, the working-memory structure, the question-selection logic, the tool definitions (`address.validate`, `energy.extract`, `pricing.recommend`, `photo.analyse`, `listing.draft`, `listing.review`, `handoff.commit`), and the bulk-input parser. List the files and line ranges so I can confirm before you change anything.
> 3. Read the improvement brief I'm attaching (`expose_agent_improvement_brief.md`) end-to-end.
>
> **Then propose an implementation plan** with:
> - The new `WorkingMemory` / `FieldBelief` types (TypeScript) and where they replace existing structures.
> - How `extractFromUserTurn`, `nextQuestion`, and `detectConflicts` plug into the existing loop in §10.5.
> - Which P0 items can ship in the first PR and which need a follow-up.
> - A test plan covering the 8 acceptance criteria in §4 of the brief, written as conversation replay fixtures.
>
> **Hard constraints** (these are non-negotiable, from §10.5):
> - `MAX_TURNS = 60`, `MAX_COST_CENTS_PER_RUN = 200`.
> - The agent must not call any tool outside `TOOL_REGISTRY`.
> - Every `TOOL_CALL` and `USER_TURN` must be persisted before the next loop iteration (crash recovery).
> - All output German, formal Sie-form. No invented attributes — every field in the final draft must trace back to a `WorkingMemory` entry with `source !== 'inferred'` OR be explicitly confirmed by the seller.
>
> Do not change the public tool interfaces (`PortalDriver`, `TextGenerationProvider`) without flagging it. Do not touch M6 (Listing Agent) — that's a separate scope.
>
> Start by sharing the current-code map and your proposed plan. I'll approve before you write code.

---

*End of brief.*
