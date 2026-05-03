// Exposé Agent — implements the M5 contract from §10.5 of the Lastenheft.
// A tool-using, multi-turn agent with a bounded loop, registered tools,
// quality rubric self-review, AgentStep audit trail and cost cap.

import { prisma } from "./prisma";
import { calculatePricing } from "./pricing";
import type { Prisma } from "@prisma/client";

// Round-trip helper: Prisma's InputJsonValue is strict and rejects typed
// objects with index-signature mismatches even when they're valid JSON.
function asJson<T>(v: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(v ?? null)) as Prisma.InputJsonValue;
}

// ────────────────────────────────────────────────────────────────────────
// Hard constraints (Lastenheft §10.5)
// ────────────────────────────────────────────────────────────────────────

export const MAX_TURNS = 60;
export const MAX_COST_CENTS = 200;           // ≈ €2 per run
export const MAX_TOOL_ITERATIONS_PER_TURN = 6;
const MAX_ADDRESS_VALIDATION_ATTEMPTS = 3;

// Cost guard for mechanically-chained tool calls.
// Reused by all chained tools (address_validate, listing_review, future chains).
function canAffordChainedTool(costCentsTotal: number, estimatedCost: number): boolean {
  return costCentsTotal + estimatedCost <= MAX_COST_CENTS;
}

const ORCHESTRATOR_MODEL = process.env.EXPOSE_AGENT_MODEL || "openai/gpt-4o-mini";
const DRAFT_MODEL = process.env.EXPOSE_AGENT_DRAFT_MODEL || "openai/gpt-4o";

// Per-million-token USD rates used as a fallback if OpenRouter doesn't return usage.cost.
// Fallback only — primary cost source is the response's usage.cost field.
const TOKEN_RATES_USD: Record<string, { input: number; output: number }> = {
  "openai/gpt-4o-mini": { input: 0.15, output: 0.6 },
  "openai/gpt-4o": { input: 2.5, output: 10 },
};
function fallbackCostCents(model: string, promptTokens: number, completionTokens: number): number {
  const rate = TOKEN_RATES_USD[model] || TOKEN_RATES_USD["openai/gpt-4o-mini"];
  const usd = (promptTokens / 1_000_000) * rate.input + (completionTokens / 1_000_000) * rate.output;
  return Math.ceil(usd * 100);
}

// Marketing superlatives that breach typical Wettbewerbsrecht thresholds
const BANNED_SUPERLATIVES = [
  "einmalig",
  "konkurrenzlos",
  "atemberaubend",
  "traumhaft",
  "unschlagbar",
  "perfekt",
  "weltklasse",
  "sensationell",
];

// ────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────

export type PhotoRoomType =
  | "exterior"
  | "floorplan"
  | "living"
  | "kitchen"
  | "bathroom"
  | "bedroom"
  | "office"
  | "hallway"
  | "balcony"
  | "garden"
  | "garage"
  | "basement"
  | "other";

export interface PhotoClassification {
  roomType: PhotoRoomType;
  qualityFlags: string[];   // e.g. ["blur", "dark", "saturated"]
  qualityScore: number;     // 0–100
  rotation?: 0 | 90 | 180 | 270;
  features?: string[];      // e.g. ["modern_kitchen", "parquet_floor", "balcony_view"]
  suggestion?: string;      // improvement hint for the seller
}

export interface PhotoUpload {
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  kind: "PHOTO" | "FLOORPLAN" | "ENERGY_PDF";
  classification?: PhotoClassification;
  unitLabel?: string;
}

export interface PriceBand {
  low: number;
  median: number;
  high: number;
  strategyQuick: number;
  strategyReal: number;
  strategyMax: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  pricePerSqm: number;
}

export interface DraftResult {
  titleShort: string;
  descriptionLong: string;
  locationDescription?: string;
  buildingDescription?: string;
  highlights?: string[];
  exposeHeadline?: string;
  exposeSubheadline?: string;
}

export interface RubricResult {
  passed: boolean;
  failures: string[];
  details: {
    gegFields: { ok: boolean; reason?: string };
    wordCount: { ok: boolean; words?: number; paragraphs?: number };
    noHallucination: { ok: boolean; flagged?: string[] };
    noSuperlatives: { ok: boolean; found?: string[] };
    photos: { ok: boolean; count?: number };
    priceInBand: { ok: boolean; reason?: string };
  };
}

export interface UnitData {
  label: string;
  livingArea: number | null;
  rooms: number | null;
  bathrooms: number | null;
  floor: number | null;
  features: string[];
  askingPrice: number | null;
}

export interface WorkingMemory {
  phase: "greet" | "basics" | "details" | "energy" | "photos" | "draft" | "confirm";
  type: string | null;
  street: string | null;
  houseNumber: string | null;
  postcode: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  addressValidated: boolean;
  livingArea: number | null;
  plotArea: number | null;
  yearBuilt: number | null;
  rooms: number | null;
  bathrooms: number | null;
  floor: number | null;
  condition: string | null;
  attributes: string[];
  hasEnergyCert: boolean | null;
  energyCertType: string | null;
  energyClass: string | null;
  energyValue: number | null;
  energySource: string | null;
  energyValidUntil: string | null;
  uploads: PhotoUpload[];
  priceBand: PriceBand | null;
  askingPrice: number | null;
  priceOverride: boolean;
  draft: DraftResult | null;
  lastRubric: RubricResult | null;
  assumptions: string[];
  handoffReady: boolean;
  // Multi-unit support
  unitCount: number | null;
  units: UnitData[];
  sellingMode: "INDIVIDUAL" | "BUNDLE" | "BOTH" | null;
  hasFloorPlan: boolean;
  costCompressed: boolean;
  beliefs: Partial<BeliefStore>;
  currentUnit: string | null;
  addressValidationAttempts: number;
  // Expose enrichment
  sellerContact: { name?: string; company?: string; phone?: string; email?: string } | null;
  roomProgram: { name: string; area: number }[];
}

export type FieldSource = "user" | "ocr" | "photo" | "inferred" | "default";

export interface FieldBelief<T> {
  value: T | null;
  confidence: number;
  source: FieldSource;
  lastConfirmedTurn: number | null;
  conflictsWith?: Array<{ source: FieldSource; value: T; turn: number }>;
}

// BeliefStore tracks per-field confidence, source, and conflicts for
// SCALAR PROPERTY FACTS — fields that describe the physical property
// and can come from multiple sources (user, OCR, photo analysis).
//
// EXCLUDED from belief tracking (documented reasons):
// - uploads: media collection, not a property fact
// - units: nested per-unit structure, needs unit-level beliefs (PR2c)
// - sellingMode: operational decision by seller, not a discoverable fact
// - roomProgram: collection of room entries, not a scalar belief
// - sellerContact: contact info, not a property characteristic
// - currentUnit: ephemeral session state
// - priceBand, draft, lastRubric: pipeline outputs, not user inputs
// - askingPrice, priceOverride: pricing decisions, not property facts
// - costCompressed, handoffReady: system/derived state
export interface BeliefStore {
  type: FieldBelief<string>;
  street: FieldBelief<string>;
  houseNumber: FieldBelief<string>;
  postcode: FieldBelief<string>;
  city: FieldBelief<string>;
  livingArea: FieldBelief<number>;
  condition: FieldBelief<string>;
  rooms: FieldBelief<number>;
  yearBuilt: FieldBelief<number>;
  bathrooms: FieldBelief<number>;
  floor: FieldBelief<number>;
  plotArea: FieldBelief<number>;
  hasEnergyCert: FieldBelief<boolean>;
  energyCertType: FieldBelief<string>;
  energyClass: FieldBelief<string>;
  energyValue: FieldBelief<number>;
  energySource: FieldBelief<string>;
  energyValidUntil: FieldBelief<string>;
  attributes: FieldBelief<string[]>;
}

export type BeliefValueType<K extends keyof BeliefStore> =
  BeliefStore[K] extends FieldBelief<infer V> ? V : never;

// Defined in PR2a for testing; production reads switch to this in PR2b.
export function getValue<K extends keyof BeliefStore>(
  wm: WorkingMemory,
  field: K,
): BeliefValueType<K> | null {
  const belief = wm.beliefs?.[field];
  if (belief?.value !== undefined && belief.value !== null) {
    return belief.value as BeliefValueType<K>;
  }
  return (wm as unknown as Record<string, unknown>)[field as string] as BeliefValueType<K> | null;
}

export const INITIAL_MEMORY: WorkingMemory = {
  phase: "greet",
  type: null,
  street: null,
  houseNumber: null,
  postcode: null,
  city: null,
  lat: null,
  lng: null,
  addressValidated: false,
  livingArea: null,
  plotArea: null,
  yearBuilt: null,
  rooms: null,
  bathrooms: null,
  floor: null,
  condition: null,
  attributes: [],
  hasEnergyCert: null,
  energyCertType: null,
  energyClass: null,
  energyValue: null,
  energySource: null,
  energyValidUntil: null,
  uploads: [],
  priceBand: null,
  askingPrice: null,
  priceOverride: false,
  draft: null,
  lastRubric: null,
  assumptions: [],
  handoffReady: false,
  unitCount: null,
  units: [],
  sellingMode: null,
  hasFloorPlan: false,
  costCompressed: false,
  beliefs: {},
  currentUnit: null,
  addressValidationAttempts: 0,
  sellerContact: null,
  roomProgram: [],
};

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

export function getMissingFields(m: WorkingMemory): string[] {
  const missing: string[] = [];
  if (!m.type) missing.push("Immobilientyp");
  if (!m.street) missing.push("Straße");
  if (!m.houseNumber) missing.push("Hausnummer");
  if (!m.postcode) missing.push("PLZ");
  if (!m.city) missing.push("Stadt");
  if (!m.livingArea) missing.push("Wohnfläche");
  if (!m.condition) missing.push("Zustand");
  if (m.hasEnergyCert === null) missing.push("Energieausweis (ja/nein)");
  if (m.hasEnergyCert && !m.energyClass) missing.push("Energieklasse");
  if (m.hasEnergyCert && !m.energyValue) missing.push("Energieverbrauch");
  if (m.hasEnergyCert && !m.energySource) missing.push("Primärenergieträger");
  return missing;
}

export function isReadyForDraft(m: WorkingMemory): boolean {
  return !!(m.type && m.street && m.houseNumber && m.postcode && m.city && m.livingArea && m.condition);
}

export function isReadyForHandoff(m: WorkingMemory): boolean {
  return isReadyForDraft(m) && !!m.draft && !!m.lastRubric?.passed;
}

// ────────────────────────────────────────────────────────────────────────
// nextQuestion() — priority-driven question picker
// ────────────────────────────────────────────────────────────────────────

export interface QuestionResult {
  action: "ask" | "upload_photos" | "trigger_pricing" | "trigger_draft" | "wait_confirm";
  field?: string;
  prompt?: string;
  priority: number;
}

type ConversationalGroup = "identity" | "core" | "details" | "energy" | "media";

interface FieldSpec {
  field: string;
  group: ConversationalGroup;
  blocksPricing: boolean;
  blocksPublish: boolean;
  infoValue: number;
  optional: boolean;
  isFilled: (wm: WorkingMemory) => boolean;
  prompt: string;
}

// Group order is derived from the maximum priority of each group's fields.
// Groups whose members have higher max priority are asked first.
// This ensures blocksPublish/blocksPricing fields (energy, media) are
// not deferred behind nice-to-have details.
// Computed once at module load; result: identity(7) → core(7) → energy(2.9) → media(2.5) → details(0.9)
function computeGroupOrder(specs: FieldSpec[]): Record<ConversationalGroup, number> {
  const maxPri: Record<string, number> = {};
  for (const s of specs) {
    const p = (s.blocksPricing ? 4 : 0) + (s.blocksPublish ? 2 : 0) + s.infoValue;
    if (!maxPri[s.group] || p > maxPri[s.group]) maxPri[s.group] = p;
  }
  const groups = Object.entries(maxPri).sort((a, b) => b[1] - a[1]);
  const order: Record<string, number> = {};
  groups.forEach(([g], i) => { order[g] = i; });
  return order as Record<ConversationalGroup, number>;
}

const FIELD_PRIORITY: FieldSpec[] = [
  // ── identity: can't do anything without these ──
  { field: "type",        group: "identity", blocksPricing: true,  blocksPublish: true,  infoValue: 1,   optional: false, isFilled: wm => !!wm.type,        prompt: "Was für eine Immobilie möchten Sie verkaufen? (Wohnung, Haus, Mehrfamilienhaus, …)" },
  { field: "street",      group: "identity", blocksPricing: true,  blocksPublish: true,  infoValue: 1,   optional: false, isFilled: wm => !!wm.street,      prompt: "In welcher Straße liegt die Immobilie?" },
  { field: "houseNumber", group: "identity", blocksPricing: true,  blocksPublish: true,  infoValue: 1,   optional: false, isFilled: wm => !!wm.houseNumber, prompt: "Welche Hausnummer?" },
  { field: "postcode",    group: "identity", blocksPricing: true,  blocksPublish: true,  infoValue: 1,   optional: false, isFilled: wm => !!wm.postcode,    prompt: "Wie lautet die Postleitzahl?" },
  { field: "city",        group: "identity", blocksPricing: true,  blocksPublish: true,  infoValue: 1,   optional: false, isFilled: wm => !!wm.city,        prompt: "In welcher Stadt?" },
  // ── core: mandatory for pricing pipeline ──
  { field: "livingArea",  group: "core",     blocksPricing: true,  blocksPublish: true,  infoValue: 1,   optional: false, isFilled: wm => !!wm.livingArea,  prompt: "Wie groß ist die Wohnfläche in m²?" },
  { field: "condition",   group: "core",     blocksPricing: true,  blocksPublish: true,  infoValue: 0.8, optional: false, isFilled: wm => !!wm.condition,   prompt: "In welchem Zustand ist die Immobilie? (Gepflegt, Erstbezug, Renovierungsbedürftig, …)" },
  // ── details: improve listing quality, asked before energy/media ──
  { field: "rooms",       group: "details",  blocksPricing: false, blocksPublish: false, infoValue: 0.8, optional: true,  isFilled: wm => wm.rooms != null, prompt: "Wie viele Zimmer hat die Immobilie?" },
  { field: "yearBuilt",   group: "details",  blocksPricing: false, blocksPublish: false, infoValue: 0.7, optional: true,  isFilled: wm => wm.yearBuilt != null, prompt: "Wann wurde das Gebäude gebaut (Baujahr)?" },
  { field: "bathrooms",   group: "details",  blocksPricing: false, blocksPublish: false, infoValue: 0.5, optional: true,  isFilled: wm => wm.bathrooms != null, prompt: "Wie viele Badezimmer?" },
  { field: "floor",       group: "details",  blocksPricing: false, blocksPublish: false, infoValue: 0.4, optional: true,  isFilled: wm => wm.type === "EFH" || wm.type === "MFH" || wm.floor != null, prompt: "In welchem Stockwerk liegt die Wohnung?" },
  { field: "plotArea",    group: "details",  blocksPricing: false, blocksPublish: false, infoValue: 0.4, optional: true,  isFilled: wm => wm.type === "ETW" || wm.plotArea != null, prompt: "Wie groß ist das Grundstück in m²?" },
  { field: "attributes",  group: "details",  blocksPricing: false, blocksPublish: false, infoValue: 0.6, optional: true,  isFilled: wm => wm.attributes.length > 0, prompt: "Welche Ausstattung hat die Immobilie? (Balkon, Keller, Garten, Stellplatz, …)" },
  { field: "unitCount",   group: "details",  blocksPricing: false, blocksPublish: false, infoValue: 0.9, optional: false, isFilled: wm => wm.type !== "MFH" || wm.unitCount != null, prompt: "Wie viele Wohneinheiten hat das Gebäude?" },
  { field: "units",       group: "details",  blocksPricing: false, blocksPublish: false, infoValue: 0.9, optional: false, isFilled: wm => wm.type !== "MFH" || wm.units.length > 0, prompt: "Bitte beschreiben Sie die einzelnen Wohnungen (Größe, Zimmer, Stockwerk)." },
  { field: "sellingMode", group: "details",  blocksPricing: false, blocksPublish: false, infoValue: 0.8, optional: false, isFilled: wm => wm.type !== "MFH" || wm.sellingMode != null, prompt: "Wie möchten Sie verkaufen? Einzeln, als Paket, oder beides?" },
  // ── energy: GEG legally required ──
  { field: "hasEnergyCert", group: "energy", blocksPricing: false, blocksPublish: true,  infoValue: 0.9, optional: false, isFilled: wm => wm.hasEnergyCert !== null, prompt: "Haben Sie einen Energieausweis für die Immobilie?" },
  { field: "energyClass",  group: "energy", blocksPricing: false, blocksPublish: true,  infoValue: 0.5, optional: false, isFilled: wm => !wm.hasEnergyCert || !!wm.energyClass, prompt: "Welche Energieklasse steht im Ausweis?" },
  { field: "energyValue",  group: "energy", blocksPricing: false, blocksPublish: true,  infoValue: 0.5, optional: false, isFilled: wm => !wm.hasEnergyCert || wm.energyValue != null, prompt: "Wie hoch ist der Energieverbrauch in kWh/(m²·a)?" },
  { field: "energySource", group: "energy", blocksPricing: false, blocksPublish: true,  infoValue: 0.5, optional: false, isFilled: wm => !wm.hasEnergyCert || !!wm.energySource, prompt: "Was ist der wesentliche Energieträger? (Gas, Öl, Fernwärme, …)" },
  // ── media: uploads + enrichment, last group ──
  { field: "photos",        group: "media", blocksPricing: false, blocksPublish: true,  infoValue: 0.5, optional: false, isFilled: wm => wm.uploads.filter(u => u.kind === "PHOTO").length >= 6, prompt: "Bitte laden Sie mindestens 6 Fotos hoch. Nutzen Sie den 📷-Button links unten." },
  { field: "floorPlan",     group: "media", blocksPricing: false, blocksPublish: false, infoValue: 0.6, optional: true,  isFilled: wm => wm.hasFloorPlan || wm.uploads.some(u => u.kind === "FLOORPLAN"), prompt: "Haben Sie einen Grundriss? Nutzen Sie den 📐-Button." },
  { field: "roomProgram",   group: "media", blocksPricing: false, blocksPublish: false, infoValue: 0.3, optional: true,  isFilled: wm => wm.roomProgram.length > 0, prompt: "Möchten Sie die einzelnen Räume mit Größe angeben? Z.B. Wohnzimmer 25m², Küche 12m²" },
  { field: "sellerContact", group: "media", blocksPricing: false, blocksPublish: false, infoValue: 0.3, optional: true,  isFilled: wm => !!(wm.sellerContact?.name || wm.sellerContact?.company || wm.sellerContact?.phone || wm.sellerContact?.email), prompt: "Welche Kontaktdaten sollen im Exposé stehen? (Name, Telefon, E-Mail)" },
];

