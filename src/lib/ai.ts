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

const SYSTEM_PROMPT = `Du bist ein professioneller Immobilientexter für den deutschen Markt. Du erstellst hochwertige Exposé-Beschreibungen für Immobilieninserate.

Regeln:
- Schreibe auf Deutsch in der Sie-Form (formal)
- Neutraler, professioneller Marketington
- KEINE erfundenen Merkmale — beschreibe NUR, was in den Daten steht
- KEINE übertriebenen Superlative ("einmalig", "konkurrenzlos", "atemberaubend")
- Verwende KEINE Ausrufezeichen
- Beende die Beschreibung mit einem Energieausweis-Hinweis

Aufbau der Langbeschreibung (250–600 Wörter, 3 Absätze):
1. Die Immobilie: Typ, Lage, Größe, Zimmer, Zustand, besondere Merkmale
2. Die Umgebung: Stadtteil, Infrastruktur, Anbindung (allgemein basierend auf PLZ/Stadt)
3. Die Gelegenheit: Für wen eignet sich diese Immobilie, Preis-Leistung

Kurzbeschreibung: Max. 160 Zeichen, enthält Typ, Zimmer, Fläche und Stadt. Keine Ausrufezeichen.`;

export async function generateListingTexts(property: PropertyInput): Promise<{
  descriptionLong: string;
  titleShort: string;
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
      model: "anthropic/claude-sonnet-4-20250514",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Erstelle eine Exposé-Beschreibung für folgende Immobilie:

${propertyContext}

Antworte im folgenden JSON-Format (nur JSON, kein Markdown):
{
  "descriptionLong": "Die Langbeschreibung (250-600 Wörter, 3 Absätze, getrennt durch \\n\\n)",
  "titleShort": "Die Kurzbeschreibung (max. 160 Zeichen)"
}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("OpenRouter error:", err);
    throw new Error("KI-Textgenerierung fehlgeschlagen");
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
  };
}
