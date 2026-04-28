interface PropertyData {
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
  condition: string;
  attributes: string[] | null;
  energyCert: { type: string; energyClass: string; energyValue: number; primarySource: string } | null;
}

const SYSTEM = `Du bist ein professioneller Immobilientexter fuer den deutschen Markt.
Du erstellst hochwertige Expose-Texte im Stil von Engel & Voelkers oder Sotheby's.
Schreibe auf Deutsch, formell (Sie-Form), neutral-professionell.
KEINE Ausrufezeichen, KEINE uebertriebenen Superlative.
Antworte NUR mit dem angeforderten JSON — kein Markdown, keine Erklaerung.`;

export async function generateExposeContent(property: PropertyData): Promise<{
  exposeHeadline: string;
  exposeSubheadline: string;
  locationDescription: string;
  buildingDescription: string;
  highlights: string[];
}> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY nicht konfiguriert");

  const TYPE_DE: Record<string, string> = {
    ETW: "Eigentumswohnung", EFH: "Einfamilienhaus", MFH: "Mehrfamilienhaus",
    DHH: "Doppelhaushaelfte", RH: "Reihenhaus", GRUNDSTUECK: "Grundstueck",
  };

  const context = `
Immobilie: ${TYPE_DE[property.type] || property.type}
Adresse: ${property.street} ${property.houseNumber}, ${property.postcode} ${property.city}
Wohnflaeche: ${property.livingArea} m²
${property.plotArea ? `Grundstueck: ${property.plotArea} m²` : ""}
${property.rooms ? `Zimmer: ${property.rooms}` : ""}
${property.bathrooms ? `Badezimmer: ${property.bathrooms}` : ""}
${property.yearBuilt ? `Baujahr: ${property.yearBuilt}` : ""}
Zustand: ${property.condition}
${property.attributes?.length ? `Ausstattung: ${property.attributes.join(", ")}` : ""}
${property.energyCert ? `Energie: Klasse ${property.energyCert.energyClass}, ${property.energyCert.energyValue} kWh, ${property.energyCert.primarySource}` : ""}`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://direkta.de",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Erstelle fuer folgende Immobilie Expose-Inhalte:

${context}

Antworte als JSON:
{
  "exposeHeadline": "Kurze, praegnante Ueberschrift (max 60 Zeichen, editorial, z.B. 'Drei kernsanierte Wohnungen in Gaggenau.')",
  "exposeSubheadline": "Ergaenzende Zeile mit Adresse und Region (z.B. 'Marxstrasse 12 · 76571 Gaggenau · Baden-Wuerttemberg')",
  "locationDescription": "2-3 Absaetze ueber die Lage: Stadtteil/Ort Beschreibung, Infrastruktur (Einkaufen, Schulen, Aerzte), Verkehrsanbindung (Bahn, Autobahn, Flughafen). Ca. 150-200 Woerter.",
  "buildingDescription": "1-2 Absaetze ueber das Gebaeude: Bausubstanz, Zustand, besondere Merkmale. Ca. 100-150 Woerter.",
  "highlights": ["5-7 kurze Stichpunkte die die Immobilie besonders machen, z.B. 'Fussbodeheizung in allen Raeumen', 'Energieklasse B', etc."]
}` },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!res.ok) throw new Error("KI-Generierung fehlgeschlagen");

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";
  const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}