const GROUP_ORDER = computeGroupOrder(FIELD_PRIORITY);

export function nextQuestion(wm: WorkingMemory): QuestionResult {
  const photoCount = wm.uploads.filter(u => u.kind === "PHOTO").length;
  const ready = isReadyForDraft(wm);

  if (ready && photoCount >= 6 && !wm.priceBand) return { action: "trigger_pricing", priority: 100 };
  if (wm.priceBand && !wm.draft) return { action: "trigger_draft", priority: 100 };
  if (wm.draft && wm.lastRubric?.passed) return { action: "wait_confirm", priority: 100 };

  const candidates: { field: string; group: ConversationalGroup; prompt: string; priority: number; tiebreaker: number }[] = [];
  for (let i = 0; i < FIELD_PRIORITY.length; i++) {
    const spec = FIELD_PRIORITY[i];
    if (spec.isFilled(wm)) continue;
    if (wm.costCompressed && spec.optional) continue;
    const priority = (spec.blocksPricing ? 4 : 0) + (spec.blocksPublish ? 2 : 0) + spec.infoValue;
    candidates.push({ field: spec.field, group: spec.group, prompt: spec.prompt, priority, tiebreaker: i });
  }
  if (candidates.length === 0) return { action: "trigger_pricing", priority: 0 };

  // Sort: group order first (derived from max member priority — groups
  // with higher-priority fields are completed first), then priority
  // descending within group, then tiebreaker for ties.
  candidates.sort((a, b) =>
    GROUP_ORDER[a.group] - GROUP_ORDER[b.group] ||
    b.priority - a.priority ||
    a.tiebreaker - b.tiebreaker
  );

  const best = candidates[0];
  return { action: best.field === "photos" ? "upload_photos" : "ask", field: best.field, prompt: best.prompt, priority: best.priority };
}

// ────────────────────────────────────────────────────────────────────────
// completenessScore() — weighted progress percentage
// ────────────────────────────────────────────────────────────────────────

export function completenessScore(wm: WorkingMemory): number {
  const weights: [boolean, number][] = [
    [!!wm.type, 8],
    [!!(wm.street && wm.houseNumber && wm.postcode && wm.city), 12],
    [!!wm.livingArea, 8],
    [wm.rooms != null, 4],
    [wm.bathrooms != null, 2],
    [wm.yearBuilt != null, 4],
    [!!wm.condition, 6],
    [wm.hasEnergyCert !== null && (wm.hasEnergyCert === false || !!(wm.energyClass && wm.energyValue && wm.energySource)), 10],
    [wm.uploads.filter(u => u.kind === "PHOTO").length >= 6, 20],
    [wm.uploads.some(u => u.kind === "FLOORPLAN") || wm.hasFloorPlan, 6],
    [!!wm.priceBand, 10],
    [!!wm.draft, 10],
  ];
  const photoCount = wm.uploads.filter(u => u.kind === "PHOTO").length;
  const photoPartial = Math.min(photoCount / 6, 1) * 20;
  let score = 0;
  for (const [filled, weight] of weights) {
    if (weight === 20) { score += photoPartial; continue; } // photos: partial credit
    if (filled) score += weight;
  }
  return Math.round(score);
}

const PROPERTY_TYPE_DE: Record<string, string> = {
  ETW: "Eigentumswohnung",
  EFH: "Einfamilienhaus",
  MFH: "Mehrfamilienhaus",
  DHH: "Doppelhaushälfte",
  RH: "Reihenhaus",
  GRUNDSTUECK: "Grundstück",
};

const CONDITION_DE: Record<string, string> = {
  ERSTBEZUG: "Erstbezug",
  NEUBAU: "Neubau",
  GEPFLEGT: "Gepflegt",
  RENOVIERUNGS_BEDUERFTIG: "Renovierungsbedürftig",
  SANIERUNGS_BEDUERFTIG: "Sanierungsbedürftig",
  ROHBAU: "Rohbau",
};

function summarizeProperty(m: WorkingMemory): string {
  const lines = [
    `Typ: ${PROPERTY_TYPE_DE[m.type || ""] || m.type || "?"}`,
    `Adresse: ${m.street || "?"} ${m.houseNumber || "?"}, ${m.postcode || "?"} ${m.city || "?"}`,
    `Wohnfläche: ${m.livingArea ?? "?"} m²`,
  ];
  if (m.plotArea) lines.push(`Grundstück: ${m.plotArea} m²`);
  if (m.rooms) lines.push(`Zimmer: ${m.rooms}`);
  if (m.bathrooms) lines.push(`Badezimmer: ${m.bathrooms}`);
  if (m.yearBuilt) lines.push(`Baujahr: ${m.yearBuilt}`);
  if (m.floor != null) lines.push(`Etage: ${m.floor}`);
  if (m.condition) lines.push(`Zustand: ${CONDITION_DE[m.condition] || m.condition}`);
  if (m.attributes.length) lines.push(`Ausstattung: ${m.attributes.join(", ")}`);
  if (m.energyClass) lines.push(`Energieklasse: ${m.energyClass} (${m.energyValue} kWh, ${m.energySource})`);
  return lines.join("\n");
}

// ────────────────────────────────────────────────────────────────────────
// LLM call wrapper with cost tracking
// ────────────────────────────────────────────────────────────────────────

interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  costCents: number;
}

interface LlmCallResult {
  message: {
    role: "assistant";
    content: string | null;
    tool_calls?: Array<{
      id: string;
      type: "function";
      function: { name: string; arguments: string };
    }>;
  };
  usage: LlmUsage;
  finishReason: string;
}

interface LlmCallOptions {
  model?: string;
  messages: Array<Record<string, unknown>>;
  tools?: Array<Record<string, unknown>>;
  toolChoice?: "auto" | "none" | { type: "function"; function: { name: string } };
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: "json_object" };
}

async function callLlm(opts: LlmCallOptions): Promise<LlmCallResult> {
  // Mocked mode (F-M5-01): allows measuring "P95 < 5 s mocked" without real LLM
  // calls. Returns a canned response with a small controlled delay so latency
  // accounting stays meaningful in tests.
  if (process.env.EXPOSE_AGENT_MOCK === "1") {
    const delayMs = Number(process.env.EXPOSE_AGENT_MOCK_DELAY_MS || "120");
    await new Promise((r) => setTimeout(r, delayMs));
    const lastUser = [...opts.messages].reverse().find((m) => m.role === "user");
    const lastUserText = typeof lastUser?.content === "string" ? lastUser.content : "";
    return {
      message: {
        role: "assistant",
        content: opts.responseFormat?.type === "json_object"
          ? JSON.stringify({ titleShort: "Mock", descriptionLong: "Mock " .repeat(80).trim() })
          : `Mock-Antwort. Sie sagten: ${String(lastUserText).slice(0, 60)}`,
      },
      finishReason: "stop",
      usage: { promptTokens: 0, completionTokens: 0, costCents: 0 },
    };
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY nicht konfiguriert");

  const body: Record<string, unknown> = {
    model: opts.model || ORCHESTRATOR_MODEL,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.maxTokens ?? 1200,
    usage: { include: true },
  };
  if (opts.tools) body.tools = opts.tools;
  if (opts.toolChoice) body.tool_choice = opts.toolChoice;
  if (opts.responseFormat) body.response_format = opts.responseFormat;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://direkta.de",
      "X-Title": "Direkta Exposé Agent",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`KI-Fehler (${res.status}): ${err.substring(0, 200)}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  if (!choice) throw new Error("Keine Antwort vom LLM");

  const usage = data.usage || {};
  const promptTokens = usage.prompt_tokens || 0;
  const completionTokens = usage.completion_tokens || 0;
  const reportedCostCents = typeof usage.cost === "number" ? Math.ceil(usage.cost * 100) : 0;
  const fallback = fallbackCostCents(body.model as string, promptTokens, completionTokens);
  // Use whichever is greater to be conservative — never under-bill against the cap
  const costCents = Math.max(reportedCostCents, fallback);

  return {
    message: choice.message,
    finishReason: choice.finish_reason || "stop",
    usage: { promptTokens, completionTokens, costCents },
  };
}

// ────────────────────────────────────────────────────────────────────────
// Tool registry
// ────────────────────────────────────────────────────────────────────────

export type ToolName =
  | "address_validate"
  | "energy_extract"
  | "pricing_recommend"
  | "photo_analyse"
  | "listing_draft"
  | "listing_review"
  | "handoff_commit";

export const TOOL_REGISTRY: Record<ToolName, { description: string; parameters: object }> = {
  address_validate: {
    description: "Validiert eine deutsche Adresse und gibt Geokoordinaten zurück. Aufrufen, sobald Straße, Hausnummer, PLZ und Stadt bekannt sind.",
    parameters: {
      type: "object",
      properties: {
        street: { type: "string" },
        houseNumber: { type: "string" },
        postcode: { type: "string" },
        city: { type: "string" },
      },
      required: ["street", "houseNumber", "postcode", "city"],
    },
  },
  energy_extract: {
    description: "Extrahiert strukturierte Felder aus dem Text eines Energieausweis-PDFs (das bereits hochgeladen wurde). Aufrufen, wenn ein Upload mit kind=ENERGY_PDF im System-Event sichtbar ist.",
    parameters: {
      type: "object",
      properties: {
        rawText: { type: "string", description: "Roh extrahierter Text aus dem PDF" },
      },
      required: ["rawText"],
    },
  },
  pricing_recommend: {
    description: "Berechnet Preisband + Vergleichsobjekte für die aktuelle Immobilie. Aufrufen, sobald alle Pflichtfelder gesetzt sind, vor listing_draft.",
    parameters: { type: "object", properties: {} },
  },
  photo_analyse: {
    description: "Klassifiziert ein hochgeladenes Foto nach Raumtyp und prüft Qualität. Wird automatisch bei jedem Foto-Upload aufgerufen — der Agent muss es selten manuell aufrufen.",
    parameters: {
      type: "object",
      properties: {
        photoIndex: { type: "number", description: "Index des Fotos in WorkingMemory.uploads" },
      },
      required: ["photoIndex"],
    },
  },
  listing_draft: {
    description: "Erstellt Lang- und Kurzbeschreibung aus Working Memory. Aufrufen erst NACHDEM pricing_recommend ausgeführt wurde.",
    parameters: { type: "object", properties: {} },
  },
  listing_review: {
    description: "Prüft den letzten Entwurf gegen die Quality Rubric (6 Kriterien). Gibt pass/fail je Kriterium zurück. Aufrufen direkt nach listing_draft.",
    parameters: { type: "object", properties: {} },
  },
  handoff_commit: {
    description: "Übergibt fertigen Exposé-Entwurf an die Publish-Pipeline. Nur aufrufen, wenn listing_review pass=true zurückgegeben hat UND der Verkäufer bestätigt hat.",
    parameters: { type: "object", properties: {} },
  },
};

export function getToolsSpec() {
  return Object.entries(TOOL_REGISTRY).map(([name, spec]) => ({
    type: "function",
    function: { name, description: spec.description, parameters: spec.parameters },
  }));
}

// ────────────────────────────────────────────────────────────────────────
// Tool implementations
// ────────────────────────────────────────────────────────────────────────

async function loadPhotoBytes(storageKey: string): Promise<{ bytes: Buffer; mimeType: string } | null> {
  try {
    if (storageKey.startsWith("/uploads/")) {
      const { readFile } = await import("fs/promises");
      const path = await import("path");
      const local = path.join(process.cwd(), "public", storageKey.replace(/^\/+/, ""));
      const buf = await readFile(local);
      const ext = (local.split(".").pop() || "jpg").toLowerCase();
      const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      return { bytes: buf, mimeType };
    }
    // S3 / external URL
    const { getFromS3 } = await import("./s3");
    const key = storageKey.replace(/^https?:\/\/[^/]+\//, "").replace(/^\/+/, "");
    const obj = await getFromS3(key);
    if (!obj) return null;
    const reader = obj.body.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const merged = Buffer.alloc(total);
    let off = 0;
    for (const c of chunks) { merged.set(c, off); off += c.length; }
    return { bytes: merged, mimeType: obj.contentType || "image/jpeg" };
  } catch {
    return null;
  }
}

const PHOTO_ROOM_TYPES: PhotoRoomType[] = [
  "exterior", "floorplan", "living", "kitchen", "bathroom", "bedroom",
  "office", "hallway", "balcony", "garden", "garage", "basement", "other",
];

async function tool_photoAnalyse(memory: WorkingMemory, photoIndex: number): Promise<{ ok: boolean; classification?: PhotoClassification; error?: string; costCents: number; index: number }> {
  if (photoIndex < 0 || photoIndex >= memory.uploads.length) {
    return { ok: false, error: "Foto-Index außerhalb des Bereichs", costCents: 0, index: photoIndex };
  }
  const upload = memory.uploads[photoIndex];
  const loaded = await loadPhotoBytes(upload.storageKey);
  if (!loaded) {
    return { ok: false, error: "Foto konnte nicht geladen werden", costCents: 0, index: photoIndex };
  }
  // Cap to ~2MB to avoid bloated prompts
  const data = loaded.bytes.length > 2 * 1024 * 1024
    ? loaded.bytes.subarray(0, 2 * 1024 * 1024)
    : loaded.bytes;
  const dataUrl = `data:${loaded.mimeType};base64,${Buffer.from(data).toString("base64")}`;

  const sysPrompt = `Du bist ein Experte für Immobilienfotografie und analysierst Fotos für deutsche Immobilieninserate. Antworte als JSON, ohne Markdown:
{
  "roomType": einer aus [${PHOTO_ROOM_TYPES.join(", ")}],
  "qualityFlags": Array aus möglichen Mängeln — nur die zutreffenden angeben:
    blur (unscharf/verwackelt), dark (zu dunkel), overexposed (überbelichtet),
    saturated (übersättigt), oversharp (überschärft), tilted (schief/gekippt),
    cluttered (unaufgeräumt/persönliche Gegenstände sichtbar), watermark (Wasserzeichen),
    low_resolution (geringe Auflösung), noisy (Bildrauschen), reflection (störende Spiegelung),
    finger (Finger/Hand im Bild), poor_composition (schlechter Bildausschnitt),
  "qualityScore": 0-100 (Bewertung für Immobilieninserat: Belichtung, Schärfe, Komposition, Aufgeräumtheit),
  "features": Array erkannter Merkmale z.B. ["einbaukueche", "parkettboden", "balkon", "dachschraege", "kamin", "fussbodenheizung", "garten", "terrasse", "garage", "aufzug", "neubau", "altbau"],
  "suggestion": kurzer Verbesserungshinweis für den Verkäufer (nur wenn qualityScore < 70, sonst null)
}
Regeln:
- "floorplan" NUR wenn das Bild ein technischer Grundriss/Bauplan ist.
- "exterior" für Außenansichten des Gebäudes, Fassade, Eingang.
- "features" soll sichtbare Ausstattungsmerkmale der Immobilie auflisten — nur was im Foto erkennbar ist.
- "suggestion" soll kurz und hilfreich sein, z.B. "Bitte bei Tageslicht erneut fotografieren" oder "Persönliche Gegenstände entfernen".
- Bewerte streng: Professionelle Immobilienfotos erhalten 80+, gute Smartphone-Fotos 60-80, problematische Fotos unter 60.`;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return { ok: false, error: "OPENROUTER_API_KEY fehlt", costCents: 0, index: photoIndex };

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://direkta.de",
      "X-Title": "Direkta Photo Analyser",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o",
      messages: [
        { role: "system", content: sysPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Klassifiziere dieses Foto." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 400,
      temperature: 0,
      usage: { include: true },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    return { ok: false, error: `Vision-API ${res.status}: ${errText.slice(0, 120)}`, costCents: 0, index: photoIndex };
  }
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  const usage = json.usage || {};
  const reportedCost = typeof usage.cost === "number" ? Math.ceil(usage.cost * 100) : 0;
  const fallback = fallbackCostCents("openai/gpt-4o", usage.prompt_tokens || 0, usage.completion_tokens || 0);
  const costCents = Math.max(reportedCost, fallback);

  if (!content) return { ok: false, error: "Keine Antwort", costCents, index: photoIndex };
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    return { ok: false, error: "Antwort nicht parsebar", costCents, index: photoIndex };
  }
  const roomType = (typeof parsed.roomType === "string" && (PHOTO_ROOM_TYPES as string[]).includes(parsed.roomType))
    ? (parsed.roomType as PhotoRoomType)
    : "other";
  const qualityFlags = Array.isArray(parsed.qualityFlags) ? parsed.qualityFlags.map(String) : [];
  const qualityScore = typeof parsed.qualityScore === "number" ? Math.max(0, Math.min(100, parsed.qualityScore)) : 50;
  const features = Array.isArray(parsed.features) ? parsed.features.map(String) : [];
  const suggestion = typeof parsed.suggestion === "string" ? parsed.suggestion : undefined;

  return {
    ok: true,
    classification: { roomType, qualityFlags, qualityScore, features, suggestion },
    costCents,
    index: photoIndex,
  };
}

async function tool_addressValidate(args: { street: string; houseNumber: string; postcode: string; city: string }) {
  const queries = [
    `${args.street} ${args.houseNumber}, ${args.postcode} ${args.city}, Deutschland`,
    `${args.street} ${args.houseNumber}, ${args.city}, Deutschland`,
    `${args.postcode} ${args.city}, Deutschland`,
  ];

  for (const raw of queries) {
    try {
      const q = encodeURIComponent(raw);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=de`, {
        headers: { "User-Agent": "Direkta-ExposeAgent/1.0 (contact@direkta.de)" },
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const hit = data[0];
        return {
          ok: true,
          lat: parseFloat(hit.lat),
          lng: parseFloat(hit.lon),
          displayName: hit.display_name,
        };
      }
    } catch {
      continue;
    }
  }

  // All queries failed — accept address without coordinates so the agent moves on
  return {
    ok: true,
    lat: 0,
    lng: 0,
    displayName: `${args.street} ${args.houseNumber}, ${args.postcode} ${args.city}`,
    note: "Adresse konnte nicht geocodiert werden, wurde aber übernommen",
  };
}

