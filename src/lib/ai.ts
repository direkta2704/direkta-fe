interface PropertyInput {
  type: string;
  street: string;
  houseNumber: string;
  postcode: string;
  city: string;
  livingArea: number;
  plotArea: number | null;
  yearBuilt: number | null;
  rooms: number | null;
  bathrooms: number | null;
  floor: number | null;
  condition: string;
  attributes: string[] | null;
  energyCert: {
    type: string;
    energyClass: string;
    energyValue: number;
    primarySource: string;
  } | null;
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

function buildPropertyContext(p: PropertyInput): string {
  const lines = [
    `Immobilientyp: ${PROPERTY_TYPE_DE[p.type] || p.type}`,
    `Adresse: ${p.street} ${p.houseNumber}, ${p.postcode} ${p.city}`,
    `Wohnfläche: ${p.livingArea} m²`,
  ];
  if (p.plotArea) lines.push(`Grundstücksfläche: ${p.plotArea} m²`);
  if (p.rooms) lines.push(`Zimmer: ${p.rooms}`);
  if (p.bathrooms) lines.push(`Badezimmer: ${p.bathrooms}`);
  if (p.yearBuilt) lines.push(`Baujahr: ${p.yearBuilt}`);
  if (p.floor != null) lines.push(`Etage: ${p.floor}`);
  lines.push(`Zustand: ${CONDITION_DE[p.condition] || p.condition}`);
  if (p.attributes && p.attributes.length > 0) {
    lines.push(`Ausstattung: ${p.attributes.join(", ")}`);
  }
  if (p.energyCert) {
    lines.push(`Energieausweis: ${p.energyCert.type === "VERBRAUCH" ? "Verbrauchsausweis" : "Bedarfsausweis"}`);
    lines.push(`Energieklasse: ${p.energyCert.energyClass}`);
    lines.push(`Energieverbrauch: ${p.energyCert.energyValue} kWh/m²·a`);
    lines.push(`Primärenergieträger: ${p.energyCert.primarySource}`);
  }
  return lines.join("\n");
}

const SYSTEM_PROMPT = `Du bist ein professioneller Immobilientexter für den deutschen Markt. Du erstellst hochwertige Exposé-Inhalte für Immobilieninserate.

Regeln:
- Schreibe auf Deutsch in der Sie-Form (formal)
- Neutraler, professioneller Marketington
- KEINE erfundenen Merkmale — beschreibe NUR, was in den Daten steht
- KEINE übertriebenen Superlative ("einmalig", "konkurrenzlos", "atemberaubend")
- Verwende KEINE Ausrufezeichen
- Beende die Langbeschreibung mit einem Energieausweis-Hinweis

Du erstellst 5 Texte:

1. titleShort: Max. 160 Zeichen, enthält Typ, Zimmer, Fläche und Stadt.

2. descriptionLong: 250–600 Wörter, 3 Absätze (getrennt durch \\n\\n):
   - Absatz 1: Die Immobilie — Typ, Lage, Größe, Zimmer, Zustand, besondere Merkmale
   - Absatz 2: Die Umgebung — Stadtteil, Infrastruktur, Anbindung
   - Absatz 3: Die Gelegenheit — Für wen geeignet, Preis-Leistung, Energiehinweis

3. locationDescription: 80–150 Wörter über die Lage. Beschreibe Mikrolage (Wohncharakter, Versorgung, Schulen) und Erreichbarkeit (ÖPNV, Autobahn, Flughäfen). Basierend auf PLZ/Stadt — allgemeine aber plausible Angaben.

4. buildingDescription: 60–120 Wörter über das Gebäude. Bautyp, Baujahr, Zustand, Anzahl Etagen/Einheiten, Energiestandard. Nur aus den gegebenen Daten ableiten.

5. highlights: Array mit 4–6 kurzen Verkaufsargumenten (je max. 60 Zeichen). Z.B. "Fußbodenheizung in allen Räumen", "Energieklasse B", "Ruhige Wohnlage". Nur aus den Daten ableitbar.`;

export async function generateListingTexts(property: PropertyInput): Promise<{
  descriptionLong: string;
  titleShort: string;
  locationDescription: string;
  buildingDescription: string;
  highlights: string[];
}> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY ist nicht konfiguriert");
  }

  const propertyContext = buildPropertyContext(property);

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://direkta.de",
      "X-Title": "Direkta",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Erstelle eine Exposé-Beschreibung für folgende Immobilie:

${propertyContext}

Antworte im folgenden JSON-Format (nur JSON, kein Markdown):
{
  "titleShort": "Kurzbeschreibung (max. 160 Zeichen)",
  "descriptionLong": "Langbeschreibung (250-600 Wörter, 3 Absätze, getrennt durch \\n\\n)",
  "locationDescription": "Lagebeschreibung (80-150 Wörter, Mikrolage + Erreichbarkeit)",
  "buildingDescription": "Gebäudebeschreibung (60-120 Wörter)",
  "highlights": ["Highlight 1", "Highlight 2", "Highlight 3", "Highlight 4"]
}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("OpenRouter error:", response.status, err);
    throw new Error(`KI-Fehler (${response.status}): ${err.substring(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Keine Antwort von der KI erhalten");
  }

  const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(cleaned);

  if (!parsed.descriptionLong || !parsed.titleShort) {
    throw new Error("Ungültiges KI-Antwortformat");
  }

  if (parsed.titleShort.length > 160) {
    parsed.titleShort = parsed.titleShort.substring(0, 157) + "...";
  }

  return {
    descriptionLong: parsed.descriptionLong,
    titleShort: parsed.titleShort,
    locationDescription: parsed.locationDescription || "",
    buildingDescription: parsed.buildingDescription || "",
    highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
  };
}
