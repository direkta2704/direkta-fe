/**
 * Populates ALL property data extracted from mix_8m57s.docx (voice note)
 * into the parent MFH and its 3 child apartments.
 *
 * Usage:  npx tsx scripts/populate-voice-note-data.ts
 */

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// ─── Building-level data (parent MFH) ──────────────────────

const PARENT_DATA = {
  livingArea: 245,
  rooms: 8,
  bathrooms: 3,
  yearBuilt: 2000,
  condition: "ERSTBEZUG" as const,
  attributes: [
    "Keller", "Stellplatz", "Garten", "Fußbodenheizung",
    "Smart Home", "Elektr. Rollläden", "Wärmepumpe",
  ],
  roomProgram: [
    { name: "WE1 – Wohnen/Essen", area: 38 },
    { name: "WE1 – Schlafzimmer 1", area: 16 },
    { name: "WE1 – Schlafzimmer 2", area: 14 },
    { name: "WE1 – Bad", area: 8.5 },
    { name: "WE1 – Abstellkammer", area: 4.5 },
    { name: "WE1 – Flur", area: 13.5 },
    { name: "WE2 – Wohnen/Essen", area: 38 },
    { name: "WE2 – Schlafzimmer 1", area: 16 },
    { name: "WE2 – Schlafzimmer 2", area: 14 },
    { name: "WE2 – Bad", area: 8.5 },
    { name: "WE2 – Abstellkammer", area: 4.5 },
    { name: "WE2 – Flur", area: 13.5 },
    { name: "WE3 – Wohnen/Essen", area: 24 },
    { name: "WE3 – Schlafzimmer", area: 13 },
    { name: "WE3 – Bad", area: 6.5 },
    { name: "WE3 – Flur", area: 8.5 },
  ],
  specifications: {
    "Boden": {
      "Wohn-/Schlaf-/Flurbereich": "Holzdielen, geklebt",
      "Bäder": "Großformatfliesen, helle/beige Töne",
    },
    "Waende & Decke": {
      "Wände": "Glatt gespachtelt, weiß",
      "Deckenhöhe": "ca. 2,70–2,80 m (Fertigmaß)",
      "Bad-Wandfliesen": "Helle Fliesen bis ca. 1,20 m Höhe",
      "Duschbereich": "Fliesen bis Deckenhöhe",
      "Vorsatzschale": "ca. 20 cm Tiefe, als Ablagefläche auf 1,20 m Höhe",
    },
    "Sanitaer": {
      "Dusche": "Bodengleich",
      "WC": "Wandhängend, Unterputzspülkasten",
      "Waschtisch": "Einbauwaschtisch",
      "Warmwasser": "Durchlauferhitzer je Wohnung",
      "Küche Warmwasser": "Kleindurchlauferhitzer unter Spüle",
      "Waschmaschine": "Anschluss im Bad (WE1/WE2), in Küche (WE3)",
      "Handtuchheizung": "Elektrischer Handtuchheizkörper je Bad",
    },
    "Heizung & Warmwasser": {
      "Heizungstyp": "Gas-Zentralheizung (Bestandsanlage, Bj. ca. 2000)",
      "Verteilung": "Fußbodenheizung in allen Räumen",
      "Wärmepumpe": "Vorbereitung für späteren Anschluss",
      "Bad-Zusatzheizung": "Elektrischer Handtuchheizkörper",
    },
    "Elektro & Smart Home": {
      "Rollläden": "Elektrische Motoren an allen Fenstern",
      "Smart Home": "Smarte Aktoren für Rollläden und Licht",
      "Steuerung": "App-steuerbar",
    },
    "Kueche": {
      "Küchenform": "Vorbereitung für Küchenzeile (1-Zeiler)",
      "Erweiterung": "L-Form möglich, nicht infrastrukturell vorbereitet",
      "Anschlüsse": "Wasser, Strom, Kleindurchlauferhitzer",
    },
    "Tueren & Fenster": {
      "Innentüren": "Überhohe Türen, ca. 2,10–2,11 m",
      "Fenster": "Bestandsfenster, einzelne ausgetauscht/erweitert",
      "Rollläden": "Elektrisch mit Smart-Home-Anbindung",
    },
  },
  buildingInfo: {
    "Gebäudetyp": "Mehrfamilienhaus (ehem. Gaststätte, ca. 250 m²)",
    "Baujahr": "ca. 1999/2000",
    "Wohneinheiten": "3 (2× ca. 95 m², 1× ca. 55 m²)",
    "Gesamtwohnfläche": "ca. 245 m²",
    "Außenstellplätze": "10 (davon 6–7 verkauft)",
    "Tiefgaragenstellplätze": "6",
    "Keller": "Eigenes Abteil pro Wohnung",
    "Fahrradstellplätze": "Im Kellervorraum, inkl. Kinderwagenplatz",
    "Garten": "Geteilt (WE3 + WE2 unten), Wasser- und Stromanschluss aus Keller",
    "Heizungsanlage": "Gas-Zentralheizung (Bestand), geteilt mit weiteren Parteien",
    "WEG": "3–4 weitere Eigentümer/Einheiten in dieser Gebäudehälfte",
    "Zählerschrank": "Neuer Hauptzählerschrank im Keller",
  },
};