const ENERGY_EXTRACT_SYS_PROMPT = `Du bist ein Datenextraktor für deutsche Energieausweise.
Extrahiere die folgenden Felder strikt als JSON, ohne Markdown:
- type: "VERBRAUCH" oder "BEDARF"
- energyClass: A+, A, B, C, D, E, F, G, H
- energyValue: Zahl in kWh/(m²·a)
- primarySource: z. B. "Erdgas", "Heizöl", "Fernwärme", "Strom", "Wärmepumpe", "Pellets"
- validUntil: ISO-Datum (YYYY-MM-DD)
Antworte NUR mit gültigem JSON. Wenn ein Feld nicht eindeutig erkennbar ist, setze null.`;

async function tool_energyExtract(input: { rawText?: string; pdfBytes?: Buffer }) {
  // Path 1 — text-based PDFs: send extracted text to a cheap text model.
  if (input.rawText && input.rawText.trim().length > 80) {
    const result = await callLlm({
      model: ORCHESTRATOR_MODEL,
      messages: [
        { role: "system", content: ENERGY_EXTRACT_SYS_PROMPT },
        { role: "user", content: input.rawText.slice(0, 6000) },
      ],
      responseFormat: { type: "json_object" },
      maxTokens: 400,
      temperature: 0,
    });
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(result.message.content || "{}"); }
    catch { return { ok: false, error: "Konnte Energieausweis nicht parsen", costCents: result.usage.costCents }; }
    return {
      ok: true,
      mode: "text" as const,
      type: typeof parsed.type === "string" ? parsed.type : null,
      energyClass: typeof parsed.energyClass === "string" ? parsed.energyClass : null,
      energyValue: typeof parsed.energyValue === "number" ? parsed.energyValue : null,
      primarySource: typeof parsed.primarySource === "string" ? parsed.primarySource : null,
      validUntil: typeof parsed.validUntil === "string" ? parsed.validUntil : null,
      costCents: result.usage.costCents,
    };
  }

  // Path 2 — image-based PDFs (most real-world Energieausweise) and direct
  // images: render first 2 pages of PDFs via pdf-parse → gpt-4o vision; for
  // direct image uploads, send the image straight to vision.
  if (input.pdfBytes && input.pdfBytes.length > 0) {
    try {
      const isPdf = input.pdfBytes.length > 4 &&
        input.pdfBytes[0] === 0x25 && input.pdfBytes[1] === 0x50 &&
        input.pdfBytes[2] === 0x44 && input.pdfBytes[3] === 0x46; // "%PDF"

      let imageContent: Array<{ type: "image_url"; image_url: { url: string } }> = [];

      if (isPdf) {
        const mod = await import("pdf-parse");
        const PDFParse = mod.PDFParse;
        const parser = new PDFParse({ data: new Uint8Array(input.pdfBytes) });
        const screenshots = await parser.getScreenshot({
          first: 2,
          scale: 1.6,
          imageBuffer: true,
        } as Record<string, unknown>);
        await parser.destroy();
        const pages = (screenshots.pages || []).slice(0, 2);
        imageContent = pages
          .filter((p) => p.data && p.data.length > 0)
          .map((p) => ({
            type: "image_url" as const,
            image_url: { url: `data:image/png;base64,${Buffer.from(p.data!).toString("base64")}` },
          }));
        if (imageContent.length === 0) {
          return { ok: false, error: "Konnte PDF-Seiten nicht rendern", costCents: 0 };
        }
      } else {
        // Direct image upload (JPEG/PNG of an Energieausweis photographed by the seller)
        // Sniff JPEG vs PNG for the data URL prefix
        const isPng = input.pdfBytes.length > 8 && input.pdfBytes[0] === 0x89 && input.pdfBytes[1] === 0x50;
        const mime = isPng ? "image/png" : "image/jpeg";
        imageContent = [{
          type: "image_url",
          image_url: { url: `data:${mime};base64,${input.pdfBytes.toString("base64")}` },
        }];
      }

      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) return { ok: false, error: "OPENROUTER_API_KEY fehlt", costCents: 0 };

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://direkta.de",
          "X-Title": "Direkta Energy Extractor (Vision)",
        },
        body: JSON.stringify({
          model: "openai/gpt-4o",
          messages: [
            { role: "system", content: ENERGY_EXTRACT_SYS_PROMPT },
            {
              role: "user",
              content: [
                { type: "text", text: "Lies die Energieausweis-Felder aus diesem PDF (gerendert als Bild)." },
                ...imageContent,
              ],
            },
          ],
          response_format: { type: "json_object" },
          max_tokens: 400,
          temperature: 0,
          usage: { include: true },
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        return { ok: false, error: `Vision-API ${res.status}: ${errText.slice(0, 120)}`, costCents: 0 };
      }
      const json = await res.json();
      const usage = json.usage || {};
      const reportedCost = typeof usage.cost === "number" ? Math.ceil(usage.cost * 100) : 0;
      const fallback = fallbackCostCents("openai/gpt-4o", usage.prompt_tokens || 0, usage.completion_tokens || 0);
      const costCents = Math.max(reportedCost, fallback);
      const content = json.choices?.[0]?.message?.content || "{}";

      let parsed: Record<string, unknown> = {};
      try { parsed = JSON.parse(content); }
      catch { return { ok: false, error: "Vision-Antwort nicht parsebar", costCents }; }
      return {
        ok: true,
        mode: "vision" as const,
        type: typeof parsed.type === "string" ? parsed.type : null,
        energyClass: typeof parsed.energyClass === "string" ? parsed.energyClass : null,
        energyValue: typeof parsed.energyValue === "number" ? parsed.energyValue : null,
        primarySource: typeof parsed.primarySource === "string" ? parsed.primarySource : null,
        validUntil: typeof parsed.validUntil === "string" ? parsed.validUntil : null,
        costCents,
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Vision-Pfad fehlgeschlagen", costCents: 0 };
    }
  }

  return { ok: false, error: "Weder rawText noch pdfBytes vorhanden", costCents: 0 };
}

function tool_pricingRecommend(m: WorkingMemory) {
  if (!isReadyForDraft(m)) {
    const missing = getMissingFields(m);
    return { ok: false, error: `Pflichtfelder fehlen: ${missing.join(", ")}. Bitte diese Felder zuerst beim Verkäufer erfragen.` };
  }
  const result = calculatePricing({
    type: m.type!,
    city: m.city!,
    postcode: m.postcode!,
    livingArea: m.livingArea!,
    plotArea: m.plotArea,
    yearBuilt: m.yearBuilt,
    rooms: m.rooms,
    bathrooms: m.bathrooms,
    floor: m.floor,
    condition: m.condition!,
    attributes: m.attributes.length > 0 ? m.attributes : null,
    energyCert: m.energyClass ? { energyClass: m.energyClass, energyValue: m.energyValue || 0 } : null,
  });
  const band: PriceBand = {
    low: result.low,
    median: result.median,
    high: result.high,
    strategyQuick: result.strategyQuick,
    strategyReal: result.strategyReal,
    strategyMax: result.strategyMax,
    confidence: result.confidence,
    pricePerSqm: result.pricePerSqm,
  };
  return { ok: true, band };
}

// Split into two calls: description gets dedicated token budget (300-500 words),
// metadata fields use the description as context for consistency.
// Industry standard: 300–500 words (bodenrichtwerte-deutschland.de, 2026).
// Single-call approach produced 170 ± 14 words because token budget was split 7 ways.

const DRAFT_DESCRIPTION_PROMPT = `Du bist ein professioneller Immobilientexter für den deutschen Markt.
Erstelle eine Exposé-Beschreibung in Sie-Form.

Antwort als JSON: { "descriptionLong": string }

descriptionLong: MINDESTENS 300 Wörter, maximal 500 Wörter, GENAU 3 Absätze getrennt durch \\n\\n
  Absatz 1 (~120 Wörter): Die Immobilie — Typ, Lage, Größe, Zimmer, Bäder, Zustand, besondere Ausstattung, Renovierungen. Beschreibe die Raumaufteilung und den Schnitt detailliert.
  Absatz 2 (~100 Wörter): Die Umgebung — Stadt, Stadtteil, Infrastruktur, Nahversorgung, Schulen, ÖPNV, Natur, Freizeitangebote. Allgemein aber plausibel basierend auf PLZ/Stadt.
  Absatz 3 (~100 Wörter): Die Gelegenheit — Zielgruppe, Preis-Leistung, Investitionspotenzial, Energie-Hinweis mit konkreten Werten.
  WICHTIG: Jeder Absatz muss MINDESTENS 80 Wörter haben. Schreibe ausführlich und detailliert.

REGELN:
- KEINE erfundenen Merkmale — beschreibe NUR, was in den Daten steht
- KEINE Ausrufezeichen
- KEINE Superlative: "einmalig", "konkurrenzlos", "atemberaubend", "traumhaft", "perfekt"
- Beende den 3. Absatz mit dem Standard-Energieausweis-Hinweis (falls Energiedaten vorhanden)
- NEGIERE NIEMALS bestätigte Daten ("Wohnfläche nicht spezifiziert" wenn Wohnfläche vorhanden ist)`;

const DRAFT_METADATA_PROMPT = `Du bist ein professioneller Immobilientexter für den deutschen Markt.
Basierend auf den Immobiliendaten UND der bereits erstellten Beschreibung, erstelle die ergänzenden Exposé-Felder.

Antwort als JSON:
{
  "titleShort": string,
  "locationDescription": string,
  "buildingDescription": string,
  "highlights": string[],
  "exposeHeadline": string,
  "exposeSubheadline": string
}

FELDER:
- titleShort: max 160 Zeichen. Enthält Typ, Zimmer, Wohnfläche, Stadt.
- locationDescription: 80–150 Wörter. Mikrolage + Erreichbarkeit. Basiert auf PLZ/Stadt.
- buildingDescription: 60–120 Wörter. Gebäudetyp, Baujahr, Zustand, Energiestandard.
- highlights: 4–6 kurze Stichpunkte (je max 60 Zeichen). Verkaufsargumente aus den Daten.
- exposeHeadline: 3–8 Wörter, poetisch. Für die Titelseite des Exposé-PDFs.
- exposeSubheadline: 5–15 Wörter. Ergänzender Untertitel.

REGELN:
- KEINE erfundenen Merkmale
- KEINE Ausrufezeichen
- KEINE Superlative`;

