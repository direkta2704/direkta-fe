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
export const MAX_COST_CENTS = 500;           // ≈ €5 per run
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
  caption?: string;         // room name for exposé (e.g. "Wohn-/Essbereich mit Küchenanschlüssen")
  description?: string;     // 2-3 sentence exposé description of what's visible
  lighting?: string;        // e.g. "Nachmittagslicht", "Neutrales Tageslicht"
  estimatedArea?: number;   // estimated room area in m² (from visual cues)
  isRendering?: boolean;    // true if photo is a 3D visualization/CGI
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
    floorPlans?: { ok: boolean; missingUnits?: string[] };
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
  extras?: PropertyExtra[];
}

export interface PropertyExtra {
  name: string;
  quantity: number;
  pricePerUnit: number;
  description?: string;
  optional?: boolean;
  minQuantity?: number;
  area?: number;
  subtype?: string;
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
  extras: PropertyExtra[];
  specifications: Record<string, Record<string, string>>;
  skippedFields: string[];
  fieldAskCount: Record<string, number>;
  barrierefrei: boolean | null;
  // Expose enrichment
  sellerContact: { name?: string; company?: string; phone?: string; email?: string } | null;
  roomProgram: { name: string; area: number }[];
  draftRevisionCount: number;
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
  extras: [],
  specifications: {},
  skippedFields: [],
  fieldAskCount: {},
  barrierefrei: null,
  sellerContact: null,
  roomProgram: [],
  draftRevisionCount: 0,
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
  if (m.hasEnergyCert && !m.energyValidUntil) missing.push("Gültig bis (Energieausweis)");
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

type ConversationalGroup = "identity" | "core" | "mfh_structure" | "details" | "energy" | "media";

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

// Explicit group order: identity/core first, then MFH structure, then details
// (rooms, year, attributes — these improve pricing + listing quality),
// then energy (GEG required), then media (photos/floorplan) last.
// Previous computed order put details LAST (0.9) which meant rooms/year/attributes
// were never asked before photos triggered the pricing pipeline.

const FIELD_PRIORITY: FieldSpec[] = [
  // ── identity: can't do anything without these ──
  { field: "type",        group: "identity", blocksPricing: true,  blocksPublish: true,  infoValue: 1,   optional: false, isFilled: wm => !!wm.type,        prompt: "Was für eine Immobilie möchten Sie verkaufen? (Wohnung, Haus, Mehrfamilienhaus, …)" },
  { field: "street",      group: "identity", blocksPricing: true,  blocksPublish: true,  infoValue: 1,   optional: false, isFilled: wm => !!wm.street,      prompt: "In welcher Straße liegt die Immobilie?" },
  { field: "houseNumber", group: "identity", blocksPricing: true,  blocksPublish: true,  infoValue: 1,   optional: false, isFilled: wm => !!wm.houseNumber, prompt: "Welche Hausnummer?" },
  { field: "postcode",    group: "identity", blocksPricing: true,  blocksPublish: true,  infoValue: 1,   optional: false, isFilled: wm => !!wm.postcode,    prompt: "Wie lautet die Postleitzahl?" },
  { field: "city",        group: "identity", blocksPricing: true,  blocksPublish: true,  infoValue: 1,   optional: false, isFilled: wm => !!wm.city,        prompt: "In welcher Stadt?" },
  // ── core: mandatory for pricing pipeline ──
  { field: "livingArea",  group: "core",     blocksPricing: true,  blocksPublish: true,  infoValue: 1,   optional: false, isFilled: wm => !!wm.livingArea,  prompt: "Wie groß ist die Wohnfläche in m²?" },
  { field: "condition",   group: "core",     blocksPricing: true,  blocksPublish: true,  infoValue: 0.8, optional: false, isFilled: wm => !!wm.condition,   prompt: "In welchem Zustand ist die Immobilie? (Gepflegt, Erstbezug, Kernsaniert, Neubau, Renovierungsbedürftig, …)" },
  // ── details: improve listing quality, asked before energy/media ──
  { field: "rooms",       group: "details",  blocksPricing: false, blocksPublish: false, infoValue: 0.8, optional: true,  isFilled: wm => wm.rooms != null, prompt: "Wie viele Zimmer hat die Immobilie?" },
  { field: "yearBuilt",   group: "details",  blocksPricing: false, blocksPublish: false, infoValue: 0.7, optional: true,  isFilled: wm => wm.yearBuilt != null, prompt: "Wann wurde das Gebäude gebaut (Baujahr)?" },
  { field: "bathrooms",   group: "details",  blocksPricing: false, blocksPublish: false, infoValue: 0.5, optional: true,  isFilled: wm => wm.bathrooms != null, prompt: "Wie viele Badezimmer?" },
  { field: "floor",       group: "details",  blocksPricing: false, blocksPublish: false, infoValue: 0.4, optional: true,  isFilled: wm => wm.type === "EFH" || wm.type === "MFH" || wm.floor != null, prompt: "In welchem Stockwerk liegt die Wohnung?" },
  { field: "plotArea",    group: "details",  blocksPricing: false, blocksPublish: true,  infoValue: 0.7, optional: false, isFilled: wm => wm.type === "ETW" || wm.plotArea != null, prompt: "Wie groß ist das Grundstück in m²?" },
  { field: "attributes",  group: "details",  blocksPricing: false, blocksPublish: false, infoValue: 0.6, optional: true,  isFilled: wm => wm.attributes.length > 0, prompt: "Welche Ausstattung hat die Immobilie? (Balkon, Keller, Garten, Stellplatz, …)" },
  { field: "heatingType", group: "details", blocksPricing: false, blocksPublish: true, infoValue: 0.7, optional: false, isFilled: wm => !!(wm.specifications["Heizung & Warmwasser"]?.["Typ"] || wm.specifications["Heizung & Warmwasser"]?.["Heizungsart"] || wm.specifications["Heizung & Warmwasser"]?.["Art"]), prompt: "Welche Heizungsart hat die Immobilie? (Gas-Zentralheizung, Wärmepumpe, Fernwärme, Fußbodenheizung, Öl, Pellets, …)" },
  { field: "windowType", group: "details", blocksPricing: false, blocksPublish: false, infoValue: 0.5, optional: true, isFilled: wm => !!(wm.specifications["Tueren & Fenster"]?.["Fenster"] || wm.specifications["Tueren & Fenster"]?.["Typ"] || wm.specifications["Tueren & Fenster"]?.["Fenstertyp"]), prompt: "Welche Art von Fenstern? (Kunststoff, Holz, Alu, Dreifachverglasung, …)" },
  { field: "flooringType", group: "details", blocksPricing: false, blocksPublish: false, infoValue: 0.5, optional: true, isFilled: wm => !!(wm.specifications["Boden"]?.["Wohnbereich"] || wm.specifications["Boden"]?.["Typ"] || wm.specifications["Boden"]?.["Bodenbelag"]), prompt: "Welcher Bodenbelag ist in den Haupträumen? (Parkett, Laminat, Fliesen, Vinyl, …)" },
  { field: "basementType", group: "details", blocksPricing: false, blocksPublish: false, infoValue: 0.5, optional: true, isFilled: wm => wm.attributes.some(a => a.toLowerCase().includes("kein keller")) || !!(wm.specifications["Keller"]?.["Typ"] || wm.specifications["Keller"]?.["Art"]), prompt: "Hat die Immobilie einen Keller? Wenn ja: Vollkeller, Teilkeller oder Kellerabteil? Ist er trocken und nutzbar?" },
  { field: "specifications", group: "details", blocksPricing: false, blocksPublish: false, infoValue: 0.4, optional: true, isFilled: wm => Object.keys(wm.specifications).length >= 3, prompt: "Weitere Ausstattungsdetails? Z.B. Küche (Einbauküche?), Sanitär (Badewanne/Dusche), Smart Home, Dachtyp (Satteldach/Flachdach)?" },
  { field: "renovationScope", group: "details", blocksPricing: false, blocksPublish: false, infoValue: 0.6, optional: true, isFilled: wm => !["RENOVIERUNGS_BEDUERFTIG", "SANIERUNGS_BEDUERFTIG"].includes(wm.condition || "") || !!wm.specifications["Sanierungsbedarf"]?.["Umfang"], prompt: "Was muss renoviert/saniert werden? (Dach, Fenster, Heizung, Elektrik, Sanitär, Fassade, …)" },
  { field: "barrierefrei", group: "details", blocksPricing: false, blocksPublish: false, infoValue: 0.5, optional: true, isFilled: wm => wm.barrierefrei != null, prompt: "Ist die Immobilie barrierefrei oder barrierearm zugänglich?" },
  { field: "unitCount",   group: "mfh_structure", blocksPricing: false, blocksPublish: true,  infoValue: 1.0, optional: false, isFilled: wm => wm.type !== "MFH" || wm.unitCount != null, prompt: "Wie viele Wohneinheiten hat das Gebäude?" },
  { field: "units",       group: "mfh_structure", blocksPricing: false, blocksPublish: true,  infoValue: 1.0, optional: false, isFilled: wm => wm.type !== "MFH" || (wm.unitCount != null && wm.units.length >= wm.unitCount), prompt: "Bitte beschreiben Sie die einzelnen Wohnungen (Größe, Zimmer, Stockwerk)." },
  { field: "sellingMode", group: "mfh_structure", blocksPricing: false, blocksPublish: true,  infoValue: 0.9, optional: false, isFilled: wm => wm.type !== "MFH" || wm.sellingMode != null, prompt: "Wie möchten Sie verkaufen? Einzeln, als Paket, oder beides?" },
  { field: "unitPhotos",  group: "mfh_structure", blocksPricing: false, blocksPublish: false, infoValue: 0.8, optional: true,  isFilled: wm => wm.type !== "MFH" || wm.units.length === 0 || wm.units.every(u => wm.uploads.some(p => p.kind === "PHOTO" && p.unitLabel === u.label)), prompt: "Haben Sie separate Fotos für die einzelnen Wohnungen? Laden Sie sie jetzt hoch — sie werden automatisch der aktuellen Wohnung zugeordnet." },
  { field: "unitFloorPlans", group: "mfh_structure", blocksPricing: false, blocksPublish: false, infoValue: 0.7, optional: true, isFilled: wm => wm.type !== "MFH" || wm.units.length === 0 || wm.units.every(u => wm.uploads.some(p => p.kind === "FLOORPLAN" && p.unitLabel === u.label)), prompt: "Haben Sie Grundrisse für die einzelnen Wohnungen? Nutzen Sie den 📐-Button." },
  { field: "extras",      group: "mfh_structure", blocksPricing: false, blocksPublish: false, infoValue: 0.7, optional: true,  isFilled: wm => wm.extras.length > 0 || (wm.type !== "MFH" && wm.type !== "EFH"), prompt: "Hat die Immobilie Extras wie Stellplätze oder Kellerabteile? Wenn ja: Art (z.B. Tiefgarage/Außen/Carport), Anzahl, Preis pro Stück, Größe in m² bei Keller/Garten, und ob der Kauf optional oder Pflicht ist." },
  // ── energy: GEG legally required ──
  { field: "hasEnergyCert", group: "energy", blocksPricing: false, blocksPublish: true,  infoValue: 0.9, optional: false, isFilled: wm => wm.hasEnergyCert !== null, prompt: "Haben Sie einen Energieausweis für die Immobilie?" },
  { field: "energyClass",  group: "energy", blocksPricing: false, blocksPublish: true,  infoValue: 0.5, optional: false, isFilled: wm => !wm.hasEnergyCert || !!wm.energyClass, prompt: "Welche Energieklasse steht im Ausweis?" },
  { field: "energyValue",  group: "energy", blocksPricing: false, blocksPublish: true,  infoValue: 0.5, optional: false, isFilled: wm => !wm.hasEnergyCert || wm.energyValue != null, prompt: "Wie hoch ist der Energieverbrauch in kWh/(m²·a)?" },
  { field: "energySource", group: "energy", blocksPricing: false, blocksPublish: true,  infoValue: 0.5, optional: false, isFilled: wm => !wm.hasEnergyCert || !!wm.energySource, prompt: "Was ist der wesentliche Energieträger? (Gas, Öl, Fernwärme, …)" },
  { field: "energyValidUntil", group: "energy", blocksPricing: false, blocksPublish: true,  infoValue: 0.4, optional: false, isFilled: wm => !wm.hasEnergyCert || !!wm.energyValidUntil, prompt: "Bis wann ist der Energieausweis gültig? (Datum, z.B. 2034-05-15)" },
  // ── media: uploads + enrichment, last group ──
  { field: "photos",        group: "media", blocksPricing: false, blocksPublish: true,  infoValue: 0.5, optional: false, isFilled: wm => wm.uploads.filter(u => u.kind === "PHOTO").length >= 1, prompt: "Bitte laden Sie Fotos hoch. Nutzen Sie den 📷-Button links unten." },
  { field: "floorPlan",     group: "media", blocksPricing: false, blocksPublish: false, infoValue: 0.6, optional: true,  isFilled: wm => wm.hasFloorPlan || wm.uploads.some(u => u.kind === "FLOORPLAN"), prompt: "Haben Sie einen Grundriss? Nutzen Sie den 📐-Button." },
  { field: "roomProgram",   group: "media", blocksPricing: false, blocksPublish: false, infoValue: 0.3, optional: true,  isFilled: wm => wm.roomProgram.length > 0, prompt: "Möchten Sie die einzelnen Räume mit Größe angeben? Z.B. Wohnzimmer 25m², Küche 12m²" },
  { field: "sellerContact", group: "media", blocksPricing: false, blocksPublish: false, infoValue: 0.3, optional: true,  isFilled: wm => !!(wm.sellerContact?.name || wm.sellerContact?.company || wm.sellerContact?.phone || wm.sellerContact?.email), prompt: "Welche Kontaktdaten sollen im Exposé stehen? (Name, Telefon, E-Mail)" },
];

const GROUP_ORDER: Record<ConversationalGroup, number> = {
  identity: 0,
  core: 1,
  details: 2,
  media: 3,
  energy: 4,
  mfh_structure: 5,
};

export function nextQuestion(wm: WorkingMemory): QuestionResult {
  const photoCount = wm.uploads.filter(u => u.kind === "PHOTO").length;
  const ready = isReadyForDraft(wm);

  // Pipeline phases — only fire AFTER all questions are exhausted
  if (wm.draft && wm.lastRubric?.passed) return { action: "wait_confirm", priority: 100 };
  if (wm.priceBand && !wm.draft && wm.askingPrice != null) return { action: "trigger_draft", priority: 100 };

  // Collect unfilled fields
  const candidates: { field: string; group: ConversationalGroup; prompt: string; priority: number; tiebreaker: number }[] = [];
  for (let i = 0; i < FIELD_PRIORITY.length; i++) {
    const spec = FIELD_PRIORITY[i];
    if (spec.isFilled(wm)) continue;
    if (wm.costCompressed && spec.optional) continue;
    if (spec.optional && wm.skippedFields.includes(spec.field)) continue;
    if ((wm.fieldAskCount[spec.field] || 0) >= 2) continue;
    const priority = (spec.blocksPricing ? 4 : 0) + (spec.blocksPublish ? 2 : 0) + spec.infoValue;
    candidates.push({ field: spec.field, group: spec.group, prompt: spec.prompt, priority, tiebreaker: i });
  }

  // No more questions — trigger pricing if ready, otherwise signal completion
  if (candidates.length === 0) {
    if (ready && photoCount >= 1 && !wm.priceBand) return { action: "trigger_pricing", priority: 100 };
    return { action: "trigger_pricing", priority: 0 };
  }

  // Sort: group order first, then priority descending, then definition order
  candidates.sort((a, b) =>
    GROUP_ORDER[a.group] - GROUP_ORDER[b.group] ||
    b.priority - a.priority ||
    a.tiebreaker - b.tiebreaker
  );

  const best = candidates[0];

  // Dynamic prompt for MFH units — acknowledge captured units, guide to next
  if (best.field === "units" && wm.type === "MFH" && wm.unitCount) {
    const captured = wm.units.length;
    const total = wm.unitCount;
    if (captured > 0 && captured < total) {
      const last = wm.units[captured - 1];
      best.prompt = `✓ ${last.label} erfasst (${last.livingArea || "?"}m², ${last.rooms || "?"}Zi). Weiter mit Wohnung ${captured + 1} von ${total} — bitte Bezeichnung, Größe, Zimmer, Bäder und Stockwerk angeben.`;
    } else if (captured === 0) {
      best.prompt = `Perfekt, ${total} Wohneinheiten. Gehen wir sie einzeln durch. Starten wir mit Wohnung 1 — bitte Bezeichnung (z.B. WE 01), Größe in m², Zimmer, Bäder und Stockwerk angeben.`;
    }
  }

  // Dynamic prompt for per-unit photos — ask for the FIRST unit missing photos
  // Also set currentUnit so uploads get tagged with the right unit label
  if (best.field === "unitPhotos" && wm.type === "MFH" && wm.units.length > 0) {
    const missingUnit = wm.units.find(u => !wm.uploads.some(p => p.kind === "PHOTO" && p.unitLabel === u.label));
    if (missingUnit) {
      wm.currentUnit = missingUnit.label;
      best.prompt = `Haben Sie Innenfotos für ${missingUnit.label} (${missingUnit.livingArea || "?"}m², ${missingUnit.rooms || "?"}Zi)? Laden Sie sie jetzt hoch — nutzen Sie den 📷-Button. Die Fotos werden ${missingUnit.label} zugeordnet.`;
    }
  }

  // Dynamic prompt for per-unit floor plans — ask for the FIRST unit missing a plan
  if (best.field === "unitFloorPlans" && wm.type === "MFH" && wm.units.length > 0) {
    const missingUnit = wm.units.find(u => !wm.uploads.some(p => p.kind === "FLOORPLAN" && p.unitLabel === u.label));
    if (missingUnit) {
      wm.currentUnit = missingUnit.label;
      best.prompt = `Haben Sie einen Grundriss für ${missingUnit.label}? Nutzen Sie den 📐-Button.`;
    }
  }

  return { action: best.field === "photos" || best.field === "unitPhotos" ? "upload_photos" : "ask", field: best.field, prompt: best.prompt, priority: best.priority };
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
    [wm.uploads.filter(u => u.kind === "PHOTO").length >= 1, 20],
    [wm.uploads.some(u => u.kind === "FLOORPLAN") || wm.hasFloorPlan, 6],
    [!!wm.priceBand, 10],
    [!!wm.draft, 10],
  ];
  const photoCount = wm.uploads.filter(u => u.kind === "PHOTO").length;
  const photoPartial = Math.min(photoCount / 1, 1) * 20;
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
  KERNSANIERT: "Kernsaniert",
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
  if (m.roomProgram.length) lines.push(`Raumprogramm: ${m.roomProgram.map(r => `${r.name} ${r.area}m²`).join(", ")}`);
  if (m.barrierefrei != null) lines.push(`Barrierefrei: ${m.barrierefrei ? "Ja" : "Nein"}`);
  if (m.extras.length) lines.push(`Extras: ${m.extras.map(e => `${e.quantity}× ${e.name}${e.subtype ? ` (${e.subtype})` : ""}${e.area ? ` ${e.area}m²` : ""}${e.pricePerUnit ? ` ${e.pricePerUnit.toLocaleString("de")}€/Stk` : ""}${e.optional ? " [optional]" : ""}`).join(", ")}`);
  if (Object.keys(m.specifications).length > 0) {
    for (const [cat, entries] of Object.entries(m.specifications)) {
      const vals = Object.entries(entries).map(([k, v]) => `${k}: ${v}`).join(", ");
      lines.push(`${cat}: ${vals}`);
    }
  }
  if (m.units.length > 0) {
    lines.push(`Wohneinheiten: ${m.units.map(u => `${u.label} (${u.livingArea}m², ${u.rooms}Zi${u.askingPrice ? `, ${u.askingPrice.toLocaleString("de")}€` : ""})`).join(", ")}`);
  }
  if (m.priceBand) lines.push(`Preisband: ${m.priceBand.low.toLocaleString("de")}–${m.priceBand.high.toLocaleString("de")} € (${m.priceBand.confidence})`);
  if (m.askingPrice) lines.push(`Wunschpreis: ${m.askingPrice.toLocaleString("de")} €`);
  // Photo classifications — feeds into draft generation with room-level detail
  const classifiedPhotos = m.uploads
    .filter(u => u.kind === "PHOTO" && u.classification && u.classification.qualityScore >= 40)
    .slice(0, 12);
  if (classifiedPhotos.length) {
    const photoLines = classifiedPhotos.map(u => {
      const c = u.classification!;
      const parts = [c.caption || c.roomType];
      if (c.description) parts.push(c.description);
      if (c.features?.length) parts.push(`Erkannte Merkmale: ${c.features.join(", ")}`);
      if (c.lighting) parts.push(`Licht: ${c.lighting}`);
      if (c.estimatedArea) parts.push(`~${c.estimatedArea} m²`);
      if (c.isRendering) parts.push("[Rendering/Visualisierung]");
      return `- ${parts.join(" — ")}`;
    });
    lines.push(`\nFOTO-ERKENNTNISSE (aus KI-Analyse — diese Fakten sind belegt):\n${photoLines.join("\n")}`);
  }
  return lines.join("\n");
}

