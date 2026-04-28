export interface WorkingMemory {
  phase: "greet" | "basics" | "details" | "energy" | "photos" | "draft" | "confirm";
  type: string | null;
  street: string | null;
  houseNumber: string | null;
  postcode: string | null;
  city: string | null;
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
  photosUploaded: number;
  descriptionGenerated: boolean;
  priceCalculated: boolean;
}

export const INITIAL_MEMORY: WorkingMemory = {
  phase: "greet",
  type: null,
  street: null,
  houseNumber: null,
  postcode: null,
  city: null,
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
  photosUploaded: 0,
  descriptionGenerated: false,
  priceCalculated: false,
};

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
  return isReadyForDraft(m) && m.descriptionGenerated;
}

const SYSTEM_PROMPT = `Du bist der Direkta Exposé-Assistent. Du hilfst Immobilieneigentümern, ein professionelles Inserat zu erstellen — Schritt für Schritt, eine Frage nach der anderen.

REGELN:
- Sprich auf Deutsch, formell (Sie-Form)
- Stelle IMMER nur EINE Frage pro Nachricht
- Sei freundlich, professionell und effizient
- Fasse dich kurz (2-3 Sätze maximal)
- Erfinde KEINE Informationen über die Immobilie
- Wenn der Nutzer etwas Unklares sagt, frage nach

ABLAUF:
1. BEGRÜSSUNG: Begrüße den Verkäufer und frage nach dem Immobilientyp (ETW/EFH/MFH/DHH/RH/Grundstück)
2. ADRESSE: Frage nach Straße, Hausnummer, PLZ und Stadt (kann in einer Antwort kommen)
3. DETAILS: Frage nacheinander nach: Wohnfläche (m²), Zimmeranzahl, Badezimmer, Baujahr, Etage (nur bei ETW), Zustand, besondere Ausstattung
4. ENERGIEAUSWEIS: Frage ob ein Energieausweis vorliegt. Falls ja: Typ (Verbrauch/Bedarf), Energieklasse, Verbrauchswert, Primärenergieträger
5. FOTOS: Erinnere daran, Fotos hochzuladen (mind. 6)
6. ZUSAMMENFASSUNG: Fasse alle gesammelten Daten zusammen und frage ob alles korrekt ist

IMMOBILIENTYPEN:
- ETW = Eigentumswohnung
- EFH = Einfamilienhaus
- MFH = Mehrfamilienhaus
- DHH = Doppelhaushälfte
- RH = Reihenhaus
- GRUNDSTUECK = Grundstück

ZUSTAND-OPTIONEN:
- ERSTBEZUG, NEUBAU, GEPFLEGT, RENOVIERUNGS_BEDUERFTIG, SANIERUNGS_BEDUERFTIG, ROHBAU

ENERGIEKLASSEN: A+, A, B, C, D, E, F, G, H

Wenn du Daten aus der Antwort des Nutzers extrahierst, gib sie im folgenden JSON-Format am Ende deiner Nachricht zurück (in einem separaten Block):

###EXTRACTED###
{"field": "value", "field2": "value2"}
###END###

Mögliche Felder: type, street, houseNumber, postcode, city, livingArea, plotArea, yearBuilt, rooms, bathrooms, floor, condition, attributes (Array), hasEnergyCert (boolean), energyCertType, energyClass, energyValue, energySource

Wenn keine Daten extrahiert werden können, gib den Block NICHT aus.`;

export function buildPrompt(
  memory: WorkingMemory,
  turns: { role: string; content: string }[]
): { role: string; content: string }[] {
  const missing = getMissingFields(memory);
  const memoryStr = `
AKTUELLER STAND (Working Memory):
- Phase: ${memory.phase}
- Typ: ${memory.type || "❌ fehlt"}
- Adresse: ${memory.street ? `${memory.street} ${memory.houseNumber}, ${memory.postcode} ${memory.city}` : "❌ fehlt"}
- Wohnfläche: ${memory.livingArea ? `${memory.livingArea} m²` : "❌ fehlt"}
- Grundstück: ${memory.plotArea ? `${memory.plotArea} m²` : "nicht angegeben"}
- Zimmer: ${memory.rooms ?? "nicht angegeben"}
- Badezimmer: ${memory.bathrooms ?? "nicht angegeben"}
- Baujahr: ${memory.yearBuilt ?? "nicht angegeben"}
- Etage: ${memory.floor ?? "nicht relevant"}
- Zustand: ${memory.condition || "❌ fehlt"}
- Ausstattung: ${memory.attributes.length > 0 ? memory.attributes.join(", ") : "keine"}
- Energieausweis: ${memory.hasEnergyCert === null ? "❌ nicht gefragt" : memory.hasEnergyCert ? `Ja (${memory.energyClass || "Klasse fehlt"})` : "Nein"}
- Fotos: ${memory.photosUploaded} hochgeladen
- Beschreibung: ${memory.descriptionGenerated ? "✅ generiert" : "❌ noch nicht"}

FEHLENDE PFLICHTFELDER: ${missing.length > 0 ? missing.join(", ") : "✅ Alle Pflichtfelder erfasst"}

${isReadyForDraft(memory) && !memory.descriptionGenerated ? "HINWEIS: Alle Pflichtfelder sind erfasst. Fasse die Daten zusammen und frage ob alles korrekt ist." : ""}
${memory.descriptionGenerated ? "HINWEIS: Die Beschreibung wurde bereits generiert. Frage den Nutzer ob er zufrieden ist oder etwas ändern möchte." : ""}`;

  const recentTurns = turns.slice(-20);

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: memoryStr },
    ...recentTurns,
  ];
}