async function tool_listingDraft(m: WorkingMemory) {
  const ctx = summarizeProperty(m);
  let totalCost = 0;

  // Call 1: Description only — dedicated token budget for 300-500 words
  const descResult = await callLlm({
    model: DRAFT_MODEL,
    messages: [
      { role: "system", content: DRAFT_DESCRIPTION_PROMPT },
      { role: "user", content: `Erstelle die Exposé-Beschreibung für:\n${ctx}` },
    ],
    responseFormat: { type: "json_object" },
    temperature: 0.6,
    maxTokens: 2000,
  });
  totalCost += descResult.usage.costCents;

  let descParsed: Record<string, unknown> = {};
  try {
    descParsed = JSON.parse(descResult.message.content || "{}");
  } catch {
    return { ok: false, error: "Beschreibung konnte nicht geparst werden", costCents: totalCost };
  }
  if (typeof descParsed.descriptionLong !== "string") {
    return { ok: false, error: "Beschreibung fehlt im Entwurf", costCents: totalCost };
  }
  const descriptionLong = descParsed.descriptionLong as string;

  // Call 2: Metadata fields — uses description as context for consistency
  const metaResult = await callLlm({
    model: DRAFT_MODEL,
    messages: [
      { role: "system", content: DRAFT_METADATA_PROMPT },
      { role: "user", content: `Immobiliendaten:\n${ctx}\n\nBereits erstellte Beschreibung:\n${descriptionLong}` },
    ],
    responseFormat: { type: "json_object" },
    temperature: 0.5,
    maxTokens: 1200,
  });
  totalCost += metaResult.usage.costCents;

  let metaParsed: Record<string, unknown> = {};
  try {
    metaParsed = JSON.parse(metaResult.message.content || "{}");
  } catch {
    // Metadata parse failure is non-fatal — we have the description
    metaParsed = {};
  }

  let titleShort = typeof metaParsed.titleShort === "string" ? metaParsed.titleShort : `${m.type}, ${m.rooms || "?"} Zimmer, ${m.livingArea || "?"} m², ${m.city}`;
  if (titleShort.length > 160) titleShort = titleShort.slice(0, 157) + "...";

  const draft: DraftResult = {
    descriptionLong,
    titleShort,
    locationDescription: typeof metaParsed.locationDescription === "string" ? metaParsed.locationDescription : undefined,
    buildingDescription: typeof metaParsed.buildingDescription === "string" ? metaParsed.buildingDescription : undefined,
    highlights: Array.isArray(metaParsed.highlights) ? (metaParsed.highlights as string[]) : undefined,
    exposeHeadline: typeof metaParsed.exposeHeadline === "string" ? metaParsed.exposeHeadline : undefined,
    exposeSubheadline: typeof metaParsed.exposeSubheadline === "string" ? metaParsed.exposeSubheadline : undefined,
  };
  return { ok: true, draft, costCents: totalCost };
}

// ────────────────────────────────────────────────────────────────────────
// Quality rubric (Lastenheft §4.5)
// ────────────────────────────────────────────────────────────────────────

async function checkHallucination(draft: DraftResult, m: WorkingMemory): Promise<{ ok: boolean; flagged: string[]; costCents: number }> {
  const sysPrompt = `Du bist ein strenger Faktenprüfer für deutsche Immobilieninserate.
Gegeben sind die strukturierten QUELLDATEN und ein BESCHREIBUNGSTEXT.
Aufgabe: Liste alle konkreten Behauptungen im Text auf, die in den Quelldaten NICHT belegt sind.
Generische Lagenbeschreibungen ("ruhige Wohngegend", "gute Anbindung") basierend auf der Stadt sind erlaubt.
Konkrete Behauptungen über die Immobilie selbst (Anzahl Zimmer, Ausstattung, Baujahr, Größe, Energie) müssen exakt mit den Quelldaten übereinstimmen.
Antworte als JSON: { "flagged": string[] } — leeres Array wenn alles belegt.`;
  const userPrompt = `QUELLDATEN:\n${summarizeProperty(m)}\n\nBESCHREIBUNGSTEXT:\n${draft.descriptionLong}\n\nKURZTITEL:\n${draft.titleShort}`;
  const result = await callLlm({
    model: ORCHESTRATOR_MODEL,
    messages: [
      { role: "system", content: sysPrompt },
      { role: "user", content: userPrompt },
    ],
    responseFormat: { type: "json_object" },
    temperature: 0,
    maxTokens: 600,
  });
  let parsed: { flagged?: string[] } = {};
  try {
    parsed = JSON.parse(result.message.content || "{}");
  } catch {
    return { ok: false, flagged: ["Prüfung fehlgeschlagen"], costCents: result.usage.costCents };
  }
  const flagged = Array.isArray(parsed.flagged) ? parsed.flagged.map(String) : [];
  return { ok: flagged.length === 0, flagged, costCents: result.usage.costCents };
}

export async function runRubric(m: WorkingMemory): Promise<{ result: RubricResult; costCents: number }> {
  const failures: string[] = [];
  let costCents = 0;

  // 1. GEG fields
  const gegOk = m.hasEnergyCert === false || !!(m.energyCertType && m.energyClass && m.energyValue && m.energySource);
  if (!gegOk) failures.push("Energieausweis-Pflichtfelder fehlen");

  // 2. Word count + paragraphs
  const wcDetails: { ok: boolean; words?: number; paragraphs?: number } = { ok: false };
  if (m.draft) {
    const text = m.draft.descriptionLong.trim();
    const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
    const words = text.split(/\s+/).filter(Boolean).length;
    wcDetails.words = words;
    wcDetails.paragraphs = paragraphs.length;
    // Tiered threshold based on source-data richness.
    // "thin-data": ETW under 100m² with fewer than 5 attributes. These properties
    // have ~18 verifiable facts; honest descriptions top out at ~200 words.
    // 180 is P25 of honest-output ceiling (200w) for thin-data ETW per 3-sample
    // diagnostic on cmoofls1n0001j0g8hvara4z6.
    // "standard": everything else. 230 = P25 of split-generator distribution.
    // To be raised to 230 for thin-data once gather-more-material loop ships
    // (Path 1, ticketed for post-launch).
    const isThinData = m.type === "ETW" && (m.livingArea || 0) < 100 && m.attributes.length < 5;
    const minWords = isThinData ? 180 : 230;
    wcDetails.ok = words >= minWords && words <= 600 && paragraphs.length >= 2 && paragraphs.length <= 4;
    if (!wcDetails.ok) failures.push(`Beschreibung: ${words} Wörter / ${paragraphs.length} Absätze (Soll: ${minWords}–600 / 2–4)`);
  } else {
    failures.push("Kein Entwurf vorhanden");
  }

  // 3. Hallucination check (LLM judge)
  let hallDetails: { ok: boolean; flagged?: string[] } = { ok: false };
  if (m.draft) {
    const h = await checkHallucination(m.draft, m);
    costCents += h.costCents;
    hallDetails = { ok: h.ok, flagged: h.flagged };
    if (!h.ok) failures.push(`Unbelegte Behauptungen: ${h.flagged.join("; ")}`);
  }

  // 4. No banned superlatives
  const supDetails: { ok: boolean; found?: string[] } = { ok: true, found: [] };
  if (m.draft) {
    const haystack = (m.draft.descriptionLong + " " + m.draft.titleShort).toLowerCase();
    const found = BANNED_SUPERLATIVES.filter((w) => haystack.includes(w));
    supDetails.found = found;
    supDetails.ok = found.length === 0;
    if (!supDetails.ok) failures.push(`Verbotene Superlative: ${found.join(", ")}`);
  }

  // 5. Photos: ≥6, AND ≥1 non-interior photo OR floorplan.
  // "Non-interior" = any classification that isn't a room inside the property.
  // This catches exterior, garden, garage, balcony, other, floorplan — all provide
  // building context that pure interior shots don't. Avoids false negatives from
  // classifier labeling a street view as "garden" due to visible trees.
  const INTERIOR_TYPES = new Set(["living", "kitchen", "bathroom", "bedroom", "office", "hallway", "basement"]);
  const photos = m.uploads.filter((u) => u.kind === "PHOTO" || u.kind === "FLOORPLAN");
  const photoCount = photos.length;
  const hasNonInteriorOrFloorplan =
    photos.some((u) => u.kind === "FLOORPLAN") ||
    photos.some((u) => u.classification?.roomType && !INTERIOR_TYPES.has(u.classification.roomType));
  const photosOk = photoCount >= 6 && hasNonInteriorOrFloorplan;
  if (photoCount < 6) failures.push(`Nur ${photoCount} Fotos hochgeladen (Soll: ≥6)`);
  else if (!hasNonInteriorOrFloorplan) failures.push("Mindestens ein Außenfoto oder Grundriss fehlt");

  // 6. Asking price within band, OR explicit override
  let priceOk = true;
  let priceReason: string | undefined;
  if (m.askingPrice != null && m.priceBand) {
    const inBand = m.askingPrice >= m.priceBand.low && m.askingPrice <= m.priceBand.high;
    priceOk = inBand || m.priceOverride;
    if (!priceOk) {
      priceReason = `Preis ${m.askingPrice} außerhalb Band ${m.priceBand.low}–${m.priceBand.high}`;
      failures.push(priceReason);
    }
  } else if (m.askingPrice == null) {
    // No asking price set yet — not a failure, just incomplete
    priceOk = true;
  }

  return {
    result: {
      passed: failures.length === 0,
      failures,
      details: {
        gegFields: { ok: gegOk, reason: gegOk ? undefined : "fehlende Felder" },
        wordCount: wcDetails,
        noHallucination: hallDetails,
        noSuperlatives: supDetails,
        photos: { ok: photosOk, count: photoCount },
        priceInBand: { ok: priceOk, reason: priceReason },
      },
    },
    costCents,
  };
}

// ────────────────────────────────────────────────────────────────────────
// rubricFailureToQuestions() — convert rubric failures to targeted re-ask questions
// ────────────────────────────────────────────────────────────────────────

export function rubricFailureToQuestions(rubric: RubricResult, wm?: WorkingMemory): string[] {
  const questions: string[] = [];
  if (!rubric.details.gegFields.ok) {
    questions.push("Bitte ergänzen Sie die fehlenden Energieausweis-Daten: Energieklasse, Energieverbrauch (kWh/m²·a) und Primärenergieträger.");
  }
  if (!rubric.details.wordCount.ok) {
    const w = rubric.details.wordCount.words || 0;
    const min = rubric.details.wordCount.words !== undefined ? (w < 200 ? 180 : 230) : 230;
    if (w < min) questions.push(`Die Beschreibung hat nur ${w} Wörter (Minimum: ${min}). Soll ich den Text erweitern?`);
    else if (w > 600) questions.push(`Die Beschreibung hat ${w} Wörter (Maximum: 600). Soll ich den Text kürzen?`);
    else questions.push("Die Absatzstruktur der Beschreibung stimmt nicht (2-4 Absätze mit je mind. 80 Wörtern). Soll ich den Text anpassen?");
  }
  if (!rubric.details.noHallucination.ok && rubric.details.noHallucination.flagged) {
    questions.push(`Folgende Angaben im Text sind nicht durch Ihre Daten belegt: ${rubric.details.noHallucination.flagged.join(", ")}. Stimmen diese oder soll ich sie entfernen?`);
  }
  if (!rubric.details.noSuperlatives.ok && rubric.details.noSuperlatives.found) {
    questions.push(`Der Text enthält unzulässige Superlative (${rubric.details.noSuperlatives.found.join(", ")}). Soll ich diese ersetzen?`);
  }
  if (!rubric.details.photos.ok) {
    const c = rubric.details.photos.count || 0;
    if (c < 6) questions.push(`Es fehlen noch ${6 - c} Fotos (mindestens 6 benötigt). Bitte laden Sie weitere Fotos über den 📷-Button hoch.`);
    else questions.push("Mindestens ein Außenfoto oder Grundriss wird benötigt. Bitte laden Sie ein Foto vom Gebäude von außen hoch — z.B. Fassade, Eingang oder Straßenansicht.");
  }
  if (!rubric.details.priceInBand.ok && wm) {
    const price = wm.askingPrice ? wm.askingPrice.toLocaleString("de-DE") : "?";
    const mid = wm.priceBand ? wm.priceBand.strategyReal.toLocaleString("de-DE") : "?";
    const low = wm.priceBand ? wm.priceBand.low.toLocaleString("de-DE") : "?";
    const high = wm.priceBand ? wm.priceBand.high.toLocaleString("de-DE") : "?";
    questions.push(
      `Ihr Angebotspreis von ${price} € liegt außerhalb der Marktempfehlung (${low}–${high} €).\n\nWie möchten Sie fortfahren?\nA) Bei ${price} € bleiben\nB) Auf ${mid} € anheben (Marktmitte)\nC) Einen anderen Preis nennen`
    );
  } else if (!rubric.details.priceInBand.ok) {
    questions.push("Ihr Angebotspreis liegt außerhalb der Marktempfehlung. Möchten Sie den Preis anpassen oder bewusst überschreiben?");
  }
  return questions;
}

// Deterministic message after chained listing_review.
// Returns { message, passed } so caller can branch on outcome.
export function chainedReviewMessage(rubric: RubricResult, draft: DraftResult, wm?: WorkingMemory): { message: string; passed: boolean } {
  if (rubric.passed) {
    const hl = draft.exposeHeadline || draft.titleShort;
    const highlights = (draft.highlights || []).join(" · ");
    const message = [
      "Ihr Exposé-Entwurf ist fertig und hat die Qualitätsprüfung bestanden.",
      "",
      `**Überschrift:** ${hl}`,
      `**Kurztitel:** ${draft.titleShort}`,
      "",
      "**Beschreibung:**",
      draft.descriptionLong,
      "",
      highlights ? `**Highlights:** ${highlights}` : "",
      "",
      'Möchten Sie das Inserat so erstellen? Antworten Sie mit "Ja" um fortzufahren.',
    ].filter(Boolean).join("\n");
    return { message, passed: true };
  }
  const questions = rubricFailureToQuestions(rubric, wm);
  return {
    message: questions[0] || "Der Entwurf entspricht noch nicht den Anforderungen. Bitte prüfen Sie die Angaben.",
    passed: false,
  };
}

// ────────────────────────────────────────────────────────────────────────
// Tool dispatcher
// ────────────────────────────────────────────────────────────────────────

export interface ToolExecutionResult {
  ok: boolean;
  output: Record<string, unknown>;
  memoryPatch?: MemoryPatch;
  costCents: number;
  latencyMs: number;
  triggerHandoff?: boolean;
}