// Photo quality coaching: grouped improvement advice after batch analysis
export function buildPhotoQualityCoaching(uploads: PhotoUpload[]): string | null {
  const photos = uploads.filter(u => u.kind === "PHOTO" && u.classification);
  if (photos.length === 0) return null;

  const avgScore = photos.reduce((s, p) => s + p.classification!.qualityScore, 0) / photos.length;
  if (avgScore >= 65) return null;

  // Group quality flags across all photos
  const flagCounts: Record<string, string[]> = {};
  for (const p of photos) {
    for (const flag of p.classification!.qualityFlags) {
      if (!flagCounts[flag]) flagCounts[flag] = [];
      flagCounts[flag].push(p.classification!.caption || p.classification!.roomType);
    }
  }

  const tips: string[] = [];
  const flagTips: Record<string, string> = {
    dark: "Fotografieren Sie bei Tageslicht mit offenen Vorhängen und eingeschalteten Lampen.",
    blur: "Halten Sie die Kamera ruhig oder nutzen Sie ein Stativ. Tippen Sie zum Fokussieren auf den Bildschirm.",
    cluttered: "Räumen Sie persönliche Gegenstände weg — leere Flächen wirken professioneller.",
    tilted: "Halten Sie die Kamera gerade. Aktivieren Sie die Gitter-Anzeige in der Kamera-App.",
    perspective_distortion: "Fotografieren Sie mit dem normalen Objektiv (1x), nicht Weitwinkel (0.5x).",
    overexposed: "Vermeiden Sie direktes Gegenlicht. Fotografieren Sie nicht bei Sonnenschein durchs Fenster.",
    low_resolution: "Verwenden Sie die volle Auflösung Ihrer Kamera.",
  };

  for (const [flag, rooms] of Object.entries(flagCounts)) {
    if (rooms.length >= 2 && flagTips[flag]) {
      tips.push(`**${rooms.length} von ${photos.length} Fotos** (${rooms.slice(0, 3).join(", ")}): ${flagTips[flag]}`);
    }
  }

  if (tips.length === 0) return null;

  const lines = [`Die Fotoqualität liegt bei durchschnittlich ${Math.round(avgScore)}/100. Folgende Verbesserungen erhöhen die Anfragequote:`];
  lines.push(...tips);
  if (avgScore < 45) {
    lines.push("\nMöchten Sie die Fotos ersetzen? Bessere Fotos erhöhen die Anfragequote deutlich.");
  }
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
    perspective_distortion (Weitwinkel-/Ultraweitwinkel-Verzerrung — Gebäude kippen nach hinten, gebogene Linien, typisch für 0.5x iPhone-Objektiv),
  "qualityScore": 0-100 (Bewertung für Immobilieninserat: Belichtung, Schärfe, Komposition, Aufgeräumtheit),
  "features": Array erkannter Merkmale z.B. ["einbaukueche", "parkettboden", "balkon", "dachschraege", "kamin", "fussbodenheizung", "garten", "terrasse", "garage", "aufzug", "neubau", "altbau"],
  "suggestion": kurzer Verbesserungshinweis für den Verkäufer (nur wenn qualityScore < 70, sonst null),
  "caption": präziser Raumname für das Exposé, z.B. "Wohn-/Essbereich mit Küchenanschlüssen", "Schlafzimmer mit Blick zur Ankleide", "Bad mit bodengleicher Dusche", "Fassade Straßenseite",
  "description": 2-3 Sätze für ein hochwertiges Immobilienexposé. Beschreibe sachlich was im Foto sichtbar ist: Materialien, Oberflächen, Raumgefühl, Lichtverhältnisse, besondere Merkmale. Stil: professionell, wertschätzend, konkret.,
  "lighting": Lichtverhältnisse im Foto, z.B. "Weiches Vormittagslicht", "Neutrales Tageslicht", "Späte Nachmittagssonne", "Kunstlicht", "Diffuses Nordlicht",
  "estimatedArea": geschätzte Raumfläche in m² basierend auf visuellen Hinweisen (Türgröße ~2m als Referenz). Nur bei Innenräumen, null bei Außenaufnahmen.,
  "isRendering": true/false — ist dieses Foto eine 3D-Visualisierung, ein Rendering oder ein CGI-Bild? Hinweise: perfekte Oberflächen ohne natürliche Unregelmäßigkeiten, computergenerierte Möbel/Dekoration, unrealistische Lichtverhältnisse, fehlende Gebrauchsspuren. false bei echten Fotos.
}
Regeln:
- "floorplan" NUR wenn das Bild ein technischer Grundriss/Bauplan ist.
- "exterior" für Außenansichten des Gebäudes, Fassade, Eingang.
- "features" soll sichtbare Ausstattungsmerkmale der Immobilie auflisten — nur was im Foto erkennbar ist.
- "suggestion" soll kurz und hilfreich sein, z.B. "Bitte bei Tageslicht erneut fotografieren" oder "Persönliche Gegenstände entfernen". Bei perspective_distortion: "Bitte mit normalem Objektiv (1x) aus größerer Entfernung fotografieren — Weitwinkel verzerrt das Gebäude."
- "caption" soll ein präziser, spezifischer Raumtitel sein — nicht generisch wie "Zimmer" sondern beschreibend wie "Offene Wohnküche mit Gartenblick".
- "description" soll NUR beschreiben was tatsächlich sichtbar ist. Keine Vermutungen, keine erfundenen Details. Sachlich und wertschätzend.
- "isRendering" prüfe sorgfältig ob es ein 3D-Rendering/Visualisierung ist. Bei Renderings muss das im Exposé gekennzeichnet werden.
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
  const caption = typeof parsed.caption === "string" ? parsed.caption : undefined;
  const description = typeof parsed.description === "string" ? parsed.description : undefined;
  const lighting = typeof parsed.lighting === "string" ? parsed.lighting : undefined;
  const estimatedArea = typeof parsed.estimatedArea === "number" ? parsed.estimatedArea : undefined;
  const isRendering = typeof parsed.isRendering === "boolean" ? parsed.isRendering : undefined;

  return {
    ok: true,
    classification: { roomType, qualityFlags, qualityScore, features, suggestion, caption, description, lighting, estimatedArea, isRendering },
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
  Absatz 1 (~120 Wörter): Die Immobilie — Typ, Lage, Größe, Zimmer, Bäder, Zustand, besondere Ausstattung. Wenn Ausstattungsdetails vorhanden (Boden, Heizung, etc.), erwähne diese KONKRET: "Eichenparkett in den Wohnräumen, Fliesen in den Bädern" statt "hochwertiger Bodenbelag". Wenn Extras vorhanden (Stellplätze, Keller), erwähne diese mit Anzahl.
  Absatz 2 (~100 Wörter): Die Umgebung — Stadt, Stadtteil, Infrastruktur, Nahversorgung, Schulen, ÖPNV, Natur, Freizeitangebote. Allgemein aber plausibel basierend auf PLZ/Stadt.
  Absatz 3 (~100 Wörter): Die Gelegenheit — Zielgruppe, Preis-Leistung, Investitionspotenzial, Energie-Hinweis mit konkreten Werten. Wenn Extras mit Preisen vorhanden, erwähne den Gesamtwert.
  WICHTIG: Jeder Absatz muss MINDESTENS 80 Wörter haben. Schreibe ausführlich und detailliert.

REGELN:
- STRENG: Beschreibe NUR Fakten aus den Daten. ERFINDE NICHTS.
- VERBOTEN: "lichtdurchflutet", "großzügig", "geräumig", "modern ausgestattet", "ideal für", "bestens geeignet", "sofort einziehen", "attraktiv", "hervorragend", "durchdacht", "optimal" — diese Wörter NIEMALS verwenden, sie sind nicht durch Daten belegbar.
- VERBOTEN: Aussagen über Raumgefühl, Atmosphäre, Lichtverhältnisse — das ist nicht aus Daten ableitbar.
- STATTDESSEN: Verwende konkrete Zahlen und Fakten. "3 Zimmer auf 95 m²" statt "großzügige Zimmer". "Baujahr 1999, gepflegter Zustand" statt "hervorragend instand gehalten".
- Wenn ein Merkmal NICHT in den Daten steht, erwähne es NICHT. Kein "könnte", "eignet sich", "bietet Potenzial".
- KEINE Ausrufezeichen
- KEINE Superlative: "einmalig", "konkurrenzlos", "atemberaubend", "traumhaft", "perfekt", "sensationell"
- Beende den 3. Absatz mit dem Standard-Energieausweis-Hinweis (falls Energiedaten vorhanden): "Energieausweis: [Typ], Klasse [X], [Y] kWh/(m²·a), [Energieträger]."
- NEGIERE NIEMALS bestätigte Daten ("Wohnfläche nicht spezifiziert" wenn Wohnfläche vorhanden ist)
- Der Text muss eine Faktenprüfung gegen die Quelldaten bestehen. Jede konkrete Aussage muss in den Daten stehen.`;

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

// Self-healing: revise a draft to fix specific rubric failures without seller involvement
async function reviseDraft(
  currentDraft: DraftResult,
  rubric: RubricResult,
  m: WorkingMemory,
): Promise<{ ok: boolean; draft?: DraftResult; costCents: number }> {
  const fixInstructions: string[] = [];
  if (!rubric.details.wordCount.ok) {
    const w = rubric.details.wordCount.words || 0;
    const p = rubric.details.wordCount.paragraphs || 0;
    if (w < 230) fixInstructions.push(`Text hat nur ${w} Wörter — erweitere auf mindestens 300 Wörter mit konkreten Details aus den Quelldaten.`);
    else if (w > 600) fixInstructions.push(`Text hat ${w} Wörter — kürze auf maximal 500 Wörter, entferne Wiederholungen.`);
    if (p < 2 || p > 4) fixInstructions.push(`Text hat ${p} Absätze — strukturiere in genau 3 Absätze (getrennt durch \\n\\n).`);
  }
  if (!rubric.details.noHallucination.ok && rubric.details.noHallucination.flagged?.length) {
    fixInstructions.push(`ENTFERNE diese unbelegten Behauptungen: ${rubric.details.noHallucination.flagged.join("; ")}. Ersetze durch belegbare Fakten aus den Quelldaten.`);
  }
  if (!rubric.details.noSuperlatives.ok && rubric.details.noSuperlatives.found?.length) {
    fixInstructions.push(`ERSETZE diese verbotenen Superlative: ${rubric.details.noSuperlatives.found.join(", ")}. Verwende stattdessen konkrete Fakten.`);
  }
  if (fixInstructions.length === 0) return { ok: false, costCents: 0 };

  const ctx = summarizeProperty(m);
  const result = await callLlm({
    model: DRAFT_MODEL,
    messages: [
      { role: "system", content: `Du bist ein Immobilientext-Editor. Überarbeite den gegebenen Exposé-Text und behebe NUR die genannten Probleme. Behalte Stil und Struktur bei. Antwort als JSON: { "descriptionLong": string }\n\nQUELLDATEN:\n${ctx}` },
      { role: "user", content: `AKTUELLER TEXT:\n${currentDraft.descriptionLong}\n\nPROBLEME ZU BEHEBEN:\n${fixInstructions.join("\n")}` },
    ],
    responseFormat: { type: "json_object" },
    temperature: 0.4,
    maxTokens: 2000,
  });
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(result.message.content || "{}"); } catch { return { ok: false, costCents: result.usage.costCents }; }
  if (typeof parsed.descriptionLong !== "string") return { ok: false, costCents: result.usage.costCents };
  return {
    ok: true,
    draft: { ...currentDraft, descriptionLong: parsed.descriptionLong as string },
    costCents: result.usage.costCents,
  };
}

function isAgentFixableRubric(rubric: RubricResult): boolean {
  if (rubric.passed) return false;
  const nonFixable = [!rubric.details.gegFields.ok, !rubric.details.photos.ok, !rubric.details.priceInBand.ok, rubric.details.floorPlans && !rubric.details.floorPlans.ok];
  return !nonFixable.some(Boolean);
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
  const gegOk = m.hasEnergyCert === false || !!(m.energyCertType && m.energyClass && m.energyValue && m.energySource && m.energyValidUntil);
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

  // 5. Photos: ≥1
  const photos = m.uploads.filter((u) => u.kind === "PHOTO" || u.kind === "FLOORPLAN");
  const photoCount = photos.length;
  const photosOk = photoCount >= 1;
  if (photoCount < 1) failures.push("Mindestens 1 Foto erforderlich");

  // 5b. Per-unit floor plans (MFH bundles)
  // Building-level floor plans count as fallback for all units
  let floorPlanDetails: { ok: boolean; missingUnits?: string[] } = { ok: true };
  if (m.type === "MFH" && m.units.length > 0) {
    const hasBuildingFloorPlan = m.uploads.some(u => u.kind === "FLOORPLAN" && !u.unitLabel);
    if (!hasBuildingFloorPlan) {
      const missing: string[] = [];
      for (const unit of m.units) {
        const hasFloorPlan = m.uploads.some(u => u.kind === "FLOORPLAN" && u.unitLabel === unit.label);
        if (!hasFloorPlan) missing.push(unit.label);
      }
      if (missing.length > 0) {
        floorPlanDetails = { ok: false, missingUnits: missing };
        failures.push(`Grundriss fehlt für: ${missing.join(", ")}`);
      }
    }
  }

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
        gegFields: { ok: gegOk, reason: gegOk ? undefined : (() => {
          const missing: string[] = [];
          if (m.hasEnergyCert && !m.energyCertType) missing.push("energyCertType");
          if (m.hasEnergyCert && !m.energyClass) missing.push("energyClass");
          if (m.hasEnergyCert && m.energyValue == null) missing.push("energyValue");
          if (m.hasEnergyCert && !m.energySource) missing.push("energySource");
          if (m.hasEnergyCert && !m.energyValidUntil) missing.push("energyValidUntil");
          return missing.length > 0 ? `fehlend: ${missing.join(", ")}` : "fehlende Felder";
        })() },
        wordCount: wcDetails,
        noHallucination: hallDetails,
        noSuperlatives: supDetails,
        photos: { ok: photosOk, count: photoCount },
        floorPlans: floorPlanDetails,
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
  if (!rubric.details.gegFields.ok && wm) {
    const missingGeg: string[] = [];
    if (wm.hasEnergyCert && !wm.energyCertType) missingGeg.push("Ausweistyp (Verbrauch oder Bedarf)");
    if (wm.hasEnergyCert && !wm.energyClass) missingGeg.push("Energieklasse");
    if (wm.hasEnergyCert && wm.energyValue == null) missingGeg.push("Energieverbrauch (kWh/m²·a)");
    if (wm.hasEnergyCert && !wm.energySource) missingGeg.push("Primärenergieträger");
    if (wm.hasEnergyCert && !wm.energyValidUntil) missingGeg.push("Gültigkeitsdatum des Energieausweises (z.B. 2034-05-15)");
    if (missingGeg.length > 0) {
      questions.push(`Bitte ergänzen Sie die fehlenden Energieausweis-Daten: ${missingGeg.join(", ")}.`);
    } else {
      questions.push("Bitte ergänzen Sie die fehlenden Energieausweis-Daten.");
    }
  } else if (!rubric.details.gegFields.ok) {
    questions.push("Bitte ergänzen Sie die fehlenden Energieausweis-Daten.");
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
    questions.push("Bitte laden Sie mindestens ein Foto hoch. Nutzen Sie den 📷-Button links unten.");
  }
  if (rubric.details.floorPlans && !rubric.details.floorPlans.ok && rubric.details.floorPlans.missingUnits) {
    questions.push(`Für folgende Wohneinheiten fehlt ein Grundriss: ${rubric.details.floorPlans.missingUnits.join(", ")}. Bitte laden Sie die fehlenden Grundrisse hoch (📐-Button).`);
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

// Deterministic message after pricing — presents recommendation and asks seller.
export function buildPriceRecommendationMessage(wm: WorkingMemory): string {
  const band = wm.priceBand!;
  const lines: string[] = [];
  lines.push("Die Preise für Ihre Immobilie wurden berechnet:");
  lines.push("");
  lines.push(`• **Preis pro m²:** ${band.pricePerSqm.toLocaleString("de-DE")} €`);
  lines.push(`• **Preisband:** ${band.low.toLocaleString("de-DE")} – ${band.high.toLocaleString("de-DE")} € (Konfidenz: ${band.confidence})`);
  lines.push(`  - Schnellverkauf: ${band.strategyQuick.toLocaleString("de-DE")} €`);
  lines.push(`  - Realistisch: ${band.strategyReal.toLocaleString("de-DE")} €`);
  lines.push(`  - Maximum: ${band.strategyMax.toLocaleString("de-DE")} €`);

  if (wm.type === "MFH" && wm.units.some(u => u.askingPrice)) {
    const unitTotal = wm.units.reduce((s, u) => s + (u.askingPrice || 0), 0);
    const extrasTotal = wm.extras.reduce((s, e) => s + e.quantity * e.pricePerUnit, 0);
    lines.push("");
    lines.push("**Ihre Wohneinheiten:**");
    for (const u of wm.units) {
      if (u.askingPrice) lines.push(`  - ${u.label}: ${u.askingPrice.toLocaleString("de-DE")} €`);
    }
    if (extrasTotal > 0) {
      lines.push(`  - Extras: ${extrasTotal.toLocaleString("de-DE")} €`);
    }
    lines.push(`  - **Gesamt: ${(unitTotal + extrasTotal).toLocaleString("de-DE")} €**`);
  }

  lines.push("");
  if (wm.askingPrice) {
    lines.push(`Welchen Preis möchten Sie für Ihr Inserat verwenden?`);
    lines.push(`A) Bei ${wm.askingPrice.toLocaleString("de-DE")} € bleiben`);
    lines.push(`B) Empfohlener Preis: ${band.strategyReal.toLocaleString("de-DE")} € (Marktmitte)`);
    lines.push(`C) Einen anderen Preis nennen`);
  } else {
    lines.push(`Welchen Preis möchten Sie für Ihr Inserat?`);
    lines.push(`A) Empfohlener Preis: ${band.strategyReal.toLocaleString("de-DE")} € (Marktmitte)`);
    lines.push(`B) Einen eigenen Preis nennen`);
  }

  return lines.join("\n");
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
  __removeUploadKey?: string;
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
          let askPrice = memory.askingPrice;
          // MFH with individual unit prices: compute bundle = sum(units) + sum(extras)
          if (memory.type === "MFH" && memory.units.some(u => u.askingPrice)) {
            const unitTotal = memory.units.reduce((s, u) => s + (u.askingPrice || 0), 0);
            const extrasTotal = memory.extras.reduce((s, e) => s + e.quantity * e.pricePerUnit, 0);
            const bundlePrice = unitTotal + extrasTotal;
            if (bundlePrice > 0) askPrice = bundlePrice;
          }
          memoryPatch = { priceBand: r.band, askingPrice: askPrice ?? null };
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

export function applyPatch(memory: WorkingMemory, patch: MemoryPatch): WorkingMemory {
  const next = { ...memory, uploads: [...memory.uploads] };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (k === "__removeUploadKey" && typeof v === "string") {
      next.uploads = next.uploads.filter((u) => u.storageKey !== v);
      if (next.uploads.filter(u => u.kind === "FLOORPLAN").length === 0) next.hasFloorPlan = false;
      continue;
    }
    if (k === "__uploadClassifications" && v && typeof v === "object") {
      const map = v as Record<number, PhotoClassification>;
      for (const [idxStr, cls] of Object.entries(map)) {
        const i = Number(idxStr);
        if (i >= 0 && i < next.uploads.length) {
          next.uploads[i] = { ...next.uploads[i], classification: cls };
        }
      }
      // Auto-merge photo-detected features into attributes
      const featureToAttribute: Record<string, string> = {
        einbaukueche: "Einbauküche", parkettboden: "Parkett", fussbodenheizung: "Fußbodenheizung",
        balkon: "Balkon", garten: "Garten", terrasse: "Terrasse", kamin: "Kamin",
        aufzug: "Aufzug", garage: "Garage", dachschraege: "Dachschräge", keller: "Keller",
        smart_home: "Smart Home", photovoltaik: "Photovoltaik", pool: "Pool",
        sauna: "Sauna", carport: "Carport",
      };
      const photoFeatures = new Set(next.attributes);
      for (const cls of Object.values(map)) {
        if (cls.qualityScore >= 50 && cls.features) {
          for (const f of cls.features) {
            const attr = featureToAttribute[f];
            if (attr) photoFeatures.add(attr);
          }
        }
      }
      next.attributes = Array.from(photoFeatures);
    } else if (k === "uploads" && Array.isArray(v)) {
      next.uploads = [...next.uploads, ...(v as PhotoUpload[])];
    } else if (k === "attributes" && Array.isArray(v)) {
      const merged = new Set([...next.attributes, ...(v as string[])]);
      next.attributes = Array.from(merged);
    } else if (k === "assumptions" && Array.isArray(v)) {
      const merged = new Set([...next.assumptions, ...(v as string[])]);
      next.assumptions = Array.from(merged);
    } else if (k === "units" && Array.isArray(v)) {
      const incoming = v as UnitData[];
      const merged = [...next.units];
      for (const u of incoming) {
        const idx = merged.findIndex(m => m.label === u.label);
        if (idx >= 0) merged[idx] = u;
        else merged.push(u);
      }
      next.units = merged;
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
    } else if (k === "skippedFields" && Array.isArray(v)) {
      const merged = new Set([...next.skippedFields, ...(v as string[])]);
      next.skippedFields = Array.from(merged);
    } else if (k === "extras" && Array.isArray(v)) {
      const incoming = v as PropertyExtra[];
      const existing = new Map(next.extras.map(e => [e.name, e]));
      for (const e of incoming) existing.set(e.name, e);
      next.extras = Array.from(existing.values());
    } else if (k === "specifications" && v && typeof v === "object" && !Array.isArray(v)) {
      const incoming = v as Record<string, Record<string, string>>;
      const merged = { ...next.specifications };
      for (const [cat, entries] of Object.entries(incoming)) {
        merged[cat] = { ...(merged[cat] || {}), ...entries };
      }
      next.specifications = merged;
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
  if (m.uploads.filter((u) => u.kind === "PHOTO").length < 1) return "photos";
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

MODUS A — BULK (BEVORZUGT — Verkäufer gibt viele Daten auf einmal):
1. Zeige eine ✓-Liste ALLER erkannten Daten — Typ, Adresse, Fläche, Zimmer, Bäder, Baujahr, Zustand, Ausstattung, Energie, Preis
2. Bei MFH: zeige auch alle erkannten Einheiten mit Größe/Zimmer/Etage UND die Verkaufsart
3. Liste NUR was FEHLT (prüfe Working Memory!) — typischerweise: Fotos, Grundriss
4. Wenn nur Fotos/Grundriss fehlen → sage das direkt, weise auf die Buttons hin
5. Wenn Pflichtfelder fehlen → frage nach dem ERSTEN fehlenden
6. FRAGE NIEMALS nach Daten die bereits im Working Memory stehen!
7. Wenn der Verkäufer ein bestehendes Inserat einfügt → extrahiere ALLE Daten, zeige ✓-Liste

MODUS B — DIALOG (Verkäufer antwortet einzeln):
Stelle pro Nachricht NUR EINE Frage. Folge der Empfehlung im ">>> NÄCHSTE AKTION <<<" Feld des Working Memory.

═══ GESPRÄCHSABLAUF (ALLE TYPEN) ═══

PHASE 1 — IMMOBILIE VERSTEHEN:
Typ → Adresse → Wohnfläche → Zustand → Zimmer → Bäder → Baujahr → Etage (ETW) / Grundstück (EFH/DHH/RH/MFH) → Heizungsart → Ausstattung → Fenster → Bodenbelag → Keller

PHASE 2 — FOTOS & DOKUMENTE:
"Jetzt brauche ich Fotos und Dokumente von Ihrer Immobilie."
→ Fotos (📷-Button) → Grundriss (📐-Button) → Energieausweis (⚡-Button oder manuelle Eingabe)
Fotos werden automatisch analysiert — die KI erkennt Räume, Ausstattung und Qualität.

PHASE 3 — NUR BEI MFH (Mehrfamilienhaus):
"Jetzt gehen wir die einzelnen Wohnungen durch."
→ Anzahl Wohneinheiten → Einzelne Wohnungen (je: Label, Fläche, Zimmer, Etage, Besonderheiten)
→ Fotos pro Wohnung → Grundrisse pro Wohnung
→ Verkaufsart (Einzeln / Paket / Beides)
→ Extras (Stellplätze, Kellerabteile mit Preisen)

PHASE 4 — PREISEMPFEHLUNG:
Wenn alle Daten + Fotos vorhanden → pricing_recommend automatisch
→ Zeige Preisband + Strategien (Schnellverkauf / Realistisch / Maximum)
→ Frage: "Möchten Sie den empfohlenen Preis verwenden oder einen eigenen festlegen?"

PHASE 5 — EXPOSÉ ERSTELLEN:
→ listing_draft → listing_review → Verkäufer bestätigt → handoff_commit

═══ AUTOMATISCHE TOOL-AUFRUFE ═══

Rufe Tools SOFORT auf — frage NICHT erst um Erlaubnis:
• address_validate → wenn Adresse komplett im Memory
• pricing_recommend → wenn ALLE Pflichtfelder gesetzt (Typ, Adresse, Fläche, Zustand) UND Fotos hochgeladen
• listing_draft → SOFORT nach erfolgreichem pricing_recommend
• listing_review → SOFORT nach listing_draft
• handoff_commit → NUR wenn rubric bestanden UND Verkäufer "ja" sagt

═══ EXTRAS & STELLPLÄTZE ═══

Nach den Wohnungen (MFH) oder nach der Ausstattung (ETW/EFH), frage:
"Hat die Immobilie Extras wie Stellplätze, Kellerabteile oder Garagen, die separat bepreist werden?"

Erfasse: Name (z.B. TG-Stellplatz, Außenstellplatz, Kellerabteil, Garage), Anzahl, Preis pro Stück.
Beispiel-Eingabe: "6 TG-Stellplätze à 15.000€, 10 Außenstellplätze à 8.000€, 3 Kellerabteile à 5.000€"
Speichere als extras: [{ name: "TG-Stellplatz", quantity: 6, pricePerUnit: 15000 }, ...]

Wenn der Verkäufer nur "Stellplatz" als Ausstattung nennt ohne Preis → als Attribut speichern, nicht als Extra.
Extras haben IMMER einen Stückpreis. Ohne Preis → nachfragen: "Was kostet ein Stellplatz?"

═══ AUSSTATTUNGSDETAILS (PASSIV) ═══

Wenn der Verkäufer Details zu Materialien/Ausstattung nennt, ordne sie automatisch der richtigen Kategorie zu:
• "Parkett" / "Laminat" / "Fliesen" / "Vinyl" → Boden
• "Stuck" / "Tapete" / "Putz" → Waende & Decke
• "Regendusche" / "Badewanne" / "Duschbad" → Sanitaer
• "Fußbodenheizung" / "Gas-Brennwert" / "Wärmepumpe" / "Fernwärme" → Heizung & Warmwasser
• "Smart Home" / "KNX" / "Photovoltaik" → Elektro & Smart Home
• "Einbauküche" / "Granitarbeitsplatte" / "Kochinsel" → Kueche
• "Kunststofffenster" / "Holzfenster" / "Dreifachverglasung" → Tueren & Fenster

Speichere als specifications: { "Boden": { "Wohnbereich": "Eichenparkett" }, ... }
Frage NICHT aktiv nach jeder Kategorie — extrahiere was der Verkäufer von sich aus sagt.

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
- Wenn keine Fotos: "Bitte laden Sie Fotos hoch. Nutzen Sie den 📷-Button."

NACH ENERGIEAUSWEIS-UPLOAD:
- Prüfe die erkannten Werte im Memory: "Energieausweis erkannt: [Typ], Klasse [X], [Y] kWh/(m²·a). Stimmt das?"
- Wenn Werte fehlen: "Einige Werte konnten nicht ausgelesen werden. Bitte ergänzen Sie: [fehlende Felder]"

AUTOMATISCHE PIPELINE:
Wenn Fotos im Memory UND alle Pflichtfelder gesetzt:
→ Rufe SOFORT pricing_recommend auf
→ Dann listing_draft
→ Dann listing_review
→ Zeige dem Verkäufer den Entwurf und frage nach Bestätigung

═══ MEHRFAMILIENHAUS (MFH) — STRUKTURIERTER ABLAUF ═══

WICHTIG: MFH-Einheiten kommen NACH den Gebäudefotos und dem Energieausweis! Erst das Gebäude verstehen, dann die Wohnungen.

SCHRITT 1 — GEBÄUDE ERFASSEN (Phasen 1+2):
Sammle zuerst alle Gebäude-Daten (wie bei jedem anderen Typ): Adresse, Fläche, Zustand, Baujahr, Heizung, etc.
Dann Fotos vom Gebäude (Außenansicht, Treppenhaus), Gebäude-Grundriss, Energieausweis.

SCHRITT 2 — WOHNUNGEN (Phase 3):
Sage: "Perfekt, das Gebäude ist erfasst. Jetzt gehen wir die Wohnungen einzeln durch."
1. "Wie viele Wohneinheiten hat das Gebäude?"
2. Für JEDE Wohnung: Label, Fläche, Zimmer, Bäder, Stockwerk, Besonderheiten
3. Für JEDE Wohnung: "Haben Sie Fotos für [Label]?" + "Grundriss für [Label]?"
4. Verkaufsart: Einzeln / Paket / Beides (empfohlen)
5. Extras: Stellplätze, Kellerabteile mit Preisen

WICHTIG: Akzeptiere Bulk-Eingaben! "WE1 95m² 3Zi EG, WE2 55m² 2Zi 1.OG" → erfasse ALLE auf einmal.

UPLOAD-KONTEXT: Setze currentUnit im Memory wenn du zu einer Wohnung wechselst. null für Gebäude-Ebene.

MFH-INTELLIGENZ:
• Vererbung: Baujahr, Zustand, Energieausweis vom Gebäude gelten für alle Einheiten
• "Gleich wie oben" → vorherige Daten übernehmen
• "Keine eigenen Fotos" → Gebäudefotos für alle verwenden
• Plausibilitätsprüfung: Gesamtfläche Einheiten ≈ Gebäude-Wohnfläche

═══ INTELLIGENZ & ANTI-LOOP ═══

DATEN-INTELLIGENZ:
• "Weiß ich nicht" / "skip" / "keine Ahnung" → Pflichtfeld: Standardwert vorschlagen. Optional: überspringen. Frage NICHT nochmal nach demselben Feld!
• "Gleiche wie oben" / "selbe" / "wie vorher" → vorherige Werte übernehmen
• Plausibilität prüfen: 250m² + 3 Zimmer bei MFH? → nachfragen. 10m² Wohnfläche? → "Meinten Sie 100 m²?"
• Energieausweis-PDF nicht lesbar → manuelle Eingabe akzeptieren, weiter
• Adresse nicht validierbar → akzeptieren, weiter
• Pricing fehlgeschlagen → zeige fehlende Felder
• UNGEFÄHRE ANGABEN AKZEPTIEREN: "ca. 120qm", "vielleicht 130", "so 4-5 Zimmer" → nimm den Mittelwert oder den wahrscheinlicheren Wert. Sage "Ich habe 125 m² notiert — Sie können das später korrigieren."
• PREIS NICHT BEKANNT: Wenn der Verkäufer keinen Preis weiß → "Kein Problem, ich berechne eine Markteinschätzung sobald alle Daten vorliegen."
• NATÜRLICHE SPRACHE: "gut" = GEPFLEGT, "muss renoviert werden" = RENOVIERUNGS_BEDUERFTIG, "frisch saniert" = KERNSANIERT, "neuwertig" = NEUBAU, "Rohbau" = ROHBAU

ANTI-LOOP — VERMEIDE ENDLOSSCHLEIFEN:
• Wenn du bereits 2x nach demselben Feld gefragt hast → überspringen oder Standardwert setzen. NIEMALS ein drittes Mal fragen.
• Wenn der Verkäufer "weiter" / "nächste" / "egal" sagt → akzeptiere es und gehe zum nächsten Schritt.
• Wenn der Verkäufer eine Frage ignoriert und stattdessen etwas anderes sagt → extrahiere was er gesagt hat und gehe weiter.
• Wenn alle Pflichtfelder gefüllt sind aber der Verkäufer weiter chattet → erkenne dass er fertig ist und starte die Pipeline.
• MAXIMAL 3 Nachfragen zu optionalen Feldern insgesamt. Danach: "Die restlichen Details können Sie später im Inserat ergänzen."

KONFUSION ERKENNEN:
• Wenn der Verkäufer widersprüchliche Angaben macht (z.B. "4 Zimmer" dann "nein, 3 Zimmer") → nimm die LETZTE Angabe und sage "Verstanden, ich habe 3 Zimmer notiert."
• Wenn der Verkäufer Unsinn schreibt oder testet → antworte freundlich: "Ich konnte diese Eingabe leider nicht zuordnen. Könnten Sie mir [konkretes fehlendes Feld] mitteilen?"
• Wenn der Verkäufer auf Englisch schreibt → antworte auf Deutsch, extrahiere die Daten trotzdem
• Wenn der Verkäufer "hallo" oder Smalltalk schreibt → kurz grüßen, dann direkt zum nächsten fehlenden Feld
• Wenn der Verkäufer den Prozess nicht versteht → EINMAL kurz erklären (max 3 Sätze), dann weitermachen

FRUSTRIERTE VERKÄUFER:
• "Das dauert zu lange" / "zu viele Fragen" → "Verstanden! Lassen Sie uns abkürzen. Ich brauche nur noch: [1-2 fehlende Pflichtfelder]. Den Rest können Sie später ergänzen."
• "Ich will nur schnell ein Inserat" → überspringe ALLE optionalen Felder, frage nur Pflichtfelder
• "Vergessen Sie es" / "Abbrechen" → "Kein Problem! Ihre bisherigen Daten sind gespeichert. Sie können jederzeit hier fortfahren oder das Formular nutzen."
• Leere Nachricht oder nur Leerzeichen → "Möchten Sie fortfahren? Ich brauche noch [nächstes Pflichtfeld]."

NEU STARTEN:
• "Von vorne" / "nochmal" / "reset" / "neu anfangen" → "Alles klar, wir starten neu! Was für eine Immobilie möchten Sie verkaufen?"
  ABER: Lösche KEINE Daten aus dem Working Memory. Der Verkäufer meint meistens "andere Frage stellen", nicht "alle Daten löschen".

COPY-PASTE ERKENNEN:
• Wenn der Nutzer einen langen Text schickt (>500 Zeichen) mit vielen Daten → BULK-MODUS: Extrahiere ALLES, zeige ✓-Liste
• Wenn es wie ein Inserat aussieht (enthält "Exposé", "Objektbeschreibung", "Energieausweis") → "Ich sehe, Sie haben ein bestehendes Inserat. Ich übernehme die Daten daraus."

FORTSCHRITT SICHERSTELLEN:
• Nach jeder Antwort: prüfe das Working Memory. Wenn sich NICHTS geändert hat → versuche einen anderen Ansatz oder überspringe optionale Felder.
• Wenn completeness > 80% → fokussiere nur noch auf fehlende Pflichtfelder (Energie, Fotos)
• Wenn der Verkäufer seit 3 Nachrichten keine neuen Daten liefert → zusammenfassen was fehlt und fragen "Möchten Sie die restlichen Felder überspringen?"

═══ FOTO-ANLEITUNG ═══

Wenn Fotos fehlen, weise auf die Buttons links unten hin UND gib konkrete Foto-Tipps:
📷 Foto-Button — für Fotos
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
ZUSTAND: ERSTBEZUG, NEUBAU, GEPFLEGT, RENOVIERUNGS_BEDUERFTIG, SANIERUNGS_BEDUERFTIG, ROHBAU, KERNSANIERT
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
Barrierefrei: ${m.barrierefrei === true ? "Ja" : m.barrierefrei === false ? "Nein" : "—"}
Energie: ${m.hasEnergyCert === null ? "—" : m.hasEnergyCert ? `${m.energyClass || "?"} (${m.energyValue || "?"} kWh, ${m.energySource || "?"}, gültig bis ${m.energyValidUntil || "?"})` : "kein Ausweis"}
Fotos hochgeladen: ${m.uploads.filter((u) => u.kind === "PHOTO" && !u.unitLabel).length} (Gebäude)${m.units.length > 0 ? m.units.map((u) => {
    const unitPhotos = m.uploads.filter((p) => p.kind === "PHOTO" && p.unitLabel === u.label).length;
    const unitPlans = m.uploads.filter((p) => p.kind === "FLOORPLAN" && p.unitLabel === u.label).length;
    return ` | ${u.label}: ${unitPhotos} Fotos, ${unitPlans} Grundrisse`;
  }).join("") : ""}
Grundrisse hochgeladen: ${m.uploads.filter((u) => u.kind === "FLOORPLAN" && !u.unitLabel).length} (Gebäude)${m.type === "MFH" ? `
Wohneinheiten: ${m.unitCount ?? "—"} (erfasst: ${m.units.length}${m.unitCount != null && m.units.length < m.unitCount ? `, noch ${m.unitCount - m.units.length} fehlen` : ""})
Einheiten-Daten: ${m.units.length > 0 ? m.units.map((u) => `${u.label}: ${u.livingArea || "?"}m², ${u.rooms || "?"}Zi, ${u.bathrooms || "?"}Bad, ${u.floor != null ? "EG+" + u.floor : "?"}. OG`).join(" | ") : "—"}
Verkaufsart: ${m.sellingMode || "—"}` : ""}
Preisband: ${m.priceBand ? `${m.priceBand.low.toLocaleString("de")}–${m.priceBand.high.toLocaleString("de")} € (${m.priceBand.confidence})` : "—"}
Wunschpreis: ${m.askingPrice ? `${m.askingPrice.toLocaleString("de")} €` : "—"}
Entwurf vorhanden: ${m.draft ? "ja" : "nein"}
Letzte Rubric: ${m.lastRubric ? (m.lastRubric.passed ? "✓ bestanden" : `✗ ${m.lastRubric.failures.join("; ")}`) : "—"}
Aktuelle Wohnung (Upload-Kontext): ${m.currentUnit || "Gebäude"}
Extras: ${m.extras.length > 0 ? m.extras.map((e: PropertyExtra) => `${e.name} ×${e.quantity}${e.pricePerUnit ? ` à ${e.pricePerUnit.toLocaleString("de")}€` : ""}`).join(", ") : "—"}
Ausstattungsdetails: ${Object.keys(m.specifications).length > 0 ? Object.entries(m.specifications).map(([cat, entries]) => `${cat}: ${Object.entries(entries).map(([k, v]) => `${k}=${v}`).join(", ")}`).join(" | ") : "—"}
Raumprogramm: ${m.roomProgram.length > 0 ? m.roomProgram.map((r) => `${r.name} ${r.area}m²`).join(", ") : "—"}
Kontaktdaten: ${m.sellerContact ? [m.sellerContact.name, m.sellerContact.company, m.sellerContact.phone, m.sellerContact.email].filter(Boolean).join(", ") : "—"}
Handoff bereit: ${m.handoffReady ? "ja" : "nein"}
Vollständigkeit: ${score}%

>>> NÄCHSTE AKTION (FOLGE DIESER ANWEISUNG): ${q.action === "ask" ? `Stelle diese Frage: "${q.prompt}"` : q.action === "upload_photos" ? `Bitte um Foto-Upload: "${q.prompt}"` : q.action === "trigger_pricing" ? "→ Rufe JETZT pricing_recommend auf" : q.action === "trigger_draft" ? "→ Rufe JETZT listing_draft auf" : "→ Warte auf Bestätigung des Verkäufers"}${q.field ? ` [Feld: ${q.field}]` : ""} <<<${m.lastRubric && !m.lastRubric.passed ? `\nRubric-Fehler: ${rubricFailureToQuestions(m.lastRubric, m).join(" | ")}` : ""}${m.costCompressed ? "\n\n[KOSTEN-MODUS] Budget knapp. Antworte kurz (max 2 Sätze). Überspringe optionale Felder (Zimmer, Bäder, Etage, Grundstück, Raumprogramm, Kontaktdaten). Frage nur Pflichtfelder." : ""}`;
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
  if (typeof data.yearBuilt === "number") {
    patch.yearBuilt = data.yearBuilt < 100 ? 1900 + data.yearBuilt : data.yearBuilt;
  }
  if (typeof data.rooms === "number") patch.rooms = data.rooms;
  if (typeof data.bathrooms === "number") patch.bathrooms = data.bathrooms;
  if (typeof data.floor === "number") patch.floor = data.floor;
  else if (typeof data.floor === "string") {
    const floorMap: Record<string, number> = {
      eg: 0, erdgeschoss: 0, parterre: 0,
      "1. og": 1, "1.og": 1, "1 og": 1,
      "2. og": 2, "2.og": 2, "2 og": 2,
      "3. og": 3, "3.og": 3, "3 og": 3,
      dg: 99, dachgeschoss: 99,
      ug: -1, untergeschoss: -1, keller: -1,
    };
    const fl = floorMap[data.floor.toLowerCase().trim()];
    if (fl !== undefined) patch.floor = fl;
    else { const n = parseInt(data.floor); if (!isNaN(n)) patch.floor = n; }
  }
  if (typeof data.condition === "string") {
    const map: Record<string, string> = {
      erstbezug: "ERSTBEZUG", neubau: "NEUBAU", gepflegt: "GEPFLEGT",
      "renovierungsbedürftig": "RENOVIERUNGS_BEDUERFTIG", renovierungsbeduerftig: "RENOVIERUNGS_BEDUERFTIG",
      "sanierungsbedürftig": "SANIERUNGS_BEDUERFTIG", sanierungsbeduerftig: "SANIERUNGS_BEDUERFTIG",
      rohbau: "ROHBAU",
      kernsaniert: "KERNSANIERT", "kern-saniert": "KERNSANIERT", "komplett saniert": "KERNSANIERT",
    };
    patch.condition = map[data.condition.toLowerCase()] || data.condition.toUpperCase();
  }
  if (Array.isArray(data.attributes)) {
    const abbrMap: Record<string, string> = {
      fbh: "Fußbodenheizung", blk: "Balkon", tg: "Tiefgarage",
      ga: "Garten", stpl: "Stellplatz", "tg-stellplatz": "Tiefgaragen-Stellplatz",
      ev: "Aufzug", keller: "Keller", terrasse: "Terrasse",
    };
    patch.attributes = data.attributes.map((a: unknown) => {
      const s = String(a).trim();
      return abbrMap[s.toLowerCase()] || s;
    });
  }
  if (typeof data.hasEnergyCert === "boolean") patch.hasEnergyCert = data.hasEnergyCert;
  if (typeof data.energyCertType === "string") patch.energyCertType = data.energyCertType.toUpperCase();
  if (typeof data.energyClass === "string") patch.energyClass = data.energyClass;
  if (typeof data.energyValue === "number") patch.energyValue = data.energyValue;
  if (typeof data.energySource === "string") patch.energySource = data.energySource;
  if (typeof data.energyValidUntil === "string") patch.energyValidUntil = data.energyValidUntil;
  if (typeof data.askingPrice === "number") patch.askingPrice = data.askingPrice;
  else if (typeof data.askingPrice === "string") {
    const priceStr = data.askingPrice.toLowerCase().replace(/[€\s]/g, "");
    if (/mio/i.test(priceStr)) {
      const n = parseFloat(priceStr.replace(/[^0-9.,]/g, "").replace(",", "."));
      if (!isNaN(n)) patch.askingPrice = Math.round(n * 1_000_000);
    } else if (/k$/i.test(priceStr)) {
      const n = parseFloat(priceStr.replace(/[^0-9.,]/g, "").replace(",", "."));
      if (!isNaN(n)) patch.askingPrice = Math.round(n * 1000);
    } else {
      const n = parseInt(priceStr.replace(/\./g, "").replace(",", "."));
      if (!isNaN(n) && n > 0) patch.askingPrice = n;
    }
  }
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
      ...(Array.isArray(u.extras) ? { extras: (u.extras as Record<string, unknown>[]).map(e => ({
        name: String(e.name || ""),
        quantity: typeof e.quantity === "number" ? e.quantity : 1,
        pricePerUnit: typeof e.pricePerUnit === "number" ? e.pricePerUnit : 0,
        ...(typeof e.description === "string" && e.description ? { description: e.description } : {}),
        ...(typeof e.optional === "boolean" ? { optional: e.optional } : {}),
        ...(typeof e.minQuantity === "number" ? { minQuantity: e.minQuantity } : {}),
        ...(typeof e.area === "number" ? { area: e.area } : {}),
        ...(typeof e.subtype === "string" && e.subtype ? { subtype: e.subtype } : {}),
      })).filter(e => e.name) } : {}),
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
  if (Array.isArray(data.extras)) {
    patch.extras = data.extras.map((e: Record<string, unknown>) => ({
      name: String(e.name || ""),
      quantity: typeof e.quantity === "number" ? e.quantity : 1,
      pricePerUnit: typeof e.pricePerUnit === "number" ? e.pricePerUnit : 0,
      ...(typeof e.description === "string" && e.description ? { description: e.description } : {}),
      ...(typeof e.optional === "boolean" ? { optional: e.optional } : {}),
      ...(typeof e.minQuantity === "number" ? { minQuantity: e.minQuantity } : {}),
      ...(typeof e.area === "number" ? { area: e.area } : {}),
      ...(typeof e.subtype === "string" && e.subtype ? { subtype: e.subtype } : {}),
    })).filter((e: PropertyExtra) => e.name);
  }
  // Backward compat: convert flat parking counts to extras
  if (typeof data.outdoorParking === "number" && !Array.isArray(data.extras)) {
    const ex: PropertyExtra[] = patch.extras ? [...patch.extras] : [];
    ex.push({ name: "Außenstellplatz", quantity: data.outdoorParking as number, pricePerUnit: 0 });
    patch.extras = ex;
  }
  if (typeof data.undergroundParking === "number" && !Array.isArray(data.extras)) {
    const ex: PropertyExtra[] = patch.extras ? [...patch.extras] : [];
    ex.push({ name: "TG-Stellplatz", quantity: data.undergroundParking as number, pricePerUnit: 0 });
    patch.extras = ex;
  }
  if (data.specifications && typeof data.specifications === "object" && !Array.isArray(data.specifications)) {
    const specs = data.specifications as Record<string, Record<string, string>>;
    // Normalize spec keys so isFilled checks work regardless of LLM key choice
    for (const [cat, entries] of Object.entries(specs)) {
      if (!entries || typeof entries !== "object") continue;
      if (cat === "Heizung & Warmwasser" || cat === "Heizung") {
        const val = entries["Heizungsart"] || entries["Art"] || entries["Typ"];
        if (val && !entries["Typ"]) { entries["Typ"] = val; }
      }
      if (cat === "Tueren & Fenster" || cat === "Fenster") {
        const val = entries["Fenstertyp"] || entries["Art"] || entries["Typ"] || entries["Fenster"];
        if (val && !entries["Fenster"]) { entries["Fenster"] = val; }
      }
      if (cat === "Boden") {
        const val = entries["Bodenbelag"] || entries["Typ"] || entries["Art"] || entries["Wohnbereich"];
        if (val && !entries["Wohnbereich"]) { entries["Wohnbereich"] = val; }
      }
      if (cat === "Keller") {
        const val = entries["Kellertyp"] || entries["Art"] || entries["Typ"];
        if (val && !entries["Typ"]) { entries["Typ"] = val; }
      }
      if (cat === "Dach") {
        const val = entries["Dachtyp"] || entries["Art"] || entries["Typ"];
        if (val && !entries["Typ"]) { entries["Typ"] = val; }
      }
    }
    // Normalize category names
    if (specs["Heizung"] && !specs["Heizung & Warmwasser"]) { specs["Heizung & Warmwasser"] = specs["Heizung"]; delete specs["Heizung"]; }
    if (specs["Fenster"] && !specs["Tueren & Fenster"]) { specs["Tueren & Fenster"] = specs["Fenster"]; delete specs["Fenster"]; }
    patch.specifications = specs;
  }
  if (typeof data.hasFloorPlan === "boolean") patch.hasFloorPlan = data.hasFloorPlan;
  if (typeof data.barrierefrei === "boolean") patch.barrierefrei = data.barrierefrei;
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

  let prompt = `Extrahiere Immobiliendaten aus dem Dialog. Der Agent hat eine Frage gestellt und der Nutzer hat geantwortet. Gib NUR ein JSON-Objekt zurück.

Bereits bekannt: ${known || "nichts"}

Agent fragte: "${agentQuestion}"
Nutzer antwortete: "${userMessage}"

WICHTIG: Extrahiere ALLE erkennbaren Daten aus der Antwort. Bei Bulk-Eingaben mit vielen Daten, extrahiere ALLES auf einmal.

FORMATE ERKENNEN:
- "BJ 99" oder "Baujahr 99" → yearBuilt: 1999 (zweistellig = 1900er)
- "BJ 2020" → yearBuilt: 2020
- "3ZKB" oder "3 ZKB" → rooms: 3, bathrooms: 1
- "4ZKBB" → rooms: 4, bathrooms: 2
- "EG" / "Erdgeschoss" / "Parterre" → floor: 0
- "1. OG" / "1.OG" / "erster Stock" → floor: 1
- "DG" / "Dachgeschoss" → floor: -1 (Sonderwert für DG)
- "UG" / "Untergeschoss" / "Keller" → floor: -1
- "ca. 250" / "~250" / "ungefähr 250" / "250qm" / "250 Quadratmeter" → livingArea: 250
- "500k" / "500K" → askingPrice: 500000
- "eine halbe Million" → askingPrice: 500000
- "1,2 Mio" / "1.2 Mio" → askingPrice: 1200000
- "500.000" (mit Tausenderpunkt) → 500000
- "FBH" → attributes: ["Fußbodenheizung"]
- "BLK" → attributes: ["Balkon"]
- "TG" / "TG-Stellplatz" → attributes: ["Tiefgarage"]
- "GA" → attributes: ["Garten"]
- "Marktstr." → street: "Marktstraße" (Abkürzungen auflösen)
- "Str." → "Straße", "Pl." → "Platz", "Weg" bleibt "Weg"
- "gut" / "guter Zustand" / "guter Zustand" → condition: "GEPFLEGT"
- "muss renoviert werden" / "renovierungsbedürftig" → condition: "RENOVIERUNGS_BEDUERFTIG"
- "frisch saniert" / "komplett saniert" / "kernsaniert" → condition: "KERNSANIERT"
- "neuwertig" / "wie neu" → condition: "NEUBAU"
- "120 oder 130" / "ca. 125" / "so ungefähr 120" → livingArea: 125 (Mittelwert bei Bereich)
- "weiß ich nicht" / "keine Ahnung" / "skip" → extrahiere NICHTS für dieses Feld, gib {} zurück
- "EBK" → attributes: ["Einbauküche"]
- "STPL" / "Stellplatz" → attributes: ["Stellplatz"]

Beispiele für einzelne Antworten:
- Agent: "Wohnfläche?" → Nutzer: "250" → { "livingArea": 250 }
- Agent: "Wohnfläche?" → Nutzer: "so 120 bis 130" → { "livingArea": 125 }
- Agent: "Zustand?" → Nutzer: "gut" → { "condition": "GEPFLEGT" }
- Agent: "Zustand?" → Nutzer: "Gepflegt" → { "condition": "GEPFLEGT" }
- Agent: "Zustand?" → Nutzer: "kernsaniert" → { "condition": "KERNSANIERT" }
- Agent: "Baujahr?" → Nutzer: "99" → { "yearBuilt": 1999 }
- Agent: "Etage?" → Nutzer: "EG" → { "floor": 0 }
- Agent: "Zimmer?" → Nutzer: "3ZKB" → { "rooms": 3, "bathrooms": 1 }
- Agent: "Preis?" → Nutzer: "500k" → { "askingPrice": 500000 }
- Agent: "Heizungsart?" → Nutzer: "Gas" → { "specifications": { "Heizung & Warmwasser": { "Typ": "Gas-Zentralheizung" } } }
- Agent: "Heizungsart?" → Nutzer: "Wärmepumpe" → { "specifications": { "Heizung & Warmwasser": { "Typ": "Wärmepumpe" } } }
- Agent: "Fenster?" → Nutzer: "Kunststoff dreifach" → { "specifications": { "Tueren & Fenster": { "Fenster": "Kunststoff-Dreifachverglasung" } } }
- Agent: "Bodenbelag?" → Nutzer: "Parkett" → { "specifications": { "Boden": { "Wohnbereich": "Parkett" } } }
- Agent: "Keller?" → Nutzer: "Vollkeller, trocken" → { "specifications": { "Keller": { "Typ": "Vollkeller, trocken" } } }
- Agent: "Keller?" → Nutzer: "nein" → { "attributes": ["Kein Keller"] }
- Agent: "Keller?" → Nutzer: "Nein, kein Keller" → { "attributes": ["Kein Keller"] }
- Agent: "Sanierung?" → Nutzer: "Dach und Fenster" → { "specifications": { "Sanierungsbedarf": { "Umfang": "Dach, Fenster" } } }
- Agent: "Wohneinheiten?" → Nutzer: "3 Units" → { "unitCount": 3 }
- Agent: "Wohneinheiten?" → Nutzer: "3" → { "unitCount": 3 }
- Agent: "Zustand?" → Nutzer: "Completely Renovated" → { "condition": "KERNSANIERT" }
- Agent: "Zustand?" → Nutzer: "Well-maintained" → { "condition": "GEPFLEGT" }
- Agent: "Zustand?" → Nutzer: "needs renovation" → { "condition": "RENOVIERUNGS_BEDUERFTIG" }

Beispiel für Bulk-Eingabe:
- Nutzer: "MFH, Marktstraße 12, 76571 Gaggenau, 250m², Grundstück 450m², 8 Zimmer, 3 Bäder, Bj 1999, gepflegt. Keller, Garten, FBH, Parkett. 6 TG-Stellplätze à 15000€, 10 Außenstellplätze à 8000€. 3 Wohnungen: WE1 95m² 3Zi EG, WE2 55m² 2Zi 1.OG. Verkauf: beides. Energie: Verbrauch B 70kWh Gas gültig 2034-03-15. Preis: 525000"
→ { "type":"MFH", "street":"Marktstraße", "houseNumber":"12", "postcode":"76571", "city":"Gaggenau", "livingArea":250, "plotArea":450, "rooms":8, "bathrooms":3, "yearBuilt":1999, "condition":"GEPFLEGT", "attributes":["Keller","Garten","Fußbodenheizung"], "extras":[{"name":"TG-Stellplatz","quantity":6,"pricePerUnit":15000},{"name":"Außenstellplatz","quantity":10,"pricePerUnit":8000}], "specifications":{"Boden":{"Wohnbereich":"Parkett"},"Heizung & Warmwasser":{"Typ":"Fußbodenheizung"}}, "unitCount":3, "units":[{"label":"WE1","livingArea":95,"rooms":3,"floor":0},{"label":"WE2","livingArea":55,"rooms":2,"floor":1}], "sellingMode":"BOTH", "hasEnergyCert":true, "energyCertType":"VERBRAUCH", "energyClass":"B", "energyValue":70, "energySource":"Gas", "energyValidUntil":"2034-03-15", "askingPrice":525000 }

WICHTIGE REGELN:
- Überschreibe KEINE bereits bekannten Felder, es sei denn der Nutzer korrigiert sie explizit.
- "Grundstück hat X m²" bedeutet plotArea, NICHT type=GRUNDSTUECK. Ändere type nur wenn der Nutzer den Immobilientyp explizit ändert.
- street und houseNumber GETRENNT: "Marktstraße 12" → street: "Marktstraße", houseNumber: "12"
- postcode und city GETRENNT: "76571 Gaggenau" → postcode: "76571", city: "Gaggenau"
- postcode ist IMMER nur die 5-stellige Zahl, city ist IMMER nur der Ortsname
- Bei widersprüchlichen Angaben: nimm die NEUESTE (was der Nutzer JETZT sagt, nicht was vorher bekannt war)
- "Weiß ich nicht" / "skip" / "keine Ahnung" / "egal" / "weiter" → extrahiere NICHTS für dieses Feld, gib {} zurück
- Smalltalk ("hallo", "danke", "ok") → {} zurückgeben, keine Daten erfinden
- Unsinn/Tests ("asdf", "123", "test") → {} zurückgeben

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
- condition: ERSTBEZUG|NEUBAU|GEPFLEGT|RENOVIERUNGS_BEDUERFTIG|SANIERUNGS_BEDUERFTIG|ROHBAU|KERNSANIERT
- attributes: Array von Strings (Balkon, Keller, Garten, Stellplatz, Fussbodenheizung, etc.)
- hasEnergyCert: true/false
- energyCertType: VERBRAUCH|BEDARF
- energyClass: A+|A|B|C|D|E|F|G|H
- energyValue: kWh/m²a (Zahl)
- energySource: Gas|Öl|Fernwärme|Strom|etc.
- energyValidUntil: ISO-Datum (YYYY-MM-DD) — Gültigkeit des Energieausweises
- assumptions: Array von getroffenen Annahmen
- unitCount: Anzahl Wohneinheiten (Zahl, nur bei MFH)
- extras: Array von { name, quantity, pricePerUnit, description, optional, minQuantity, area, subtype } — Extras wie Stellplätze, Kellerabteile. optional=true wenn Kauf nicht verpflichtend, minQuantity=Mindestabnahme, area=Größe in m² (Keller/Garten), subtype=Art (z.B. "Tiefgarage","Außen","Carport"). Z.B. [{ "name": "TG-Stellplatz", "quantity": 2, "pricePerUnit": 15000, "optional": true, "minQuantity": 1, "subtype": "Tiefgarage" }]
- specifications: Verschachtelte Ausstattungsdetails. WICHTIG: Heizungsart IMMER unter "Heizung & Warmwasser" > "Typ" speichern, Fenstertyp unter "Tueren & Fenster" > "Fenster", Bodenbelag unter "Boden" > "Wohnbereich", Kellertyp unter "Keller" > "Typ". Kategorien: Boden, Waende & Decke, Sanitaer, Heizung & Warmwasser, Elektro & Smart Home, Kueche, Tueren & Fenster, Keller, Dach, Sanierungsbedarf. Z.B. { "Heizung & Warmwasser": { "Typ": "Gas-Zentralheizung" }, "Tueren & Fenster": { "Fenster": "Kunststoff-Dreifachverglasung" }, "Keller": { "Typ": "Vollkeller, trocken" }, "Dach": { "Typ": "Satteldach" } }
- units: Array von { label, livingArea, rooms, bathrooms, floor, features, askingPrice, extras } — Daten einzelner Wohneinheiten. extras=per-unit extras (gleiche Struktur wie building-level extras)
- barrierefrei: true/false — Ist die Immobilie barrierefrei/barrierearm zugänglich?
- sellingMode: INDIVIDUAL|BUNDLE|BOTH — Verkaufsart (einzeln/Paket/beides)
- hasFloorPlan: true wenn Grundriss vorhanden
- currentUnit: string|null — Label der Wohnung die gerade besprochen wird (z.B. "Wohnung 1", "WE 01"). null wenn Gebäude-Ebene. Setze dies wenn der Assistent explizit zu einer bestimmten Wohnung wechselt.
- roomProgram: Array von { name: string, area: number } — einzelne Räume mit Größe (z.B. { name: "Wohnzimmer", area: 25 })
- askingPrice: Wunschpreis/Angebotspreis in Euro (Zahl, ohne Währung)
- sellerContact: { name?, company?, phone?, email? } — Kontaktdaten für das Exposé

Antworte NUR mit JSON. Leeres Objekt {} wenn nichts Neues extrahiert wurde.`;

  // Inject learned corrections filtered by relevance to current property type
  try {
    const mfhFields = ["unitCount", "sellingMode", "units", "currentUnit"];
    const isMfh = currentMemory.type === "MFH";
    const corrections = await prisma.extractionCorrection.findMany({
      where: isMfh ? undefined : { field: { notIn: mfhFields } },
      orderBy: { usageCount: "desc" },
      take: 10,
    });
    if (corrections.length > 0) {
      const correctionExamples = corrections.map(c =>
        `- Agent: "${c.agentQuestion || "?"}" → Nutzer: "${c.userInput}" → FALSCH: ${JSON.stringify(c.wrongExtraction)} → RICHTIG: ${JSON.stringify(c.correctExtraction)}`
      ).join("\n");
      prompt = prompt + `\n\nBEKANNTE FEHLER (vermeide diese!):\n${correctionExamples}`;
    }
  } catch { /* table may not exist yet */ }

  try {
    // Scale maxTokens with input length: bulk pastes with MFH units need more output space.
    // 1200 for very long inputs (MFH with units + energy + parking) to avoid dropping attributes.
    const extractMaxTokens = userMessage.length > 500 ? 1200 : userMessage.length > 300 ? 800 : 400;
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
  let workingMemory = memory;
  let toolStepsExecuted = 0;
  let costCentsThisTurn = 0;
  let costCentsTotal = ctx.startingCostCents;
  let finished = false;
  let agentMessage = "";
  const turnNumber = history.filter(m => m.role === "user").length;
  let abortedReason: AgentTurnResult["abortedReason"];

  // If handoff was already committed, don't process further turns
  if (workingMemory.handoffReady) {
    return {
      agentMessage: "Ihr Inserat wurde bereits erstellt. Sie finden es auf der Inserat-Seite.",
      memory: workingMemory,
      toolStepsExecuted: 0,
      costCentsThisTurn: 0,
      costCentsTotal,
      finished: true,
      abortedReason: undefined,
    };
  }

  // EXTRACT FIRST: Run extraction BEFORE the LLM so the orchestrator sees updated memory.
  // This prevents the #1 cause of loops: LLM re-asking for data the user just provided.
  const memoryBeforeExtraction = { ...workingMemory };
  let justExtractedFields: string[] = [];
  if (userMessage && costCentsTotal < MAX_COST_CENTS) {
    const lastAgentMsg = [...history].reverse().find(m => m.role === "assistant")?.content || "";
    const ext = await extractMemoryFromMessage(lastAgentMsg, userMessage, workingMemory, ctx.agentRunId, turnNumber);
    costCentsThisTurn += ext.costCents;
    costCentsTotal += ext.costCents;
    if (ext.patch) {
      // Detect corrections: field was already filled and now changes
      const correctionFields = ["type", "street", "houseNumber", "postcode", "city", "livingArea", "plotArea", "yearBuilt", "rooms", "bathrooms", "floor", "condition", "unitCount", "sellingMode", "barrierefrei"];
      const wmAny = workingMemory as unknown as Record<string, unknown>;
      const patchAny = ext.patch as unknown as Record<string, unknown>;
      for (const field of correctionFields) {
        const oldVal = wmAny[field];
        const newVal = patchAny[field];
        if (oldVal != null && newVal !== undefined && JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          prisma.extractionCorrection.create({
            data: {
              userInput: userMessage.slice(0, 500),
              agentQuestion: lastAgentMsg.slice(0, 500) || null,
              wrongExtraction: JSON.parse(JSON.stringify({ [field]: oldVal })),
              correctExtraction: JSON.parse(JSON.stringify({ [field]: newVal })),
              field,
            },
          }).catch(() => {});
        }
      }

      workingMemory = applyPatch(workingMemory, ext.patch);
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

      // Compute what changed — used to build acknowledgment context for the LLM
      const TRACKABLE_FIELDS: Record<string, string> = {
        type: "Immobilientyp", street: "Straße", houseNumber: "Hausnummer",
        postcode: "PLZ", city: "Stadt", livingArea: "Wohnfläche",
        plotArea: "Grundstück", yearBuilt: "Baujahr", rooms: "Zimmer",
        bathrooms: "Bäder", floor: "Etage", condition: "Zustand",
        hasEnergyCert: "Energieausweis", energyCertType: "Ausweistyp",
        energyClass: "Energieklasse", energyValue: "Energieverbrauch",
        energySource: "Energieträger", energyValidUntil: "Gültig bis",
        unitCount: "Wohneinheiten", sellingMode: "Verkaufsart",
        barrierefrei: "Barrierefrei", askingPrice: "Angebotspreis",
      };
      const wmPre = memoryBeforeExtraction as unknown as Record<string, unknown>;
      const wmPost = workingMemory as unknown as Record<string, unknown>;
      for (const [field, label] of Object.entries(TRACKABLE_FIELDS)) {
        const before = wmPre[field];
        const after = wmPost[field];
        if (after != null && JSON.stringify(before) !== JSON.stringify(after)) {
          justExtractedFields.push(`${label}: ${after}`);
        }
      }
      if (ext.patch.attributes && (ext.patch.attributes as string[]).length > 0) {
        const newAttrs = (ext.patch.attributes as string[]).filter(a => !memoryBeforeExtraction.attributes.includes(a));
        if (newAttrs.length) justExtractedFields.push(`Ausstattung: ${newAttrs.join(", ")}`);
      }
      if (ext.patch.units && (ext.patch.units as UnitData[]).length > 0) {
        const newUnits = (ext.patch.units as UnitData[]).filter(u => !memoryBeforeExtraction.units.find(e => e.label === u.label));
        if (newUnits.length) justExtractedFields.push(`Neue Einheiten: ${newUnits.map(u => `${u.label} (${u.livingArea}m²)`).join(", ")}`);
      }
      if (ext.patch.extras && (ext.patch.extras as PropertyExtra[]).length > 0) {
        justExtractedFields.push(`Extras: ${(ext.patch.extras as PropertyExtra[]).map(e => `${e.quantity}× ${e.name}`).join(", ")}`);
      }
      if (ext.patch.specifications && Object.keys(ext.patch.specifications as object).length > 0) {
        for (const [cat, entries] of Object.entries(ext.patch.specifications as Record<string, Record<string, string>>)) {
          const vals = Object.values(entries).join(", ");
          justExtractedFields.push(`${cat}: ${vals}`);
        }
      }
    }
  }

  // Mechanical skip: if user says "nein/skip/weiter" and the current nextQuestion
  // recommends an optional field, add it to skippedFields so the agent moves on.
  if (userMessage) {
    const skipPhrases = /\bnein\b|^nein danke|^skip|^überspringen|^weiter$|^egal$|^keine ahnung|^weiß ich nicht|^nicht vorhanden|^kein\b|^hab ich nicht|^nein,?\s|^no\b|^none$|^nothing|^i don'?t|^don'?t have|^not available|^no \w+$|^keine? \w+$/i;
    if (skipPhrases.test(userMessage.trim())) {
      const preNq = nextQuestion(workingMemory);
      if (preNq.action === "ask" && preNq.field) {
        const spec = FIELD_PRIORITY.find(s => s.field === preNq.field);
        if (spec?.optional && !workingMemory.skippedFields.includes(preNq.field)) {
          const skipPatch: MemoryPatch = { skippedFields: [...workingMemory.skippedFields, preNq.field] };
          workingMemory = applyPatch(workingMemory, skipPatch);
          await prisma.conversationTurn.create({
            data: {
              conversationId: ctx.conversationId,
              role: "SYSTEM",
              content: `[skip:${preNq.field}]`,
              toolName: "system",
              toolOutput: asJson({ memoryPatch: skipPatch }),
            },
          });
        }
      }
    }
  }

  // Implicit skip: if user provided data for DIFFERENT fields than what was asked,
  // and the asked field is optional, treat it as skipped. This prevents the agent
  // from repeating "What type of windows?" after the user clearly moved on to energy data.
  if (justExtractedFields.length > 0 && userMessage) {
    const preNq = nextQuestion(workingMemory);
    if (preNq.action === "ask" && preNq.field) {
      const spec = FIELD_PRIORITY.find(s => s.field === preNq.field);
      if (spec && spec.optional && !spec.isFilled(workingMemory)) {
        // User gave data but didn't answer THIS question — implicit skip
        if (!workingMemory.skippedFields.includes(preNq.field)) {
          const skipPatch: MemoryPatch = { skippedFields: [...workingMemory.skippedFields, preNq.field] };
          workingMemory = applyPatch(workingMemory, skipPatch);
          await prisma.conversationTurn.create({
            data: {
              conversationId: ctx.conversationId,
              role: "SYSTEM",
              content: `[implicit-skip:${preNq.field}]`,
              toolName: "system",
              toolOutput: asJson({ memoryPatch: skipPatch }),
            },
          });
        }
      }
    }
  }

  // Build messages with UPDATED memory (after extraction + skip + implicit-skip)
  const nq = nextQuestion(workingMemory);
  const messages: ChatMsg[] = [
    { role: "system", content: ORCHESTRATOR_SYSTEM_PROMPT },
    { role: "system", content: buildMemoryContext(workingMemory) },
    ...history,
  ];
  if (userMessage !== null) {
    messages.push({ role: "user", content: userMessage });
  }
  // Context-aware directive: acknowledge what the user just provided, then guide to next step.
  // Old approach used [PFLICHT] to force exact questions — this made the agent ignore user input.
  // New approach: tell the LLM what was extracted, let it acknowledge naturally, then ask next question.
  const rubricPending = workingMemory.lastRubric && !workingMemory.lastRubric.passed && workingMemory.draft;
  if (rubricPending) {
    // Don't override — let the LLM address the rubric failures naturally
  } else if (nq.action === "trigger_pricing") {
    messages.push({ role: "system", content: "[AKTION] Rufe JETZT pricing_recommend auf. Keine Frage stellen." });
  } else if (nq.action === "trigger_draft") {
    messages.push({ role: "system", content: "[AKTION] Rufe JETZT listing_draft auf. Keine Frage stellen." });
  } else {
    // Build the acknowledge-then-guide directive
    const parts: string[] = [];

    if (justExtractedFields.length > 0) {
      parts.push(`[ERFASST] Aus der letzten Antwort des Verkäufers wurden folgende Daten extrahiert:`);
      parts.push(justExtractedFields.map(f => `  ✓ ${f}`).join("\n"));
      parts.push(`→ Bestätige KURZ (1 Satz) was du verstanden hast. Zeige die erfassten Werte.`);
    }

    if (nq.action === "ask" && nq.prompt) {
      parts.push(`[NÄCHSTE FRAGE] Stelle danach EINE Frage zum Thema: ${nq.prompt}`);
      parts.push(`Formuliere die Frage natürlich und passend zum Gesprächsfluss — nicht robotisch.`);
    } else if (nq.action === "upload_photos") {
      parts.push(`[NÄCHSTER SCHRITT] Bitte den Verkäufer um Foto-Upload. Weise auf den 📷-Button hin.`);
    } else if (nq.action === "wait_confirm") {
      parts.push(`[NÄCHSTER SCHRITT] Warte auf Bestätigung des Verkäufers.`);
    }

    parts.push(`REGELN: Stelle NUR EINE Frage. Maximal 2-3 Sätze insgesamt.`);

    if (parts.length > 0) {
      messages.push({ role: "system", content: parts.join("\n") });
    }
  }

  // Track how many times each field is asked — auto-skip after 3
  if (nq.field) {
    workingMemory.fieldAskCount[nq.field] = (workingMemory.fieldAskCount[nq.field] || 0) + 1;
  }

  // Cost-compression hysteresis: one-way latch, stays on once triggered
  if (costCentsTotal > 350 && !workingMemory.costCompressed) {
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
    !workingMemory.handoffReady &&
    workingMemory.lastRubric?.passed &&
    workingMemory.draft &&
    isReadyForHandoff(workingMemory)
  ) {
    const msg = userMessage.trim().toLowerCase();
    const confirmPhrases = /\bja\b|\byes\b|erstellen|veröffentlichen|fertig|weiter|machen|los|bestätig|proceed|confirm|ok\b|okay/i;
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

  // Price selection after initial recommendation (priceBand exists, no draft yet).
  // Seller responds to the A/B/C price recommendation message.
  if (
    userMessage &&
    workingMemory.priceBand &&
    !workingMemory.draft &&
    !workingMemory.lastRubric
  ) {
    const msg = userMessage.trim().toLowerCase();
    let selectedPrice: number | null = null;

    if (/^\s*a\b/i.test(userMessage)) {
      // A = keep own price (if they had one) or accept recommended
      selectedPrice = workingMemory.askingPrice || workingMemory.priceBand.strategyReal;
    } else if (/^\s*b\b/i.test(userMessage)) {
      // B = recommended/custom depending on which prompt variant was shown
      selectedPrice = workingMemory.askingPrice
        ? workingMemory.priceBand.strategyReal  // had own price → B = recommended
        : null;  // no own price → B = custom, fall through to LLM
    } else if (/^\s*c\b/i.test(userMessage)) {
      selectedPrice = null; // custom — fall through
    } else if (/empfoh?len|marktmitte|recommended/i.test(msg)) {
      selectedPrice = workingMemory.priceBand.strategyReal;
    } else if (/bleib|behalte|keep|mein/i.test(msg)) {
      selectedPrice = workingMemory.askingPrice || workingMemory.priceBand.strategyReal;
    } else {
      const numMatch = msg.replace(/\./g, "").match(/(\d{4,})/);
      if (numMatch) selectedPrice = parseInt(numMatch[1]);
    }

    if (selectedPrice && selectedPrice > 0) {
      workingMemory = applyPatch(workingMemory, { askingPrice: selectedPrice });
      await prisma.conversationTurn.create({
        data: {
          conversationId: ctx.conversationId,
          role: "SYSTEM",
          content: `[price-selected-${selectedPrice}]`,
          toolName: "system",
          toolOutput: asJson({ memoryPatch: { askingPrice: selectedPrice } }),
        },
      });
      // nextQuestion() will return trigger_draft → LLM calls listing_draft
    } else if (!selectedPrice && workingMemory.askingPrice == null) {
      // No price selected and none set — use recommended as default
      workingMemory = applyPatch(workingMemory, { askingPrice: workingMemory.priceBand.strategyReal });
      await prisma.conversationTurn.create({
        data: {
          conversationId: ctx.conversationId,
          role: "SYSTEM",
          content: `[price-default-recommended]`,
          toolName: "system",
          toolOutput: asJson({ memoryPatch: { askingPrice: workingMemory.priceBand!.strategyReal } }),
        },
      });
    }
  }

  for (let iter = 0; iter < MAX_TOOL_ITERATIONS_PER_TURN; iter++) {
    // Cost-cap pre-check
    if (costCentsTotal >= MAX_COST_CENTS) {
      if (!workingMemory.costCompressed) {
        workingMemory = { ...workingMemory, costCompressed: true };
      }
      abortedReason = "cost_cap";
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

        // Self-healing: if rubric failed on fixable issues, auto-revise up to 2 times
        if (
          workingMemory.lastRubric &&
          !workingMemory.lastRubric.passed &&
          isAgentFixableRubric(workingMemory.lastRubric) &&
          workingMemory.draftRevisionCount < 2 &&
          canAffordChainedTool(costCentsTotal, 12)
        ) {
          const revisionResult = await reviseDraft(workingMemory.draft!, workingMemory.lastRubric, workingMemory);
          costCentsThisTurn += revisionResult.costCents;
          costCentsTotal += revisionResult.costCents;
          if (revisionResult.ok && revisionResult.draft) {
            workingMemory = applyPatch(workingMemory, {
              draft: revisionResult.draft,
              draftRevisionCount: workingMemory.draftRevisionCount + 1,
            } as MemoryPatch);

            await prisma.agentStep.create({
              data: {
                agentRunId: ctx.agentRunId,
                ordinal: await nextStepOrdinal(ctx.agentRunId),
                toolName: "listing_revise",
                input: asJson({ revision: workingMemory.draftRevisionCount, failures: workingMemory.lastRubric!.failures }),
                output: asJson({ ok: true }),
                latencyMs: 0,
                ok: true,
              },
            });

            // Re-run rubric on revised draft
            if (canAffordChainedTool(costCentsTotal, 5)) {
              const reReviewTr = await executeTool("listing_review", {}, workingMemory, turnNumber);
              toolStepsExecuted++;
              costCentsThisTurn += reReviewTr.costCents;
              costCentsTotal += reReviewTr.costCents;
              if (reReviewTr.memoryPatch) workingMemory = applyPatch(workingMemory, reReviewTr.memoryPatch);

              await prisma.agentStep.create({
                data: {
                  agentRunId: ctx.agentRunId,
                  ordinal: await nextStepOrdinal(ctx.agentRunId),
                  toolName: "listing_review",
                  input: asJson({ afterRevision: workingMemory.draftRevisionCount }),
                  output: asJson({ ...reReviewTr.output, memoryPatch: reReviewTr.memoryPatch }),
                  latencyMs: reReviewTr.latencyMs,
                  ok: reReviewTr.ok,
                },
              });

              await prisma.conversationTurn.create({
                data: {
                  conversationId: ctx.conversationId,
                  role: "TOOL",
                  content: "listing_review",
                  toolName: "listing_review",
                  toolInput: asJson({ afterRevision: workingMemory.draftRevisionCount }),
                  toolOutput: asJson({ ...reReviewTr.output, memoryPatch: reReviewTr.memoryPatch }),
                  latencyMs: reReviewTr.latencyMs,
                },
              });
            }
          }
        }

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
    if (abortedReason === "cost_cap") {
      const nq = nextQuestion(workingMemory);
      agentMessage = nq.prompt || "Bitte fahren Sie fort — was möchten Sie als Nächstes angeben?";
    } else if (!abortedReason) {
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

  // Extraction was moved to the top of runAgentTurn (EXTRACT FIRST pattern)
  // so the LLM sees updated memory and doesn't re-ask for data just provided.

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

  // Mechanical pipeline: when all required fields + photos are present but no
  // price band yet, chain pricing → draft → review without waiting for the LLM.
  // MFH: wait until units are fully captured before triggering pricing.
  const mfhUnitsComplete = workingMemory.type !== "MFH" || (workingMemory.unitCount != null && workingMemory.units.length >= workingMemory.unitCount && workingMemory.sellingMode != null);
  if (
    !finished &&
    isReadyForDraft(workingMemory) &&
    mfhUnitsComplete &&
    workingMemory.uploads.filter(u => u.kind === "PHOTO").length >= 1 &&
    !workingMemory.priceBand &&
    canAffordChainedTool(costCentsTotal, 15)
  ) {
    // pricing_recommend
    const priceTr = await executeTool("pricing_recommend", {}, workingMemory, turnNumber);
    toolStepsExecuted++;
    costCentsThisTurn += priceTr.costCents;
    costCentsTotal += priceTr.costCents;
    if (priceTr.memoryPatch) workingMemory = applyPatch(workingMemory, priceTr.memoryPatch);
    await prisma.agentStep.create({ data: { agentRunId: ctx.agentRunId, ordinal: await nextStepOrdinal(ctx.agentRunId), toolName: "pricing_recommend", input: asJson({}), output: asJson({ ...priceTr.output, memoryPatch: priceTr.memoryPatch }), latencyMs: priceTr.latencyMs, ok: priceTr.ok } });
    await prisma.conversationTurn.create({ data: { conversationId: ctx.conversationId, role: "TOOL", content: "pricing_recommend", toolName: "pricing_recommend", toolInput: asJson({}), toolOutput: asJson({ ...priceTr.output, memoryPatch: priceTr.memoryPatch }), latencyMs: priceTr.latencyMs } });

    if (priceTr.ok && workingMemory.priceBand) {
      // Pause after pricing: show recommendation and let seller choose price.
      // Draft triggers on the NEXT turn via nextQuestion() → trigger_draft.
      agentMessage = buildPriceRecommendationMessage(workingMemory);
    }
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
  const greeting = [
    "Willkommen beim Direkta Exposé-Assistenten.",
    "",
    "Beschreiben Sie Ihre Immobilie — je mehr Details auf einmal, desto schneller geht es.",
    "Zum Beispiel: Typ, Adresse, Größe, Zimmer, Baujahr, Zustand, Ausstattung, Energieausweis, Preis.",
    "",
    "Sie können auch ein bestehendes Inserat einfügen — ich übernehme alle Daten daraus.",
  ].join("\n");

  await prisma.agentStep.create({
    data: {
      agentRunId: ctx.agentRunId,
      ordinal: 0,
      toolName: "greeting",
      input: asJson({ kind: "greeting" }),
      output: asJson({ deterministic: true }),
      latencyMs: 0,
      ok: true,
    },
  });

  return { message: greeting, costCents: 0 };
}