export function extractData(agentMessage: string): { cleanMessage: string; extracted: Record<string, unknown> | null } {
  const match = agentMessage.match(/###EXTRACTED###\s*([\s\S]*?)\s*###END###/);
  if (!match) return { cleanMessage: agentMessage, extracted: null };

  const cleanMessage = agentMessage.replace(/###EXTRACTED###[\s\S]*?###END###/, "").trim();
  try {
    const extracted = JSON.parse(match[1]);
    return { cleanMessage, extracted };
  } catch {
    return { cleanMessage, extracted: null };
  }
}

export function applyExtracted(memory: WorkingMemory, data: Record<string, unknown>): WorkingMemory {
  const m = { ...memory };

  if (data.type && typeof data.type === "string") {
    const typeMap: Record<string, string> = {
      eigentumswohnung: "ETW", wohnung: "ETW", etw: "ETW",
      einfamilienhaus: "EFH", efh: "EFH", haus: "EFH",
      mehrfamilienhaus: "MFH", mfh: "MFH",
      "doppelhaushälfte": "DHH", doppelhaus: "DHH", dhh: "DHH",
      reihenhaus: "RH", rh: "RH",
      "grundstück": "GRUNDSTUECK", grundstueck: "GRUNDSTUECK", land: "GRUNDSTUECK",
    };
    m.type = typeMap[data.type.toLowerCase()] || data.type.toUpperCase();
  }
  if (data.street) m.street = String(data.street);
  if (data.houseNumber) m.houseNumber = String(data.houseNumber);
  if (data.postcode) m.postcode = String(data.postcode);
  if (data.city) m.city = String(data.city);
  if (data.livingArea) m.livingArea = Number(data.livingArea);
  if (data.plotArea) m.plotArea = Number(data.plotArea);
  if (data.yearBuilt) m.yearBuilt = Number(data.yearBuilt);
  if (data.rooms) m.rooms = Number(data.rooms);
  if (data.bathrooms) m.bathrooms = Number(data.bathrooms);
  if (data.floor !== undefined) m.floor = Number(data.floor);
  if (data.condition) {
    const condMap: Record<string, string> = {
      erstbezug: "ERSTBEZUG", neubau: "NEUBAU", gepflegt: "GEPFLEGT",
      "renovierungsbedürftig": "RENOVIERUNGS_BEDUERFTIG", renovierungsbedurftig: "RENOVIERUNGS_BEDUERFTIG",
      "sanierungsbedürftig": "SANIERUNGS_BEDUERFTIG", sanierungsbedurftig: "SANIERUNGS_BEDUERFTIG",
      rohbau: "ROHBAU",
    };
    m.condition = condMap[String(data.condition).toLowerCase()] || String(data.condition).toUpperCase();
  }
  if (Array.isArray(data.attributes)) m.attributes = [...m.attributes, ...data.attributes.map(String)];
  if (data.hasEnergyCert !== undefined) m.hasEnergyCert = Boolean(data.hasEnergyCert);
  if (data.energyCertType) m.energyCertType = String(data.energyCertType).toUpperCase();
  if (data.energyClass) m.energyClass = String(data.energyClass);
  if (data.energyValue) m.energyValue = Number(data.energyValue);
  if (data.energySource) m.energySource = String(data.energySource);

  // Auto-advance phase
  if (m.type && m.phase === "greet") m.phase = "basics";
  if (m.street && m.city && m.phase === "basics") m.phase = "details";
  if (m.livingArea && m.condition && m.phase === "details") m.phase = "energy";
  if (m.hasEnergyCert !== null && m.phase === "energy") m.phase = "photos";
  if (isReadyForDraft(m) && m.phase === "photos") m.phase = "draft";

  return m;
}

export async function callAgent(messages: { role: string; content: string }[]): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY nicht konfiguriert");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://direkta.de",
      "X-Title": "Direkta Exposé Agent",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o",
      messages,
      temperature: 0.6,
      max_tokens: 800,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`KI-Fehler: ${err.substring(0, 200)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "Entschuldigung, ich konnte keine Antwort generieren.";
}