// MemoryPatch is a Partial<WorkingMemory> with one extension:
// `__uploadClassifications` is a sparse map { index: classification } that
// updates existing uploads in place rather than appending.
export type MemoryPatch = Partial<WorkingMemory> & {
  __uploadClassifications?: Record<number, PhotoClassification>;
};

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  memory: WorkingMemory,
  turnNumber?: number,
): Promise<ToolExecutionResult> {
  const start = Date.now();
  let output: Record<string, unknown> = {};
  let memoryPatch: MemoryPatch = {};
  let costCents = 0;
  let ok = true;
  let triggerHandoff = false;

  try {
    switch (name as ToolName) {
      case "address_validate": {
        const r = await tool_addressValidate({
          street: String(args.street || memory.street || ""),
          houseNumber: String(args.houseNumber || memory.houseNumber || ""),
          postcode: String(args.postcode || memory.postcode || ""),
          city: String(args.city || memory.city || ""),
        });
        output = r as unknown as Record<string, unknown>;
        if (r.ok) {
          memoryPatch = { lat: r.lat, lng: r.lng, addressValidated: true };
        }
        ok = r.ok;
        break;
      }
      case "energy_extract": {
        const rawText = typeof args.rawText === "string" ? args.rawText : undefined;
        const pdfB64 = typeof args.pdfBase64 === "string" ? args.pdfBase64 : undefined;
        const pdfBytes = pdfB64 ? Buffer.from(pdfB64, "base64") : undefined;
        const r = await tool_energyExtract({ rawText, pdfBytes });
        output = r as unknown as Record<string, unknown>;
        costCents = r.costCents || 0;
        if (r.ok) {
          // Beliefs are the sole write path for observed energy values.
          // projectBeliefToFlat derives flat fields from beliefs.
          // Fields OCR didn't detect produce no belief → no projection →
          // prior flat values from user turns survive untouched.
          const energyBeliefs: Partial<BeliefStore> = {
            hasEnergyCert: { value: true, confidence: 0.9, source: "ocr" as FieldSource, lastConfirmedTurn: turnNumber ?? 0 },
          };
          if (r.energyClass) energyBeliefs.energyClass = { value: r.energyClass, confidence: 0.85, source: "ocr" as FieldSource, lastConfirmedTurn: turnNumber ?? 0 };
          if (r.energyValue != null) energyBeliefs.energyValue = { value: r.energyValue, confidence: 0.85, source: "ocr" as FieldSource, lastConfirmedTurn: turnNumber ?? 0 };
          if (r.primarySource) energyBeliefs.energySource = { value: r.primarySource, confidence: 0.8, source: "ocr" as FieldSource, lastConfirmedTurn: turnNumber ?? 0 };
          if (r.validUntil) energyBeliefs.energyValidUntil = { value: r.validUntil, confidence: 0.8, source: "ocr" as FieldSource, lastConfirmedTurn: turnNumber ?? 0 };
          memoryPatch = projectBeliefToFlat({ beliefs: energyBeliefs });
          // energyCertType is a format flag, not a property belief
          memoryPatch.energyCertType = r.type === "BEDARF" ? "BEDARF" : "VERBRAUCH";
        }
        ok = r.ok;
        break;
      }
      case "pricing_recommend": {
        const r = tool_pricingRecommend(memory);
        output = r as unknown as Record<string, unknown>;
        if (r.ok && r.band) {
          memoryPatch = { priceBand: r.band, askingPrice: memory.askingPrice ?? r.band.strategyReal };
        }
        ok = r.ok;
        break;
      }
      case "photo_analyse": {
        const idx = typeof args.photoIndex === "number" ? args.photoIndex : -1;
        const r = await tool_photoAnalyse(memory, idx);
        output = r as unknown as Record<string, unknown>;
        costCents = r.costCents;
        if (r.ok && r.classification && idx >= 0 && idx < memory.uploads.length) {
          memoryPatch = { __uploadClassifications: { [idx]: r.classification } };
        }
        ok = r.ok;
        break;
      }
      case "listing_draft": {
        const r = await tool_listingDraft(memory);
        output = r as unknown as Record<string, unknown>;
        costCents = r.costCents || 0;
        if (r.ok && r.draft) {
          memoryPatch = { draft: r.draft };
        }
        ok = r.ok;
        break;
      }
      case "listing_review": {
        const r = await runRubric(memory);
        output = { passed: r.result.passed, failures: r.result.failures, details: r.result.details };
        costCents = r.costCents;
        memoryPatch = { lastRubric: r.result, handoffReady: r.result.passed };
        ok = true;
        break;
      }
      case "handoff_commit": {
        if (!isReadyForHandoff(memory)) {
          output = { ok: false, error: "Quality Rubric noch nicht bestanden — listing_review zuerst aufrufen." };
          ok = false;
        } else {
          output = { ok: true, message: "Handoff angefordert" };
          triggerHandoff = true;
        }
        break;
      }
      default:
        output = { ok: false, error: `Unbekanntes Tool: ${name}` };
        ok = false;
    }
  } catch (e) {
    output = { ok: false, error: e instanceof Error ? e.message : "Tool-Fehler" };
    ok = false;
  }

  return {
    ok,
    output,
    memoryPatch,
    costCents,
    latencyMs: Date.now() - start,
    triggerHandoff,
  };
}

// ────────────────────────────────────────────────────────────────────────
// Memory rebuild from persisted turns
// ────────────────────────────────────────────────────────────────────────

interface PersistedTurn {
  role: string;
  content: string;
  toolName?: string | null;
  toolOutput?: unknown;
}

export function rebuildMemory(turns: PersistedTurn[]): WorkingMemory {
  let memory: WorkingMemory = { ...INITIAL_MEMORY, attributes: [], uploads: [], assumptions: [], units: [] };
  for (const turn of turns) {
    if (turn.toolOutput && typeof turn.toolOutput === "object") {
      const patch = (turn.toolOutput as { memoryPatch?: MemoryPatch }).memoryPatch;
      if (patch && (turn.role === "TOOL" || turn.role === "SYSTEM" || turn.role === "AGENT")) {
        memory = applyPatch(memory, patch);
      }
    }
  }
  memory.phase = derivePhase(memory);
  return memory;
}

function mergeBeliefField<T>(
  existing: FieldBelief<T> | undefined,
  incoming: FieldBelief<T>,
): FieldBelief<T> {
  if (!existing || existing.value === undefined || existing.value === null) {
    return incoming;
  }
  if (existing.value !== incoming.value) {
    return {
      ...incoming,
      conflictsWith: [
        ...(incoming.conflictsWith || []),
        ...(existing.conflictsWith || []),
        { source: existing.source, value: existing.value, turn: existing.lastConfirmedTurn ?? 0 },
      ],
    };
  }
  // Same value from different source — confirming evidence, bump confidence.
  // Additive rather than independent-evidence formula 1-(1-p1)(1-p2) because
  // sources are often correlated (user reads from the cert OCR also parsed).
  // 0.05 bonus distinguishes "confirmed by two sources" (>=0.95) from
  // "single source" (<=0.9) in PR2c's publish-without-confirmation threshold.
  return {
    ...incoming,
    confidence: Math.round(Math.min(1, Math.max(incoming.confidence, existing.confidence) + 0.05) * 100) / 100,
    conflictsWith: existing.conflictsWith?.length
      ? [...(incoming.conflictsWith || []), ...existing.conflictsWith]
      : incoming.conflictsWith,
  };
}

// Copies belief values to flat fields where the flat field is not already set.
// Used by tool writers that produce beliefs as their primary output.
function projectBeliefToFlat(patch: MemoryPatch): MemoryPatch {
  if (!patch.beliefs) return patch;
  const result = { ...patch };
  for (const [k, belief] of Object.entries(patch.beliefs)) {
    if (belief?.value !== undefined && belief.value !== null) {
      if ((result as Record<string, unknown>)[k] === undefined) {
        (result as Record<string, unknown>)[k] = belief.value;
      }
    }
  }
  return result;
}

function applyPatch(memory: WorkingMemory, patch: MemoryPatch): WorkingMemory {
  const next = { ...memory, uploads: [...memory.uploads] };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (k === "__uploadClassifications" && v && typeof v === "object") {
      const map = v as Record<number, PhotoClassification>;
      for (const [idxStr, cls] of Object.entries(map)) {
        const i = Number(idxStr);
        if (i >= 0 && i < next.uploads.length) {
          next.uploads[i] = { ...next.uploads[i], classification: cls };
        }
      }
    } else if (k === "uploads" && Array.isArray(v)) {
      next.uploads = [...next.uploads, ...(v as PhotoUpload[])];
    } else if (k === "attributes" && Array.isArray(v)) {
      const merged = new Set([...next.attributes, ...(v as string[])]);
      next.attributes = Array.from(merged);
    } else if (k === "assumptions" && Array.isArray(v)) {
      const merged = new Set([...next.assumptions, ...(v as string[])]);
      next.assumptions = Array.from(merged);
    } else if (k === "units" && Array.isArray(v)) {
      next.units = v as UnitData[];
    } else if (k === "beliefs" && v && typeof v === "object") {
      const incoming = v as Partial<BeliefStore>;
      const merged = { ...next.beliefs };
      for (const [bk, newBelief] of Object.entries(incoming)) {
        if (!newBelief) continue;
        const existing = merged[bk as keyof BeliefStore];
        // Safe: same field key guarantees matching value types at runtime.
        (merged as Record<string, unknown>)[bk] = mergeBeliefField(
          existing as FieldBelief<typeof newBelief.value> | undefined,
          newBelief as FieldBelief<typeof newBelief.value>,
        );
      }
      next.beliefs = merged as Partial<BeliefStore>;
    } else if (k === "roomProgram" && Array.isArray(v)) {
      next.roomProgram = v as { name: string; area: number }[];
    } else {
      // @ts-expect-error generic patch
      next[k] = v;
    }
  }
  return next;
}

function derivePhase(m: WorkingMemory): WorkingMemory["phase"] {
  if (!m.type) return "greet";
  if (!m.street || !m.city) return "basics";
  if (!m.livingArea || !m.condition) return "details";
  if (m.hasEnergyCert === null) return "energy";
  if (m.uploads.filter((u) => u.kind === "PHOTO").length < 6) return "photos";
  if (!m.draft) return "draft";
  return "confirm";
}

// ────────────────────────────────────────────────────────────────────────
// Orchestrator system prompt — drives the LLM to extract user data and
// decide tool calls. Tool calls are emitted via OpenAI tool-calling, NOT
// via JSON in the message body.
// ────────────────────────────────────────────────────────────────────────

