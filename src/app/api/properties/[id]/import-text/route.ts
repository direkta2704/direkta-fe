import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;
    const body = await req.json();
    const text = body.text;

    if (!text || text.length < 20) {
      return NextResponse.json({ error: "Text zu kurz. Bitte mehr Details angeben." }, { status: 400 });
    }

    const property = await prisma.property.findFirst({ where: { id, userId: user.id } });
    if (!property) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API Key fehlt" }, { status: 500 });

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
          {
            role: "system",
            content: `Du bist ein hochpraeziser Immobilien-Datenextraktions-Assistent. Deine Aufgabe ist es, JEDES Detail aus dem Text zu extrahieren — egal wie klein.

Du MUSST ein JSON-Objekt mit ALLEN folgenden Abschnitten zurueckgeben. Fuelle JEDEN Abschnitt so vollstaendig wie moeglich.

{
  "roomProgram": [
    Extrahiere JEDEN erwaeehnten Raum mit Name und Flaeche.
    Wenn mehrere Wohnungen beschrieben werden, liste ALLE Raeume ALLER Wohnungen.
    Format: {"name": "WE1 - Kochen/Essen", "area": 32.54}
    Wenn keine genaue m²-Zahl genannt wird aber eine ungefaehre Groesse, nutze diese.
  ],

  "specifications": {
    "Boden": {
      Extrahiere: Bodenbelag Wohnbereich, Kueche, Bad, Abstellraeume.
      z.B. "Wohn/Schlaf/Flur": "Holzdielen (Eiche), geklebt", "Baeder": "Grossformat-Fliesen, helle Toene"
    },
    "Waende & Decke": {
      Extrahiere: Wandoberflaeeche, Deckenhoehe, Badezimmer-Fliesen, Vorsatzschalen.
      z.B. "Waende": "Glatt gespachtelt", "Deckenhoehe": "2,70-2,80m", "Bad-Fliesen": "Bis 1,20m gefliest, Dusche bis Decke"
    },
    "Sanitaer": {
      Extrahiere: WC-Typ, Dusche, Waschtisch, Warmwasser, Waschmaschinenanschluss, Handtuchheizung.
      z.B. "WC": "Wandhaengend, Unterputz", "Dusche": "Bodengleich", "Warmwasser": "Durchlauferhitzer pro Wohnung"
    },
    "Heizung & Warmwasser": {
      Extrahiere: Heizungstyp, Verteilung, Waermepumpe-Vorbereitung, Energieklasse.
      z.B. "Heizung": "Gas-Zentralheizung (Bj. 2000)", "Verteilung": "Fussbodenheizung alle Raeume"
    },
    "Elektro & Smart Home": {
      Extrahiere: Rolllaeden, Smart-Home, Schalter, Verkabelung, Steuerung.
      z.B. "Rolllaeden": "Elektrische Motoren, App-steuerbar", "Smart Home": "Aktoren fuer Licht und Rolllaeden"
    },
    "Kueche": {
      Extrahiere: Kuechenform, Wasser, Starkstrom, Dunstabzug, Spuelmaschine.
      z.B. "Vorbereitung": "Kuechenzeile (1-Zeiler)", "Starkstrom": "Fuer Herd/Backofen"
    },
    "Tueren & Fenster": {
      Extrahiere: Tuerhoehe, Fenster-Zustand, Rolllaedentyp.
      z.B. "Innentüren": "2,10-2,11m (ueberhoeht)", "Fenster": "Bestand, einzelne getauscht"
    }
  },

  "buildingInfo": {
    Extrahiere ALLES zum Gebaeude: Typ, Baujahr, Anzahl Einheiten, Stellplaetze (aussen + Tiefgarage),
    Keller, Fahrradstellplaetze, Garten, Heizungsanlage, ehemalige Nutzung, Waermepumpe-Vorbereitung.
    Jedes Detail als eigenen Key-Value-Eintrag.
    z.B. "Gebaeudetyp": "MFH", "Baujahr": "1999/2000", "Stellplaetze aussen": "10 (6-7 verkauft)",
    "Tiefgarage": "6 Plaetze", "Keller": "Eigenes Abteil pro Wohnung", "Garten": "Geteilt, mit Wasser+Strom"
  },

  "highlights": [
    Erstelle 8-12 kurze, praegnante Stichpunkte die das Objekt besonders machen.
    z.B. "Fussbodenheizung in allen Raeumen", "Smart-Home vorbereitet", "Energieklasse B",
    "Hohe Raeume (2,70-2,80m)", "Garten mit Wasser- und Stromanschluss"
  ],

  "propertyUpdates": {
    "livingArea": Gesamtwohnflaeche als Zahl,
    "rooms": Gesamtzimmeranzahl als Zahl,
    "bathrooms": Anzahl Baeder als Zahl,
    "yearBuilt": Baujahr als Zahl,
    "condition": Einer von: "ERSTBEZUG", "NEUBAU", "GEPFLEGT", "RENOVIERUNGS_BEDUERFTIG", "SANIERUNGS_BEDUERFTIG", "ROHBAU",
    "attributes": Array von Ausstattungsmerkmalen wie ["Keller", "Stellplatz", "Garten", "Fussbodenheizung", "Aufzug", "Balkon", "Terrasse", "Einbaukueche", "Kamin"]
  }
}

WICHTIG:
- Extrahiere JEDES noch so kleine Detail
- Wenn der Text mehrere Wohnungen beschreibt, erfasse ALLE
- Nutze deutsche Begriffe
- Flaechen als Zahlen (nicht als String)
- Antworte NUR mit JSON, keine Erklaerungen
- Wenn etwas unklar ist, extrahiere trotzdem mit bestem Wissen
- MEHR ist besser als weniger — uebersehe NICHTS`,
          },
          { role: "user", content: `Extrahiere Immobiliendaten aus folgendem Text:\n\n${text}` },
        ],
        temperature: 0.2,
        max_tokens: 4000,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `KI-Fehler: ${err.substring(0, 200)}` }, { status: 500 });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let extracted;
    try {
      extracted = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "KI-Antwort konnte nicht verarbeitet werden" }, { status: 500 });
    }

    // Save to property
    const updateData: Record<string, unknown> = {};
    if (extracted.roomProgram) updateData.roomProgram = extracted.roomProgram;
    if (extracted.specifications) updateData.specifications = extracted.specifications;
    if (extracted.buildingInfo) updateData.buildingInfo = extracted.buildingInfo;

    // Also update basic property fields if extracted
    if (extracted.propertyUpdates) {
      const pu = extracted.propertyUpdates;
      if (pu.livingArea) updateData.livingArea = Number(pu.livingArea);
      if (pu.rooms) updateData.rooms = Number(pu.rooms);
      if (pu.bathrooms) updateData.bathrooms = Number(pu.bathrooms);
      if (pu.yearBuilt) updateData.yearBuilt = Number(pu.yearBuilt);
      if (pu.condition) updateData.condition = pu.condition;
      if (pu.attributes) updateData.attributes = pu.attributes;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.property.update({ where: { id }, data: updateData });
    }

    return NextResponse.json({
      ok: true,
      extracted,
      message: `${Object.keys(updateData).length} Felder aktualisiert`,
    });
  } catch (err) {
    console.error("Import error:", err);
    return NextResponse.json({ error: "Import fehlgeschlagen" }, { status: 500 });
  }
}