// ─── Per-unit data ─────────────────────────────────────────

const UNITS_DATA: Record<string, {
  livingArea: number;
  rooms: number;
  bathrooms: number;
  floor: number;
  roomProgram: { name: string; area: number }[];
  specifications: Record<string, Record<string, string>>;
  buildingInfo: Record<string, string>;
}> = {
  WE1: {
    livingArea: 94.5,
    rooms: 3,
    bathrooms: 1,
    floor: 0,
    roomProgram: [
      { name: "Wohnen/Essen", area: 38 },
      { name: "Schlafzimmer 1", area: 16 },
      { name: "Schlafzimmer 2", area: 14 },
      { name: "Bad", area: 8.5 },
      { name: "Abstellkammer", area: 4.5 },
      { name: "Flur", area: 13.5 },
    ],
    specifications: {
      "Boden": {
        "Wohn-/Schlaf-/Flurbereich": "Holzdielen, geklebt",
        "Bad": "Großformatfliesen, helle/beige Töne",
      },
      "Waende & Decke": {
        "Wände": "Glatt gespachtelt, weiß",
        "Deckenhöhe": "ca. 2,70–2,80 m",
        "Bad-Wandfliesen": "Helle Fliesen bis 1,20 m, Dusche bis Decke",
        "Vorsatzschale": "20 cm Tiefe über WC, Waschtisch, Waschmaschine",
      },
      "Sanitaer": {
        "Dusche": "Bodengleich",
        "WC": "Wandhängend, Unterputz",
        "Warmwasser": "Durchlauferhitzer",
        "Waschmaschine": "Anschluss im Bad, Trockner aufstellbar",
        "Handtuchheizung": "Elektrischer Handtuchheizkörper",
      },
      "Heizung & Warmwasser": {
        "Heizung": "Fußbodenheizung (Gas-Zentralheizung)",
        "Wärmepumpe": "Vorbereitet",
      },
      "Elektro & Smart Home": {
        "Rollläden": "Elektrisch, App-steuerbar",
        "Smart Home": "Aktoren für Rollläden und Licht",
      },
      "Kueche": {
        "Vorbereitung": "Küchenzeile (1-Zeiler)",
        "Warmwasser": "Kleindurchlauferhitzer",
      },
      "Tueren & Fenster": {
        "Innentüren": "Überhohe Türen, ca. 2,10 m",
        "Fenster": "Bestand, einzelne getauscht",
        "Rollläden": "Elektrisch",
      },
    },
    buildingInfo: {
      "Lage im Gebäude": "Erdgeschoss, oben",
      "Keller": "Eigenes Kellerabteil",
      "Stellplätze": "Anteil an 10 Außen + 6 Tiefgarage",
    },
  },
  WE2: {
    livingArea: 94.5,
    rooms: 3,
    bathrooms: 1,
    floor: 0,
    roomProgram: [
      { name: "Wohnen/Essen", area: 38 },
      { name: "Schlafzimmer 1", area: 16 },
      { name: "Schlafzimmer 2", area: 14 },
      { name: "Bad", area: 8.5 },
      { name: "Abstellkammer", area: 4.5 },
      { name: "Flur", area: 13.5 },
    ],
    specifications: {
      "Boden": {
        "Wohn-/Schlaf-/Flurbereich": "Holzdielen, geklebt",
        "Bad": "Großformatfliesen, helle/beige Töne",
      },
      "Waende & Decke": {
        "Wände": "Glatt gespachtelt, weiß",
        "Deckenhöhe": "ca. 2,70–2,80 m",
        "Bad-Wandfliesen": "Helle Fliesen bis 1,20 m, Dusche bis Decke",
        "Vorsatzschale": "20 cm Tiefe über WC, Waschtisch, Waschmaschine",
      },
      "Sanitaer": {
        "Dusche": "Bodengleich",
        "WC": "Wandhängend, Unterputz",
        "Warmwasser": "Durchlauferhitzer",
        "Waschmaschine": "Anschluss im Bad, Trockner aufstellbar",
        "Handtuchheizung": "Elektrischer Handtuchheizkörper",
      },
      "Heizung & Warmwasser": {
        "Heizung": "Fußbodenheizung (Gas-Zentralheizung)",
        "Wärmepumpe": "Vorbereitet",
      },
      "Elektro & Smart Home": {
        "Rollläden": "Elektrisch, App-steuerbar",
        "Smart Home": "Aktoren für Rollläden und Licht",
      },
      "Kueche": {
        "Vorbereitung": "Küchenzeile (1-Zeiler)",
        "Warmwasser": "Kleindurchlauferhitzer",
      },
      "Tueren & Fenster": {
        "Innentüren": "Überhohe Türen, ca. 2,10 m",
        "Fenster": "Bestand, einzelne getauscht",
        "Rollläden": "Elektrisch",
      },
    },
    buildingInfo: {
      "Lage im Gebäude": "Erdgeschoss, unten",
      "Keller": "Eigenes Kellerabteil",
      "Garten": "Gartenanteil mit Wasser- und Stromanschluss",
      "Stellplätze": "Anteil an 10 Außen + 6 Tiefgarage",
    },
  },
  WE3: {
    livingArea: 55,
    rooms: 2,
    bathrooms: 1,
    floor: 0,
    roomProgram: [
      { name: "Wohnen/Essen", area: 24 },
      { name: "Schlafzimmer", area: 13 },
      { name: "Bad", area: 6.5 },
      { name: "Flur", area: 8.5 },
    ],
    specifications: {
      "Boden": {
        "Wohn-/Schlaf-/Flurbereich": "Holzdielen, geklebt",
        "Bad": "Großformatfliesen, helle/beige Töne",
      },
      "Waende & Decke": {
        "Wände": "Glatt gespachtelt, weiß",
        "Deckenhöhe": "ca. 2,70–2,80 m",
        "Bad-Wandfliesen": "Helle Fliesen bis 1,20 m, Dusche bis Decke",
        "Vorsatzschale": "20 cm Tiefe über WC, Waschtisch",
      },
      "Sanitaer": {
        "Dusche": "Bodengleich",
        "WC": "Wandhängend, Unterputz",
        "Warmwasser": "Durchlauferhitzer",
        "Waschmaschine": "Anschluss in der Küche",
        "Handtuchheizung": "Elektrischer Handtuchheizkörper",
      },
      "Heizung & Warmwasser": {
        "Heizung": "Fußbodenheizung (Gas-Zentralheizung)",
        "Wärmepumpe": "Vorbereitet",
      },
      "Elektro & Smart Home": {
        "Rollläden": "Elektrisch, App-steuerbar",
        "Smart Home": "Aktoren für Rollläden und Licht",
      },
      "Kueche": {
        "Vorbereitung": "Küchenzeile (1-Zeiler)",
        "Warmwasser": "Kleindurchlauferhitzer",
        "Waschmaschine": "Anschluss in Küchenzeile integriert",
      },
      "Tueren & Fenster": {
        "Innentüren": "Überhohe Türen, ca. 2,10 m",
        "Fenster": "Bestand, einzelne getauscht",
        "Rollläden": "Elektrisch",
      },
    },
    buildingInfo: {
      "Lage im Gebäude": "Erdgeschoss, kleine Wohnung",
      "Keller": "Eigenes Kellerabteil",
      "Garten": "Gartenanteil, direkter Zugang, Wasser- und Stromanschluss",
      "Stellplätze": "Anteil an 10 Außen + 6 Tiefgarage",
    },
  },
};