const ORCHESTRATOR_SYSTEM_PROMPT = `Du bist der Direkta Exposé-Agent — ein intelligenter Assistent, der deutsche Immobilieneigentümer durch die Erstellung eines GEG-konformen Inserats führt.

═══ KERNPRINZIPIEN ═══

1. SEI INTELLIGENT: Lies das Working Memory. Frage NIEMALS nach etwas, das dort schon steht.
2. SEI EFFIZIENT: Wenn alle Daten vorhanden sind, handle sofort — rufe Tools auf, frage nicht "Soll ich...?"
3. SEI FREUNDLICH: Deutsch, Sie-Form, kurz und klar.
4. ERFINDE NICHTS: Beschreibe nur, was der Verkäufer gesagt hat.

═══ ZWEI MODI ═══

MODUS A — BULK (Verkäufer gibt viele Daten auf einmal):
1. Zeige eine ✓-Liste ALLER erkannten Daten — Typ, Adresse, Fläche, Zimmer, Bäder, Baujahr, Zustand, Ausstattung, Energie, Preis
2. Bei MFH: zeige auch alle erkannten Einheiten mit Größe/Zimmer/Etage UND die Verkaufsart
3. Liste nur was FEHLT (prüfe Working Memory!) — typischerweise: Fotos, Grundriss
4. Wenn nur Fotos/Grundriss fehlen → sage das direkt, weise auf die Buttons hin
5. Wenn Pflichtfelder fehlen → frage nach dem ERSTEN fehlenden
6. FRAGE NIEMALS nach Daten die bereits im Working Memory stehen!

MODUS B — DIALOG (Verkäufer antwortet einzeln):
Stelle pro Nachricht NUR EINE Frage. Reihenfolge:
Typ → Adresse → PLZ/Stadt → [typspezifische Fragen] → Energie → Fotos → Grundriss

TYPSPEZIFISCHE FRAGEN:
• ETW: Wohnfläche → Zimmer → Bäder → Etage → Baujahr → Zustand → Ausstattung (Balkon, Aufzug, Keller, Stellplatz, Hausgeld?)
• EFH/DHH/RH: Wohnfläche → Grundstück → Zimmer → Bäder → Baujahr → Zustand → Ausstattung (Garten, Garage, Keller, Terrasse, Carport?)
• MFH: Wohnfläche (gesamt) → Grundstück → Baujahr → Zustand → Ausstattung → **Einheiten (PHASE B)** → **Verkaufsart (PHASE C)** → dann Energie → Fotos → Grundriss
• GRUNDSTUECK: Grundstücksfläche → Bebauungsplan? → Erschließung? → Zustand

WICHTIG FÜR MFH: Frage nach Einheiten und Verkaufsart BEVOR du nach Fotos fragst! Der Verkäufer muss wissen welche Wohnungen es gibt, damit er die Fotos richtig zuordnen kann.

═══ AUTOMATISCHE TOOL-AUFRUFE ═══

Rufe Tools SOFORT auf — frage NICHT erst um Erlaubnis:
• address_validate → wenn Adresse komplett im Memory
• pricing_recommend → wenn ALLE Pflichtfelder gesetzt (Typ, Adresse, Fläche, Zustand) UND ≥6 Fotos hochgeladen
• listing_draft → SOFORT nach erfolgreichem pricing_recommend
• listing_review → SOFORT nach listing_draft
• handoff_commit → NUR wenn rubric bestanden UND Verkäufer "ja" sagt

═══ NACH UPLOADS — FÜHRE DEN VERKÄUFER ═══

Der Verkäufer sendet nach jedem Upload eine kurze Bestätigungsnachricht. Reagiere als GUIDE:

NACH FOTO-UPLOAD:
- "Danke, [N] Fotos erhalten! ✓"
- Wenn Grundriss noch fehlt: "Haben Sie auch einen Grundriss? Nutzen Sie den 📐-Button links unten."
- Wenn Grundriss da, aber Energieausweis fehlt: "Haben Sie einen Energieausweis? Nutzen Sie den ⚡-Button."
- Wenn alles da: sofort pricing_recommend aufrufen

NACH GRUNDRISS-UPLOAD:
- "Grundriss erhalten! ✓"
- Wenn Energieausweis fehlt: "Jetzt fehlt noch der Energieausweis. Nutzen Sie den ⚡-Button, oder teilen Sie mir die Daten mit (Typ, Klasse, Verbrauch, Energieträger)."
- Wenn Fotos < 6: "Es fehlen noch Fotos (mindestens 6). Nutzen Sie den 📷-Button."

NACH ENERGIEAUSWEIS-UPLOAD:
- Prüfe die erkannten Werte im Memory: "Energieausweis erkannt: [Typ], Klasse [X], [Y] kWh/(m²·a). Stimmt das?"
- Wenn Werte fehlen: "Einige Werte konnten nicht ausgelesen werden. Bitte ergänzen Sie: [fehlende Felder]"

AUTOMATISCHE PIPELINE:
Wenn ≥6 Fotos im Memory UND alle Pflichtfelder gesetzt:
→ Rufe SOFORT pricing_recommend auf
→ Dann listing_draft
→ Dann listing_review
→ Zeige dem Verkäufer den Entwurf und frage nach Bestätigung

═══ MEHRFAMILIENHAUS (MFH) — STRUKTURIERTER ABLAUF ═══

Wenn der Typ MFH ist, folge diesem Ablauf:

PHASE A — GEBÄUDE:
1. "Wie viele Wohneinheiten hat das Gebäude?"
2. "Liegen alle Wohnungen an derselben Adresse?" (Normalfall: ja)
3. Sammle Gebäude-Daten: Adresse, Baujahr, Zustand, Energieausweis
4. "Laden Sie jetzt Fotos vom Gebäude hoch — Außenansicht, Treppenhaus, Gemeinschaftsflächen. Nutzen Sie den 📷-Button links unten."
5. "Haben Sie einen Gebäude-Grundriss? Nutzen Sie den 📐-Button."

PHASE B — WOHNUNGEN EINZELN:
Sage: "Perfekt, das Gebäude ist erfasst. Jetzt gehen wir die [N] Wohnungen einzeln durch. Starten wir mit der ersten."

Für JEDE Wohnung frage nacheinander:
a) "Wie bezeichnen Sie diese Wohnung?" (WE 01, EG links, Whg 1, etc.)
b) "Wohnfläche in m²?"
c) "Zimmer / Bäder?"
d) "Welches Stockwerk?" (EG, 1. OG, DG…)
e) "Besonderheiten?" (Balkon, Ankleide, eigener Eingang, Terrasse…)
f) "Haben Sie separate Fotos für diese Wohnung? Laden Sie sie jetzt hoch — sie werden automatisch [Label] zugeordnet."
g) "Haben Sie einen eigenen Grundriss für [Label]?"
h) Optional: "Raumprogramm — wie groß sind die einzelnen Räume?" (Küche 32m², Wohnen 19m², etc.)

WICHTIG: Akzeptiere auch Bulk-Eingaben! Wenn der Verkäufer sagt "Wohnung 1: 95m², 3 Zimmer, EG. Wohnung 2: 55m², 2 Zimmer, 1. OG" → erfasse ALLE auf einmal und zeige eine ✓-Liste.

WICHTIG — UPLOAD-KONTEXT SETZEN:
Wenn du zu einer bestimmten Wohnung wechselst, setze currentUnit im Memory auf das Label dieser Wohnung.
Wenn du zurück zur Gebäude-Ebene wechselst, setze currentUnit auf null.
Der Upload-Kontext wird dem Verkäufer automatisch angezeigt. Alle Fotos/Grundrisse die hochgeladen werden, werden automatisch dieser Wohnung zugeordnet.

Nach jeder Wohnung: "✓ [Label] erfasst ([Area] m², [Rooms] Zi). Weiter mit Wohnung [N+1]."

PHASE C — VERKAUFSSTRATEGIE:
"Wie möchten Sie verkaufen?"
• Einzeln — jede Wohnung separat an Selbstnutzer
• Als Paket — alle Wohnungen zusammen an einen Investor
• Beides — einzeln UND als Paket anbieten (empfohlen, erreicht mehr Käufer)

PHASE D — WEITER WIE GEWOHNT:
Wenn alle Einheiten + Verkaufsart erfasst → pricing_recommend → listing_draft → listing_review → handoff

MFH NACH BULK-EINGABE:
Wenn der Verkäufer alle Gebäudedaten + Einheiten + Energie + Preis auf einmal gibt:
1. Zeige eine ✓-Liste ALLER erkannten Daten (Gebäude UND Einheiten)
2. Liste NUR was fehlt — typischerweise: Fotos + Grundriss
3. Frage nach Gebäudefotos zuerst (Außenansicht, Treppenhaus)
4. Dann frage für JEDE Wohnung einzeln:
   "Haben Sie separate Fotos für [WE-Label]? Laden Sie sie jetzt hoch."
   "Haben Sie einen Grundriss für [WE-Label]?"
5. Wenn Verkaufsart noch fehlt, frage: "Einzelverkauf, Paketverkauf, oder beides?"
6. Wenn alles da → Pipeline starten

MFH-INTELLIGENZ:
• Vererbung: Baujahr, Zustand, Energieausweis vom Gebäude gelten automatisch für alle Einheiten
• "Gleich wie oben" / "Selbe Ausstattung" → vorherige Wohnungs-Daten übernehmen
• "Keine eigenen Fotos" / "Die Gebäudefotos reichen" → Gebäudefotos für alle verwenden
• Plausibilitätsprüfung: Gesamtfläche aller Einheiten sollte ungefähr der Gebäude-Wohnfläche entsprechen
• Bei "Weiß ich nicht" für optionale Unit-Felder → überspringen, kein Problem

═══ INTELLIGENZ ═══

• "Weiß ich nicht" / "skip" → Pflichtfeld: Standardwert vorschlagen. Optional: überspringen.
• "Gleiche wie oben" / "selbe" → vorherige Werte übernehmen
• Plausibilität prüfen: 250m² + 3 Zimmer bei MFH? → nachfragen
• Energieausweis-PDF nicht lesbar → manuelle Eingabe akzeptieren, weiter
• Adresse nicht validierbar → akzeptieren, weiter
• Pricing fehlgeschlagen → zeige fehlende Felder

═══ FOTO-ANLEITUNG ═══

Wenn Fotos fehlen, weise auf die Buttons links unten hin UND gib konkrete Foto-Tipps:
📷 Foto-Button — für Fotos (mind. 6)
⚡ Energie-Button — für Energieausweis-PDF
📐 Grundriss-Button — für Grundriss-PDF

Sage dem Verkäufer WAS er fotografieren soll:
"Für ein professionelles Exposé empfehle ich folgende Fotos:
- Außenansicht von der Straße
- Wohnzimmer (bei Tageslicht, aufgeräumt)
- Küche
- Schlafzimmer
- Badezimmer
- Balkon, Garten oder Eingangsbereich

Tipp: Fotografieren Sie bei Tageslicht, räumen Sie vorher auf, und halten Sie die Kamera gerade."

═══ PREISEMPFEHLUNG ERKLÄREN ═══

Wenn pricing_recommend erfolgreich ist, erkläre den Preis im Kontext:
- Zeige €/m² und vergleiche mit dem Markt
- Erkläre die 3 Strategien: Schnellverkauf (unter Markt), Realistisch (Marktmitte), Maximum (darüber)
- Wenn der Wunschpreis über dem Band liegt: "Ihr Preis liegt [X]% über unserer Empfehlung. Das ist möglich, kann aber die Verkaufsdauer verlängern."

═══ NACH HANDOFF (Nächste Schritte) ═══

Wenn handoff_commit erfolgreich war, sage:
"Ihr Inserat ist erstellt! So geht es weiter:
1. Prüfen Sie das Exposé auf der nächsten Seite
2. Laden Sie die PDF herunter und teilen Sie sie mit Interessenten
3. Aktivieren Sie das Inserat, wenn Sie bereit sind
4. Optional: Auf ImmobilienScout24 freischalten unter Portal-Sync"

═══ RAUMPROGRAMM (Optional) ═══

Nach den Grunddaten, frage optional:
"Möchten Sie die einzelnen Räume mit Größe angeben? Das macht Ihr Exposé professioneller.
Beispiel: Wohnzimmer 25m², Küche 12m², Schlafzimmer 14m², Bad 6m²"
Speichere als roomProgram: [{ name: "Wohnzimmer", area: 25 }, ...] im Memory.
Wenn "nein" oder "skip" → überspringen.

═══ REFERENZ ═══

IMMOBILIENTYPEN: ETW, EFH, MFH, DHH, RH, GRUNDSTUECK
ZUSTAND: ERSTBEZUG, NEUBAU, GEPFLEGT, RENOVIERUNGS_BEDUERFTIG, SANIERUNGS_BEDUERFTIG, ROHBAU
ENERGIEKLASSEN: A+, A, B, C, D, E, F, G, H
VERKAUFSART: INDIVIDUAL (einzeln), BUNDLE (Paket), BOTH (beides)`;

export function buildMemoryContext(m: WorkingMemory): string {
  const missing = getMissingFields(m);
  const q = nextQuestion(m);
  const score = completenessScore(m);
  return `[WORKING MEMORY]
Phase: ${m.phase}
Typ: ${m.type || "—"}
Adresse: ${m.street ? `${m.street} ${m.houseNumber}, ${m.postcode} ${m.city}` : "—"}
Adresse validiert: ${m.addressValidated ? "ja" : "nein"}
Wohnfläche: ${m.livingArea ? `${m.livingArea} m²` : "—"}
Grundstück: ${m.plotArea ? `${m.plotArea} m²` : "—"}
Zimmer: ${m.rooms ?? "—"}
Bäder: ${m.bathrooms ?? "—"}
Baujahr: ${m.yearBuilt ?? "—"}
Etage: ${m.floor ?? "—"}
Zustand: ${m.condition || "—"}
Ausstattung: ${m.attributes.join(", ") || "—"}
Energie: ${m.hasEnergyCert === null ? "—" : m.hasEnergyCert ? `${m.energyClass || "?"} (${m.energyValue || "?"} kWh, ${m.energySource || "?"})` : "kein Ausweis"}
Fotos hochgeladen: ${m.uploads.filter((u) => u.kind === "PHOTO" && !u.unitLabel).length} (Gebäude)${m.units.length > 0 ? m.units.map((u) => {
    const unitPhotos = m.uploads.filter((p) => p.kind === "PHOTO" && p.unitLabel === u.label).length;
    const unitPlans = m.uploads.filter((p) => p.kind === "FLOORPLAN" && p.unitLabel === u.label).length;
    return ` | ${u.label}: ${unitPhotos} Fotos, ${unitPlans} Grundrisse`;
  }).join("") : ""}
Grundrisse hochgeladen: ${m.uploads.filter((u) => u.kind === "FLOORPLAN" && !u.unitLabel).length} (Gebäude)${m.type === "MFH" ? `
Wohneinheiten: ${m.unitCount ?? "—"}
Einheiten-Daten: ${m.units.length > 0 ? m.units.map((u) => `${u.label}: ${u.livingArea || "?"}m², ${u.rooms || "?"}Zi, ${u.bathrooms || "?"}Bad, ${u.floor != null ? "EG+" + u.floor : "?"}. OG`).join(" | ") : "—"}
Verkaufsart: ${m.sellingMode || "—"}` : ""}
Preisband: ${m.priceBand ? `${m.priceBand.low.toLocaleString("de")}–${m.priceBand.high.toLocaleString("de")} € (${m.priceBand.confidence})` : "—"}
Wunschpreis: ${m.askingPrice ? `${m.askingPrice.toLocaleString("de")} €` : "—"}
Entwurf vorhanden: ${m.draft ? "ja" : "nein"}
Letzte Rubric: ${m.lastRubric ? (m.lastRubric.passed ? "✓ bestanden" : `✗ ${m.lastRubric.failures.join("; ")}`) : "—"}
Aktuelle Wohnung (Upload-Kontext): ${m.currentUnit || "Gebäude"}
Raumprogramm: ${m.roomProgram.length > 0 ? m.roomProgram.map((r) => `${r.name} ${r.area}m²`).join(", ") : "—"}
Kontaktdaten: ${m.sellerContact ? [m.sellerContact.name, m.sellerContact.company, m.sellerContact.phone, m.sellerContact.email].filter(Boolean).join(", ") : "—"}
Handoff bereit: ${m.handoffReady ? "ja" : "nein"}
Vollständigkeit: ${score}%
Nächste Aktion: ${q.action === "ask" ? `Frage: "${q.prompt}"` : q.action === "upload_photos" ? `Foto-Upload: "${q.prompt}"` : q.action === "trigger_pricing" ? "→ pricing_recommend aufrufen" : q.action === "trigger_draft" ? "→ listing_draft aufrufen" : "→ Bestätigung abwarten"}${q.field ? ` [Feld: ${q.field}]` : ""}${m.lastRubric && !m.lastRubric.passed ? `\nRubric-Fehler: ${rubricFailureToQuestions(m.lastRubric, m).join(" | ")}` : ""}${m.costCompressed ? "\n\n[KOSTEN-MODUS] Budget knapp. Antworte kurz (max 2 Sätze). Überspringe optionale Felder (Zimmer, Bäder, Etage, Grundstück, Raumprogramm, Kontaktdaten). Frage nur Pflichtfelder." : ""}`;
}

interface ChatMsg {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  name?: string;
}

