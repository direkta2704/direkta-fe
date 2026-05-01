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
}

export interface PhotoUpload {
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  kind: "PHOTO" | "FLOORPLAN";
  classification?: PhotoClassification;
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

  const sysPrompt = `Du bist ein Bildklassifikator für deutsche Immobilieninserate. Klassifiziere das Foto nach Raumtyp und bewerte die Qualität. Antworte als JSON, ohne Markdown:
{
  "roomType": einer aus [${PHOTO_ROOM_TYPES.join(", ")}],
  "qualityFlags": Array aus [blur, dark, saturated, oversharp, tilted, cluttered, watermark],
  "qualityScore": 0-100 (höher = besser, 60+ ist akzeptabel für Inserat)
}
"floorplan" nur wenn das Bild ein technischer Grundriss ist. "exterior" für Außenansichten des Gebäudes.`;

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
      max_tokens: 200,
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

  return {
    ok: true,
    classification: { roomType, qualityFlags, qualityScore },
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
    return { ok: false, error: "Pflichtfelder fehlen für Preisberechnung" };
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

const DRAFT_SYSTEM_PROMPT = `Du bist ein professioneller Immobilientexter für den deutschen Markt.
Aus den strukturierten Daten erstellst du eine Exposé-Beschreibung in Sie-Form.

HARTE REGELN:
- Antwort als JSON: { "descriptionLong": string, "titleShort": string }
- descriptionLong: MINDESTENS 300 Wörter, maximal 600 Wörter, GENAU 3 Absätze getrennt durch \\n\\n
  Absatz 1 (~120 Wörter): Die Immobilie — Typ, Lage, Größe, Zimmer, Bäder, Zustand, Renovierungen, Ausstattung im Detail
  Absatz 2 (~100 Wörter): Die Umgebung — Stadt, Stadtteil, Infrastruktur, Schulen, Einkaufen, ÖPNV, Natur
  Absatz 3 (~100 Wörter): Die Gelegenheit — Zielgruppe, Preis-Leistung, Investitionspotenzial, Energie-Hinweis
  WICHTIG: Jeder Absatz muss MINDESTENS 80 Wörter haben. Schreibe ausführlich.
- titleShort: max 160 Zeichen, enthält Typ, Zimmer (falls vorhanden), Wohnfläche, Stadt
- KEINE erfundenen Merkmale — beschreibe NUR, was in den Daten steht
- KEINE Ausrufezeichen
- KEINE Superlative wie "einmalig", "konkurrenzlos", "atemberaubend", "traumhaft", "perfekt"
- Beende den 3. Absatz mit dem Standard-Energieausweis-Hinweis (falls Energiedaten vorhanden)`;

async function tool_listingDraft(m: WorkingMemory) {
  const ctx = summarizeProperty(m);
  const result = await callLlm({
    model: DRAFT_MODEL,
    messages: [
      { role: "system", content: DRAFT_SYSTEM_PROMPT },
      { role: "user", content: `Erstelle Exposé-Texte basierend auf:\n${ctx}` },
    ],
    responseFormat: { type: "json_object" },
    temperature: 0.6,
    maxTokens: 2400,
  });
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(result.message.content || "{}");
  } catch {
    return { ok: false, error: "Entwurf konnte nicht geparst werden", costCents: result.usage.costCents };
  }
  if (typeof parsed.descriptionLong !== "string" || typeof parsed.titleShort !== "string") {
    return { ok: false, error: "Entwurf unvollständig", costCents: result.usage.costCents };
  }
  let titleShort = parsed.titleShort;
  if (titleShort.length > 160) titleShort = titleShort.slice(0, 157) + "...";
  return {
    ok: true,
    draft: { descriptionLong: parsed.descriptionLong, titleShort } as DraftResult,
    costCents: result.usage.costCents,
  };
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
    wcDetails.ok = words >= 230 && words <= 650 && paragraphs.length >= 2 && paragraphs.length <= 4;
    if (!wcDetails.ok) failures.push(`Beschreibung: ${words} Wörter / ${paragraphs.length} Absätze (Soll: 230–650 / 2–4)`);
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

  // 5. Photos: ≥6, AND ≥1 labelled exterior OR floorplan (Lastenheft §4.5)
  const photos = m.uploads.filter((u) => u.kind === "PHOTO" || u.kind === "FLOORPLAN");
  const photoCount = photos.length;
  const hasExteriorOrFloorplan =
    photos.some((u) => u.kind === "FLOORPLAN") ||
    photos.some((u) => u.classification?.roomType === "exterior" || u.classification?.roomType === "floorplan");
  const photosOk = photoCount >= 6 && hasExteriorOrFloorplan;
  if (photoCount < 6) failures.push(`Nur ${photoCount} Fotos hochgeladen (Soll: ≥6)`);
  else if (!hasExteriorOrFloorplan) failures.push("Mindestens ein Außenfoto oder Grundriss fehlt");

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
          memoryPatch = {
            hasEnergyCert: true,
            energyCertType: r.type === "BEDARF" ? "BEDARF" : "VERBRAUCH",
            energyClass: r.energyClass || memory.energyClass,
            energyValue: r.energyValue ?? memory.energyValue,
            energySource: r.primarySource || memory.energySource,
            energyValidUntil: r.validUntil || memory.energyValidUntil,
          };
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
  let memory: WorkingMemory = { ...INITIAL_MEMORY, attributes: [], uploads: [], assumptions: [] };
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

const ORCHESTRATOR_SYSTEM_PROMPT = `Du bist der Direkta Exposé-Agent. Du führst deutsche Immobilieneigentümer in einem Gespräch durch die Erstellung eines GEG-konformen Inserats.

WICHTIGSTE REGEL — EINE FRAGE PRO NACHRICHT:
Du darfst pro Nachricht NUR EINE einzige Frage stellen. Niemals zwei oder mehr Fragen in einer Nachricht.
FALSCH: "Wie groß ist die Wohnung und wie viele Zimmer hat sie?"
FALSCH: "Könnten Sie mir bitte die Wohnfläche, die Bäder, das Baujahr und den Zustand mitteilen?"
RICHTIG: "Wie groß ist die Wohnfläche in Quadratmetern?"
Frage nach EINEM Datenpunkt, warte auf die Antwort, dann frage den nächsten.

WEITERE REGELN:
- Sprich Deutsch in der Sie-Form, professionell und freundlich.
- Sei kurz: 1–3 Sätze pro Nachricht.
- Erfinde KEINE Immobilien-Eigenschaften.
- Daten werden automatisch aus deiner Konversation extrahiert — du musst KEINE ###MEMORY### Blöcke schreiben.
- Wenn du genug Informationen hast, RUFE TOOLS AUF (function calling), in dieser Reihenfolge:
  1. address_validate (sobald komplette Adresse vorhanden)
  2. pricing_recommend (sobald alle Pflichtfelder gesetzt)
  3. listing_draft (nach pricing_recommend)
  4. listing_review (nach listing_draft)
  5. handoff_commit (nur wenn listing_review pass=true UND der Verkäufer bestätigt hat)
- Wenn listing_review fehlschlägt: rufe listing_draft erneut auf, mit Hinweis auf die Fehler.

ABLAUF (frage Schritt für Schritt, EIN Feld pro Nachricht):
1. Begrüßung → Immobilientyp (ETW/EFH/MFH/DHH/RH/Grundstück)
2. Adresse (Straße + Hausnummer)
3. PLZ + Stadt
4. Wohnfläche (m²)
5. Zimmeranzahl
6. Badezimmer
7. Baujahr
8. Etage (nur bei ETW)
9. Zustand
10. Besondere Ausstattung (Balkon, Garten, Keller, etc.)
11. Energieausweis: ja/nein → wenn ja: Typ, Klasse, Wert, Primärenergieträger (je einzeln fragen)
12. Fotos: bitte um Upload (mind. 6)
13. Pricing aufrufen, dem Verkäufer Preisband zeigen
14. Draft + Review, Entwurf zeigen
15. Bestätigung holen → handoff_commit

IMMOBILIENTYPEN: ETW, EFH, MFH, DHH, RH, GRUNDSTUECK
ZUSTAND: ERSTBEZUG, NEUBAU, GEPFLEGT, RENOVIERUNGS_BEDUERFTIG, SANIERUNGS_BEDUERFTIG, ROHBAU
ENERGIEKLASSEN: A+, A, B, C, D, E, F, G, H

Wenn du eine Annahme triffst (z. B. "Bad" → 1 Bad), erwähne sie in deiner Antwort.`;

function buildMemoryContext(m: WorkingMemory): string {
  const missing = getMissingFields(m);
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
Fotos hochgeladen: ${m.uploads.filter((u) => u.kind === "PHOTO").length}
Preisband: ${m.priceBand ? `${m.priceBand.low.toLocaleString("de")}–${m.priceBand.high.toLocaleString("de")} € (${m.priceBand.confidence})` : "—"}
Wunschpreis: ${m.askingPrice ? `${m.askingPrice.toLocaleString("de")} €` : "—"}
Entwurf vorhanden: ${m.draft ? "ja" : "nein"}
Letzte Rubric: ${m.lastRubric ? (m.lastRubric.passed ? "✓ bestanden" : `✗ ${m.lastRubric.failures.join("; ")}`) : "—"}
Handoff bereit: ${m.handoffReady ? "ja" : "nein"}
Fehlende Pflichtfelder: ${missing.join(", ") || "keine"}`;
}

interface ChatMsg {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  name?: string;
}

function parseInlineMemory(content: string): { cleaned: string; patch: Partial<WorkingMemory> | null } {
  const match = content.match(/###MEMORY###\s*([\s\S]*?)\s*###END###/);
  if (!match) return { cleaned: content, patch: null };
  const cleaned = content.replace(/###MEMORY###[\s\S]*?###END###/, "").trim();
  try {
    const raw = JSON.parse(match[1]);
    return { cleaned, patch: normalizeUserPatch(raw) };
  } catch {
    return { cleaned, patch: null };
  }
}

function normalizeUserPatch(data: Record<string, unknown>): Partial<WorkingMemory> {
  const patch: Partial<WorkingMemory> = {};
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
  userMessage: string,
  currentMemory: WorkingMemory,
  agentRunId: string,
): Promise<{ patch: Partial<WorkingMemory> | null; costCents: number }> {
  const known = Object.entries(currentMemory)
    .filter(([k, v]) => v !== null && k !== "uploads" && k !== "draft" && k !== "lastRubric" && k !== "assumptions" && k !== "priceBand")
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  const prompt = `Extrahiere Immobiliendaten aus der Nutzernachricht. Gib NUR ein JSON-Objekt zurück.

Bereits bekannt: ${known || "nichts"}

Nutzernachricht: "${userMessage}"

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

Antworte NUR mit JSON. Leeres Objekt {} wenn nichts Neues extrahiert wurde.`;

  try {
    const llm = await callLlm({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.0,
      maxTokens: 400,
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
    const patch = normalizeUserPatch(raw);
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
  let abortedReason: AgentTurnResult["abortedReason"];

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
      maxTokens: 1000,
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
        const tr = await executeTool(tc.function.name, parsedArgs, workingMemory);
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

      if (finished) break;
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
    const ext = await extractMemoryFromMessage(userMessage, workingMemory, ctx.agentRunId);
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