async function main() {
  const PARENT_ID = "cmoj0xjl60003j0pkkk5i2f1a";

  // ── Update parent MFH ────────────────────────────
  console.log("Updating parent MFH...");
  await prisma.property.update({
    where: { id: PARENT_ID },
    data: {
      livingArea: PARENT_DATA.livingArea,
      rooms: PARENT_DATA.rooms,
      bathrooms: PARENT_DATA.bathrooms,
      yearBuilt: PARENT_DATA.yearBuilt,
      condition: PARENT_DATA.condition,
      attributes: PARENT_DATA.attributes,
      roomProgram: PARENT_DATA.roomProgram,
      specifications: PARENT_DATA.specifications,
      buildingInfo: PARENT_DATA.buildingInfo,
    },
  });
  console.log("  ✓ 245 m², 8 rooms, 3 baths, 16 room-program entries, 7 spec categories, 12 building-info entries");

  // ── Create energy certificate if missing ─────────
  const existingCert = await prisma.energyCertificate.findFirst({ where: { propertyId: PARENT_ID } });
  if (!existingCert) {
    await prisma.energyCertificate.create({
      data: {
        propertyId: PARENT_ID,
        type: "VERBRAUCH",
        validUntil: new Date("2034-12-31"),
        energyClass: "D",
        energyValue: 130,
        primarySource: "gas",
      },
    });
    console.log("  ✓ Energy certificate: Class D, 130 kWh/m²a, Gas");
  } else {
    console.log("  ✓ Energy certificate already exists");
  }

  // ── Update each child unit ───────────────────────
  const units = await prisma.property.findMany({
    where: { parentId: PARENT_ID },
    orderBy: { unitLabel: "asc" },
  });

  for (const unit of units) {
    const label = unit.unitLabel || "";
    const data = UNITS_DATA[label];
    if (!data) {
      console.log(`  ⚠ No data for unit "${label}", skipping`);
      continue;
    }

    await prisma.property.update({
      where: { id: unit.id },
      data: {
        livingArea: data.livingArea,
        rooms: data.rooms,
        bathrooms: data.bathrooms,
        floor: data.floor,
        condition: PARENT_DATA.condition,
        yearBuilt: PARENT_DATA.yearBuilt,
        attributes: PARENT_DATA.attributes,
        roomProgram: data.roomProgram,
        specifications: data.specifications,
        buildingInfo: data.buildingInfo,
      },
    });

    const totalArea = data.roomProgram.reduce((s, r) => s + r.area, 0);
    console.log(`  ✓ ${label}: ${data.livingArea} m², ${data.rooms} Zi., ${data.roomProgram.length} rooms (${totalArea} m²), ${Object.keys(data.specifications).length} spec categories`);
  }

  console.log("\nDone! All data from voice note has been populated.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