function parseInlineMemory(content: string): { cleaned: string; patch: MemoryPatch | null } {
  const match = content.match(/###MEMORY###\s*([\s\S]*?)\s*###END###/);
  if (!match) return { cleaned: content, patch: null };
  const cleaned = content.replace(/###MEMORY###[\s\S]*?###END###/, "").trim();
  try {
    const raw = JSON.parse(match[1]);
    // Legacy inline memory path — no turn context available, use 0.
    // This path is backwards-compat and rarely hit; removes in PR2b.
    return { cleaned, patch: normalizeUserPatch(raw, 0) };
  } catch {
    return { cleaned, patch: null };
  }
}

// Turn numbering convention for lastConfirmedTurn:
// Counted as the number of prior user messages in the conversation history
// at the time the turn is processed. First user message → turnNumber=0,
// second → 1, etc. This is a 0-based index into the user turn sequence,
// computed in runAgentTurn as history.filter(m => m.role === "user").length.
// PR2c's recency filtering uses this to prefer later-confirmed values.
function normalizeUserPatch(data: Record<string, unknown>, turnNumber: number): MemoryPatch {
  const patch: MemoryPatch = {};
  if (typeof data.type === "string") {
    const map: Record<string, string> = {
      eigentumswohnung: "ETW", wohnung: "ETW", etw: "ETW",
      einfamilienhaus: "EFH", efh: "EFH", haus: "EFH",
      mehrfamilienhaus: "MFH", mfh: "MFH",
      doppelhaushälfte: "DHH", doppelhaus: "DHH", dhh: "DHH",
      reihenhaus: "RH", rh: "RH",
      "grundstück": "GRUNDSTUECK", grundstueck: "GRUNDSTUECK", land: "GRUNDSTUECK",
    };
    patch.type = map[data.type.toLowerCase()] || data.type.toUpperCase();
  }
  if (typeof data.street === "string") {
    // Split "Marktstraße 12" into street + houseNumber if LLM merged them
    const streetMatch = data.street.match(/^(.+?)\s+(\d+\s*\w?)$/);
    if (streetMatch && !data.houseNumber) {
      patch.street = streetMatch[1];
      patch.houseNumber = streetMatch[2].trim();
    } else {
      patch.street = data.street;
    }
  }
  if (typeof data.houseNumber === "string" || typeof data.houseNumber === "number") patch.houseNumber = String(data.houseNumber);
  if (typeof data.postcode === "string" || typeof data.postcode === "number") {
    // Split "76571 Gaggenau" into postcode + city if LLM merged them
    const pcStr = String(data.postcode);
    const pcMatch = pcStr.match(/^(\d{5})\s+(.+)$/);
    if (pcMatch && !data.city) {
      patch.postcode = pcMatch[1];
      patch.city = pcMatch[2];
    } else {
      patch.postcode = pcStr.replace(/\D/g, "").slice(0, 5);
    }
  }
  if (typeof data.city === "string") patch.city = data.city;
  if (typeof data.livingArea === "number") patch.livingArea = data.livingArea;
  if (typeof data.plotArea === "number") patch.plotArea = data.plotArea;
  if (typeof data.yearBuilt === "number") patch.yearBuilt = data.yearBuilt;
  if (typeof data.rooms === "number") patch.rooms = data.rooms;
  if (typeof data.bathrooms === "number") patch.bathrooms = data.bathrooms;
  if (typeof data.floor === "number") patch.floor = data.floor;
  if (typeof data.condition === "string") {
    const map: Record<string, string> = {
      erstbezug: "ERSTBEZUG", neubau: "NEUBAU", gepflegt: "GEPFLEGT",
      "renovierungsbedürftig": "RENOVIERUNGS_BEDUERFTIG", renovierungsbeduerftig: "RENOVIERUNGS_BEDUERFTIG",
      "sanierungsbedürftig": "SANIERUNGS_BEDUERFTIG", sanierungsbeduerftig: "SANIERUNGS_BEDUERFTIG",
      rohbau: "ROHBAU",
    };
    patch.condition = map[data.condition.toLowerCase()] || data.condition.toUpperCase();
  }
  if (Array.isArray(data.attributes)) patch.attributes = data.attributes.map(String);
  if (typeof data.hasEnergyCert === "boolean") patch.hasEnergyCert = data.hasEnergyCert;
  if (typeof data.energyCertType === "string") patch.energyCertType = data.energyCertType.toUpperCase();
  if (typeof data.energyClass === "string") patch.energyClass = data.energyClass;
  if (typeof data.energyValue === "number") patch.energyValue = data.energyValue;
  if (typeof data.energySource === "string") patch.energySource = data.energySource;
  if (typeof data.askingPrice === "number") patch.askingPrice = data.askingPrice;
  if (typeof data.priceOverride === "boolean") patch.priceOverride = data.priceOverride;
  if (Array.isArray(data.assumptions)) patch.assumptions = data.assumptions.map(String);
  if (typeof data.unitCount === "number") patch.unitCount = data.unitCount;
  if (Array.isArray(data.units)) {
    patch.units = data.units.map((u: Record<string, unknown>) => ({
      label: String(u.label || ""),
      livingArea: typeof u.livingArea === "number" ? u.livingArea : null,
      rooms: typeof u.rooms === "number" ? u.rooms : null,
      bathrooms: typeof u.bathrooms === "number" ? u.bathrooms : null,
      floor: typeof u.floor === "number" ? u.floor : null,
      features: Array.isArray(u.features) ? u.features.map(String) : [],
      askingPrice: typeof u.askingPrice === "number" ? u.askingPrice : null,
    }));
  }
  if (typeof data.sellingMode === "string") {
    const modeMap: Record<string, string> = {
      individual: "INDIVIDUAL", einzeln: "INDIVIDUAL",
      bundle: "BUNDLE", paket: "BUNDLE",
      both: "BOTH", beides: "BOTH",
    };
    patch.sellingMode = (modeMap[data.sellingMode.toLowerCase()] || data.sellingMode.toUpperCase()) as WorkingMemory["sellingMode"];
  }
  if (typeof data.hasFloorPlan === "boolean") patch.hasFloorPlan = data.hasFloorPlan;
  if (Array.isArray(data.roomProgram)) {
    patch.roomProgram = data.roomProgram.filter((r: unknown) => r && typeof r === "object" && "name" in (r as Record<string, unknown>) && "area" in (r as Record<string, unknown>)).map((r: unknown) => {
      const obj = r as Record<string, unknown>;
      return { name: String(obj.name), area: Number(obj.area) };
    });
  }
  if (data.sellerContact && typeof data.sellerContact === "object") {
    const sc = data.sellerContact as Record<string, unknown>;
    const contact = {
      name: sc.name ? String(sc.name) : undefined,
      company: sc.company ? String(sc.company) : undefined,
      phone: sc.phone ? String(sc.phone) : undefined,
      email: sc.email ? String(sc.email) : undefined,
    };
    // Only write sellerContact if at least one subfield is present.
    // Empty objects from LLM extraction should be treated as not extracted.
    if (contact.name || contact.company || contact.phone || contact.email) {
      patch.sellerContact = contact;
    }
  }
  // Dual-write: for each scalar field written, create a belief entry
  const BELIEF_FIELDS: (keyof BeliefStore)[] = [
    "type", "street", "houseNumber", "postcode", "city",
    "livingArea", "condition", "rooms", "yearBuilt", "bathrooms",
    "floor", "plotArea", "hasEnergyCert", "energyCertType",
    "energyClass", "energyValue", "energySource", "energyValidUntil",
    "attributes",
  ];
  const beliefs: Partial<BeliefStore> = {};
  for (const f of BELIEF_FIELDS) {
    if (f in patch && (patch as Record<string, unknown>)[f] !== undefined) {
      (beliefs as Record<string, unknown>)[f] = {
        value: (patch as Record<string, unknown>)[f],
        confidence: 0.9,
        source: "user" as FieldSource,
        lastConfirmedTurn: turnNumber,
      };
    }
  }
  if (Object.keys(beliefs).length > 0) patch.beliefs = beliefs;
  return patch;
}

// ────────────────────────────────────────────────────────────────────────
// Agent loop driver — runs a single user turn through the LLM,
// dispatching any tool calls, persisting AgentSteps, enforcing cost cap.
// ────────────────────────────────────────────────────────────────────────

export interface AgentRunContext {
  conversationId: string;
  agentRunId: string;
  userId: string;
  /** Total cost accumulated on this run BEFORE this turn began. */
  startingCostCents: number;
}

export interface AgentTurnResult {
  agentMessage: string;                  // user-facing text
  memory: WorkingMemory;
  toolStepsExecuted: number;
  costCentsThisTurn: number;
  costCentsTotal: number;
  finished: boolean;                     // handoff_commit fired and rubric passed
  abortedReason?: "cost_cap" | "max_iterations" | "rubric_failed_repeatedly";
}

async function extractMemoryFromMessage(
  agentQuestion: string,
  userMessage: string,
  currentMemory: WorkingMemory,
  agentRunId: string,
  turnNumber: number,
): Promise<{ patch: MemoryPatch | null; costCents: number }> {
  const known = Object.entries(currentMemory)
    .filter(([k, v]) => v !== null && k !== "uploads" && k !== "draft" && k !== "lastRubric" && k !== "assumptions" && k !== "priceBand")
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  const prompt = `Extrahiere Immobiliendaten aus dem Dialog. Der Agent hat eine Frage gestellt und der Nutzer hat geantwortet. Gib NUR ein JSON-Objekt zurück.

Bereits bekannt: ${known || "nichts"}

Agent fragte: "${agentQuestion}"
Nutzer antwortete: "${userMessage}"

WICHTIG: Extrahiere ALLE erkennbaren Daten aus der Antwort. Bei Bulk-Eingaben mit vielen Daten, extrahiere ALLES auf einmal.

Beispiele für einzelne Antworten:
- Agent: "Wohnfläche?" → Nutzer: "250" → { "livingArea": 250 }
- Agent: "Zustand?" → Nutzer: "Gepflegt" → { "condition": "GEPFLEGT" }

Beispiel für Bulk-Eingabe:
- Nutzer: "MFH, Marktstraße 12, 76571 Gaggenau, 250m², 8 Zimmer, 3 Bäder, Bj 1999, gepflegt. 3 Wohnungen: WE1 95m² 3Zi EG, WE2 55m² 2Zi 1.OG. Verkauf: beides. Energie: Verbrauch B 70kWh Gas. Preis: 525000"
→ { "type":"MFH", "street":"Marktstraße", "houseNumber":"12", "postcode":"76571", "city":"Gaggenau", "livingArea":250, "rooms":8, "bathrooms":3, "yearBuilt":1999, "condition":"GEPFLEGT", "unitCount":3, "units":[{"label":"WE1","livingArea":95,"rooms":3,"floor":0},{"label":"WE2","livingArea":55,"rooms":2,"floor":1}], "sellingMode":"BOTH", "hasEnergyCert":true, "energyCertType":"VERBRAUCH", "energyClass":"B", "energyValue":70, "energySource":"Gas", "askingPrice":525000 }

WICHTIGE REGELN:
- Überschreibe KEINE bereits bekannten Felder, es sei denn der Nutzer korrigiert sie explizit.
- "Grundstück hat X m²" bedeutet plotArea, NICHT type=GRUNDSTUECK. Ändere type nur wenn der Nutzer den Immobilientyp explizit ändert.
- street und houseNumber GETRENNT: "Marktstraße 12" → street: "Marktstraße", houseNumber: "12"
- postcode und city GETRENNT: "76571 Gaggenau" → postcode: "76571", city: "Gaggenau"
- postcode ist IMMER nur die 5-stellige Zahl, city ist IMMER nur der Ortsname

Erlaubte Felder (nur NEUE/GEÄNDERTE extrahieren):
- type: ETW|EFH|MFH|DHH|RH|GRUNDSTUECK (NUR der Immobilientyp, nicht Grundstücksfläche!)
- street: nur Straßenname ohne Hausnummer
- houseNumber: nur die Hausnummer
- postcode: nur 5-stellige PLZ
- city: nur Ortsname
- livingArea: Wohnfläche in m² (Zahl)
- plotArea: Grundstücksfläche in m² (Zahl) — "Grundstück" hier = Fläche, nicht Typ!
- yearBuilt: Baujahr (Zahl)
- rooms: Zimmeranzahl (Zahl)
- bathrooms: Badezimmer (Zahl)
- floor: Etage (Zahl)
- condition: ERSTBEZUG|NEUBAU|GEPFLEGT|RENOVIERUNGS_BEDUERFTIG|SANIERUNGS_BEDUERFTIG|ROHBAU
- attributes: Array von Strings (Balkon, Keller, Garten, Stellplatz, Fussbodenheizung, etc.)
- hasEnergyCert: true/false
- energyCertType: VERBRAUCH|BEDARF
- energyClass: A+|A|B|C|D|E|F|G|H
- energyValue: kWh/m²a (Zahl)
- energySource: Gas|Öl|Fernwärme|Strom|etc.
- assumptions: Array von getroffenen Annahmen
- unitCount: Anzahl Wohneinheiten (Zahl, nur bei MFH)
- units: Array von { label, livingArea, rooms, bathrooms, floor, features } — Daten einzelner Wohneinheiten
- sellingMode: INDIVIDUAL|BUNDLE|BOTH — Verkaufsart (einzeln/Paket/beides)
- hasFloorPlan: true wenn Grundriss vorhanden
- currentUnit: string|null — Label der Wohnung die gerade besprochen wird (z.B. "Wohnung 1", "WE 01"). null wenn Gebäude-Ebene. Setze dies wenn der Assistent explizit zu einer bestimmten Wohnung wechselt.
- roomProgram: Array von { name: string, area: number } — einzelne Räume mit Größe (z.B. { name: "Wohnzimmer", area: 25 })
- askingPrice: Wunschpreis/Angebotspreis in Euro (Zahl, ohne Währung)
- sellerContact: { name?, company?, phone?, email? } — Kontaktdaten für das Exposé

Antworte NUR mit JSON. Leeres Objekt {} wenn nichts Neues extrahiert wurde.`;

  try {
    // Scale maxTokens with input length: bulk pastes with MFH units need more output space
    const extractMaxTokens = userMessage.length > 300 ? 800 : 400;
    const llm = await callLlm({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.0,
      maxTokens: extractMaxTokens,
      responseFormat: { type: "json_object" },
    });

    await prisma.agentStep.create({
      data: {
        agentRunId,
        ordinal: await nextStepOrdinal(agentRunId),
        toolName: "memory_extract",
        input: asJson({ userMessage: userMessage.slice(0, 200) }),
        output: asJson({ raw: llm.message.content?.slice(0, 500) }),
        latencyMs: 0,
        ok: true,
      },
    });

    const raw = JSON.parse(llm.message.content || "{}");
    const patch = normalizeUserPatch(raw, turnNumber);
    const hasData = Object.keys(patch).length > 0;
    return { patch: hasData ? patch : null, costCents: llm.usage.costCents };
  } catch {
    return { patch: null, costCents: 0 };
  }
}

export async function runAgentTurn(
  ctx: AgentRunContext,
  memory: WorkingMemory,
  history: ChatMsg[],
  userMessage: string | null,
): Promise<AgentTurnResult> {
  const messages: ChatMsg[] = [
    { role: "system", content: ORCHESTRATOR_SYSTEM_PROMPT },
    { role: "system", content: buildMemoryContext(memory) },
    ...history,
  ];
  if (userMessage !== null) {
    messages.push({ role: "user", content: userMessage });
  }

  let workingMemory = memory;
  let toolStepsExecuted = 0;
  let costCentsThisTurn = 0;
  let costCentsTotal = ctx.startingCostCents;
  let finished = false;
  let agentMessage = "";
  const turnNumber = history.filter(m => m.role === "user").length;
  let abortedReason: AgentTurnResult["abortedReason"];

  // Cost-compression hysteresis: one-way latch, stays on once triggered
  if (costCentsTotal > 140 && !workingMemory.costCompressed) {
    workingMemory = { ...workingMemory, costCompressed: true };
    await prisma.conversationTurn.create({
      data: {
        conversationId: ctx.conversationId,
        role: "SYSTEM",
        content: "[cost-compression-latch]",
        toolName: "system",
        toolOutput: asJson({ memoryPatch: { costCompressed: true } }),
      },
    });
  }

  // Mechanical handoff: when rubric passed and seller confirms, trigger handoff
  // directly. Don't let the LLM choose between re-drafting and committing.
  if (
    userMessage &&
    workingMemory.lastRubric?.passed &&
    workingMemory.draft &&
    isReadyForHandoff(workingMemory)
  ) {
    const msg = userMessage.trim().toLowerCase();
    const confirmPhrases = /\bja\b|erstellen|veröffentlichen|fertig|weiter|machen|los|bestätig/i;
    if (confirmPhrases.test(msg)) {
      const handoffTr = await executeTool("handoff_commit", {}, workingMemory, turnNumber);
      toolStepsExecuted++;
      costCentsThisTurn += handoffTr.costCents;
      costCentsTotal += handoffTr.costCents;
      if (handoffTr.memoryPatch) workingMemory = applyPatch(workingMemory, handoffTr.memoryPatch);

      await prisma.agentStep.create({
        data: {
          agentRunId: ctx.agentRunId,
          ordinal: await nextStepOrdinal(ctx.agentRunId),
          toolName: "handoff_commit",
          input: asJson({ mechanical: true }),
          output: asJson({ ...handoffTr.output, memoryPatch: handoffTr.memoryPatch }),
          latencyMs: handoffTr.latencyMs,
          ok: handoffTr.ok,
        },
      });

      await prisma.conversationTurn.create({
        data: {
          conversationId: ctx.conversationId,
          role: "TOOL",
          content: "handoff_commit",
          toolName: "handoff_commit",
          toolInput: asJson({}),
          toolOutput: asJson({ ...handoffTr.output, memoryPatch: handoffTr.memoryPatch }),
          latencyMs: handoffTr.latencyMs,
        },
      });

      if (handoffTr.triggerHandoff) {
        agentMessage = "Ihr Inserat ist erstellt! So geht es weiter:\n1. Prüfen Sie das Exposé auf der nächsten Seite\n2. Laden Sie die PDF herunter und teilen Sie sie mit Interessenten\n3. Aktivieren Sie das Inserat, wenn Sie bereit sind\n4. Optional: Auf ImmobilienScout24 freischalten unter Portal-Sync";
        return { agentMessage, memory: workingMemory, toolStepsExecuted, costCentsThisTurn, costCentsTotal, finished: true, abortedReason };
      }
    }
  }

  // Mechanical price A/B/C detection: when last rubric failed on price-in-band
  // and user responds to the A/B/C question, parse mechanically and re-run pipeline.
  if (
    userMessage &&
    workingMemory.lastRubric &&
    !workingMemory.lastRubric.passed &&
    !workingMemory.lastRubric.details.priceInBand.ok &&
    workingMemory.priceBand
  ) {
    const msg = userMessage.trim().toLowerCase();
    let priceAction: "override" | "market" | "custom" | null = null;
    let customPrice: number | null = null;

    // Match order: letter → phrase → number → null
    if (/^\s*a\b/i.test(userMessage)) priceAction = "override";
    else if (/^\s*b\b/i.test(userMessage)) priceAction = "market";
    else if (/^\s*c\b/i.test(userMessage)) priceAction = "custom";
    else if (/bei meinem|bleiben/i.test(msg)) priceAction = "override";
    else if (/anheben|marktmitte/i.test(msg)) priceAction = "market";
    else if (/anderer|anderen/i.test(msg)) priceAction = "custom";
    else {
      // Any number in the message → custom price
      const numMatch = msg.replace(/\./g, "").match(/(\d{4,})/);
      if (numMatch) {
        customPrice = parseInt(numMatch[1]);
        priceAction = "custom";
      }
    }

    if (priceAction === "override") {
      workingMemory = applyPatch(workingMemory, { priceOverride: true });
      await prisma.conversationTurn.create({
        data: {
          conversationId: ctx.conversationId,
          role: "SYSTEM",
          content: "[price-override-confirmed]",
          toolName: "system",
          toolOutput: asJson({ memoryPatch: { priceOverride: true } }),
        },
      });
      // Re-run rubric — price-in-band will now pass with override
      if (workingMemory.draft && canAffordChainedTool(costCentsTotal, 5)) {
        const reviewTr = await executeTool("listing_review", {}, workingMemory, turnNumber);
        toolStepsExecuted++;
        costCentsThisTurn += reviewTr.costCents;
        costCentsTotal += reviewTr.costCents;
        if (reviewTr.memoryPatch) workingMemory = applyPatch(workingMemory, reviewTr.memoryPatch);
        await prisma.agentStep.create({ data: { agentRunId: ctx.agentRunId, ordinal: await nextStepOrdinal(ctx.agentRunId), toolName: "listing_review", input: asJson({ priceOverride: true }), output: asJson({ ...reviewTr.output, memoryPatch: reviewTr.memoryPatch }), latencyMs: reviewTr.latencyMs, ok: reviewTr.ok } });
        await prisma.conversationTurn.create({ data: { conversationId: ctx.conversationId, role: "TOOL", content: "listing_review", toolName: "listing_review", toolInput: asJson({}), toolOutput: asJson({ ...reviewTr.output, memoryPatch: reviewTr.memoryPatch }), latencyMs: reviewTr.latencyMs } });
        const result = chainedReviewMessage(workingMemory.lastRubric!, workingMemory.draft!, workingMemory);
        agentMessage = `Ihr Preis von ${workingMemory.askingPrice?.toLocaleString("de-DE")} € wurde übernommen.\n\n${result.message}`;
        return { agentMessage, memory: workingMemory, toolStepsExecuted, costCentsThisTurn, costCentsTotal, finished: false, abortedReason };
      }
    } else if (priceAction === "market" && workingMemory.priceBand) {
      workingMemory = applyPatch(workingMemory, { askingPrice: workingMemory.priceBand.strategyReal });
      await prisma.conversationTurn.create({
        data: {
          conversationId: ctx.conversationId,
          role: "SYSTEM",
          content: "[price-adjusted-to-market]",
          toolName: "system",
          toolOutput: asJson({ memoryPatch: { askingPrice: workingMemory.priceBand!.strategyReal } }),
        },
      });
      if (workingMemory.draft && canAffordChainedTool(costCentsTotal, 5)) {
        const reviewTr = await executeTool("listing_review", {}, workingMemory, turnNumber);
        toolStepsExecuted++;
        costCentsThisTurn += reviewTr.costCents;
        costCentsTotal += reviewTr.costCents;
        if (reviewTr.memoryPatch) workingMemory = applyPatch(workingMemory, reviewTr.memoryPatch);
        await prisma.agentStep.create({ data: { agentRunId: ctx.agentRunId, ordinal: await nextStepOrdinal(ctx.agentRunId), toolName: "listing_review", input: asJson({ priceAdjusted: true }), output: asJson({ ...reviewTr.output, memoryPatch: reviewTr.memoryPatch }), latencyMs: reviewTr.latencyMs, ok: reviewTr.ok } });
        await prisma.conversationTurn.create({ data: { conversationId: ctx.conversationId, role: "TOOL", content: "listing_review", toolName: "listing_review", toolInput: asJson({}), toolOutput: asJson({ ...reviewTr.output, memoryPatch: reviewTr.memoryPatch }), latencyMs: reviewTr.latencyMs } });
        const result = chainedReviewMessage(workingMemory.lastRubric!, workingMemory.draft!, workingMemory);
        agentMessage = `Preis auf ${workingMemory.priceBand!.strategyReal.toLocaleString("de-DE")} € (Marktmitte) angepasst.\n\n${result.message}`;
        return { agentMessage, memory: workingMemory, toolStepsExecuted, costCentsThisTurn, costCentsTotal, finished: false, abortedReason };
      }
    } else if (priceAction === "custom" && customPrice && customPrice > 0) {
      workingMemory = applyPatch(workingMemory, { askingPrice: customPrice });
      await prisma.conversationTurn.create({
        data: {
          conversationId: ctx.conversationId,
          role: "SYSTEM",
          content: `[price-custom-${customPrice}]`,
          toolName: "system",
          toolOutput: asJson({ memoryPatch: { askingPrice: customPrice } }),
        },
      });
      // Fall through to normal LLM processing — it will re-trigger draft+review
    }
    // If nothing matched (priceAction === null), fall through to LLM
  }

  for (let iter = 0; iter < MAX_TOOL_ITERATIONS_PER_TURN; iter++) {
    // Cost-cap pre-check
    if (costCentsTotal >= MAX_COST_CENTS) {
      abortedReason = "cost_cap";
      agentMessage = "Es tut mir leid — die Kostenobergrenze für dieses Gespräch wurde erreicht. Bitte starten Sie ein neues Gespräch oder nutzen Sie das Formular.";
      break;
    }

    const llm = await callLlm({
      messages: messages as unknown as Array<Record<string, unknown>>,
      tools: getToolsSpec(),
      toolChoice: "auto",
      temperature: 0.4,
      maxTokens: workingMemory.costCompressed ? 500 : 1000,
    });
    costCentsThisTurn += llm.usage.costCents;
    costCentsTotal += llm.usage.costCents;

    const msg = llm.message;

    // Persist the LLM call as an AgentStep (input is the prompt summary, output is the assistant message)
    await prisma.agentStep.create({
      data: {
        agentRunId: ctx.agentRunId,
        ordinal: await nextStepOrdinal(ctx.agentRunId),
        toolName: "llm_call",
        input: asJson({ iteration: iter, messages: messages.length }),
        output: asJson({
          finishReason: llm.finishReason,
          usage: { promptTokens: llm.usage.promptTokens, completionTokens: llm.usage.completionTokens, costCents: llm.usage.costCents },
          hasToolCalls: !!msg.tool_calls?.length,
          toolCalls: msg.tool_calls?.map((tc) => tc.function.name) || [],
        }),
        latencyMs: 0,
        ok: true,
      },
    });

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      // Echo assistant's tool_calls into messages
      messages.push({
        role: "assistant",
        content: msg.content,
        tool_calls: msg.tool_calls,
      });

      for (const tc of msg.tool_calls) {
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(tc.function.arguments || "{}");
        } catch {
          parsedArgs = {};
        }
        const tr = await executeTool(tc.function.name, parsedArgs, workingMemory, turnNumber);
        toolStepsExecuted++;
        costCentsThisTurn += tr.costCents;
        costCentsTotal += tr.costCents;
        if (tr.memoryPatch) workingMemory = applyPatch(workingMemory, tr.memoryPatch);

        await prisma.agentStep.create({
          data: {
            agentRunId: ctx.agentRunId,
            ordinal: await nextStepOrdinal(ctx.agentRunId),
            toolName: tc.function.name,
            input: asJson(parsedArgs),
            output: asJson({ ...tr.output, memoryPatch: tr.memoryPatch }),
            latencyMs: tr.latencyMs,
            ok: tr.ok,
          },
        });

        // Persist as a TOOL turn so memory rebuilds correctly
        await prisma.conversationTurn.create({
          data: {
            conversationId: ctx.conversationId,
            role: "TOOL",
            content: tc.function.name,
            toolName: tc.function.name,
            toolInput: asJson(parsedArgs),
            toolOutput: asJson({ ...tr.output, memoryPatch: tr.memoryPatch }),
            latencyMs: tr.latencyMs,
          },
        });

        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          name: tc.function.name,
          content: JSON.stringify(tr.output).slice(0, 4000),
        });

        if (tr.triggerHandoff) {
          finished = true;
        }
      }

      // Mechanical chaining: after ALL tool calls complete, if listing_draft
      // succeeded this iteration, chain listing_review deterministically.
      // Don't give LLM the choice between reviewing and presenting.
      if (!finished && workingMemory.draft && msg.tool_calls.some((tc) => tc.function.name === "listing_draft")) {
        if (!canAffordChainedTool(costCentsTotal, 5)) { // hallucination check ~3-5c
          agentMessage = "Qualitätsprüfung übersprungen aufgrund Budget-Limit. Bitte prüfen Sie den Entwurf manuell auf der nächsten Seite.";
          break;
        }

        const reviewTr = await executeTool("listing_review", {}, workingMemory, turnNumber);
        toolStepsExecuted++;
        costCentsThisTurn += reviewTr.costCents;
        costCentsTotal += reviewTr.costCents;
        if (reviewTr.memoryPatch) workingMemory = applyPatch(workingMemory, reviewTr.memoryPatch);

        await prisma.agentStep.create({
          data: {
            agentRunId: ctx.agentRunId,
            ordinal: await nextStepOrdinal(ctx.agentRunId),
            toolName: "listing_review",
            input: asJson({}),
            output: asJson({ ...reviewTr.output, memoryPatch: reviewTr.memoryPatch }),
            latencyMs: reviewTr.latencyMs,
            ok: reviewTr.ok,
          },
        });

        await prisma.conversationTurn.create({
          data: {
            conversationId: ctx.conversationId,
            role: "TOOL",
            content: "listing_review",
            toolName: "listing_review",
            toolInput: asJson({}),
            toolOutput: asJson({ ...reviewTr.output, memoryPatch: reviewTr.memoryPatch }),
            latencyMs: reviewTr.latencyMs,
          },
        });

        const reviewResult = chainedReviewMessage(workingMemory.lastRubric!, workingMemory.draft!, workingMemory);
        agentMessage = reviewResult.message;
        break; // exit iter loop — deterministic message set
      }

      if (finished) break;
      if (agentMessage) break;
      // Continue loop: feed tool results back to LLM
      continue;
    }

    // No tool calls → assistant message is the user-facing turn
    agentMessage = msg.content || "";
    break;
  }

  if (!agentMessage && !finished) {
    if (!abortedReason) {
      abortedReason = "max_iterations";
      agentMessage = "Einen Moment bitte — ich versuche es erneut.";
    }
  }

  // Parse any inline ###MEMORY### block (backwards compatible)
  if (agentMessage) {
    const parsed = parseInlineMemory(agentMessage);
    agentMessage = parsed.cleaned;
    if (parsed.patch) workingMemory = applyPatch(workingMemory, parsed.patch);
  }

  // Dual-pass extraction: dedicated LLM call to reliably extract data
  if (userMessage && agentMessage && costCentsTotal < MAX_COST_CENTS) {
    // Find the last agent message from history to give the extraction context
    const lastAgentMsg = [...history].reverse().find(m => m.role === "assistant")?.content || "";
    const ext = await extractMemoryFromMessage(lastAgentMsg, userMessage, workingMemory, ctx.agentRunId, turnNumber);
    costCentsThisTurn += ext.costCents;
    costCentsTotal += ext.costCents;
    if (ext.patch) {
      workingMemory = applyPatch(workingMemory, ext.patch);
      // Persist as TOOL turn so rebuildMemory picks up the patch
      await prisma.conversationTurn.create({
        data: {
          conversationId: ctx.conversationId,
          role: "TOOL",
          content: "memory_extract",
          toolName: "memory_extract",
          toolInput: asJson({ userMessage: userMessage.slice(0, 200) }),
          toolOutput: asJson({ memoryPatch: ext.patch }),
          latencyMs: 0,
        },
      });
    }
  }

  // Mechanical chaining: address_validate fires when address is complete but not yet validated.
  // Counts toward toolStepsExecuted (same as listing_review chain — all mechanical
  // chains are full tool executions with audit trail, not "free" calls).
  // Capped at MAX_ADDRESS_VALIDATION_ATTEMPTS per conversation to avoid infinite retry on bad addresses.
  if (
    workingMemory.street && workingMemory.houseNumber &&
    workingMemory.postcode && workingMemory.city &&
    !workingMemory.addressValidated &&
    workingMemory.addressValidationAttempts < MAX_ADDRESS_VALIDATION_ATTEMPTS &&
    canAffordChainedTool(costCentsTotal, 0) // Nominatim is free
  ) {
    const addrTr = await executeTool("address_validate", {}, workingMemory, turnNumber);
    toolStepsExecuted++;
    costCentsThisTurn += addrTr.costCents;
    costCentsTotal += addrTr.costCents;
    const addrPatch: MemoryPatch = {
      ...(addrTr.memoryPatch || {}),
      addressValidationAttempts: workingMemory.addressValidationAttempts + 1,
    };
    workingMemory = applyPatch(workingMemory, addrPatch);

    await prisma.agentStep.create({
      data: {
        agentRunId: ctx.agentRunId,
        ordinal: await nextStepOrdinal(ctx.agentRunId),
        toolName: "address_validate",
        input: asJson({ street: workingMemory.street, houseNumber: workingMemory.houseNumber, postcode: workingMemory.postcode, city: workingMemory.city }),
        output: asJson({ ...addrTr.output, memoryPatch: addrPatch }),
        latencyMs: addrTr.latencyMs,
        ok: addrTr.ok,
      },
    });

    await prisma.conversationTurn.create({
      data: {
        conversationId: ctx.conversationId,
        role: "TOOL",
        content: "address_validate",
        toolName: "address_validate",
        toolInput: asJson({ street: workingMemory.street, houseNumber: workingMemory.houseNumber }),
        toolOutput: asJson({ ...addrTr.output, memoryPatch: addrPatch }),
        latencyMs: addrTr.latencyMs,
      },
    });
  }

  return {
    agentMessage,
    memory: workingMemory,
    toolStepsExecuted,
    costCentsThisTurn,
    costCentsTotal,
    finished,
    abortedReason,
  };
}

async function nextStepOrdinal(agentRunId: string): Promise<number> {
  const last = await prisma.agentStep.findFirst({
    where: { agentRunId },
    orderBy: { ordinal: "desc" },
    select: { ordinal: true },
  });
  return (last?.ordinal ?? -1) + 1;
}

// ────────────────────────────────────────────────────────────────────────
// Initial greeting (used when conversation is created)
// ────────────────────────────────────────────────────────────────────────

export async function generateInitialGreeting(ctx: AgentRunContext): Promise<{ message: string; costCents: number }> {
  const llm = await callLlm({
    messages: [
      { role: "system", content: ORCHESTRATOR_SYSTEM_PROMPT },
      { role: "system", content: buildMemoryContext(INITIAL_MEMORY) },
      { role: "user", content: "Begrüße mich kurz und frage nach dem Immobilientyp." },
    ] as unknown as Array<Record<string, unknown>>,
    temperature: 0.5,
    maxTokens: 250,
  });

  await prisma.agentStep.create({
    data: {
      agentRunId: ctx.agentRunId,
      ordinal: 0,
      toolName: "llm_call",
      input: asJson({ kind: "greeting" }),
      output: asJson({ usage: llm.usage }),
      latencyMs: 0,
      ok: true,
    },
  });

  const cleaned = (llm.message.content || "Willkommen beim Direkta Exposé-Assistenten. Welchen Immobilientyp möchten Sie verkaufen?").replace(/###MEMORY###[\s\S]*?###END###/g, "").trim();
  return { message: cleaned, costCents: llm.usage.costCents };
}
