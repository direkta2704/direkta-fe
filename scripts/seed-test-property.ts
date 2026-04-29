/**
 * Seed script: creates the Marktstraße 12 test property with full data
 * extracted from the voice note (mix_8m57s.docx).
 *
 * Usage:  npx tsx scripts/seed-test-property.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Find the first user to assign the property to
  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) {
    console.error("No user found. Create one first via the auth flow.");
    process.exit(1);
  }
  console.log(`Using user: ${user.email} (${user.id})`);

  // Check if already seeded
  const existing = await prisma.property.findFirst({
    where: { street: "Marktstraße", houseNumber: "12", city: "Gaggenau", userId: user.id },
  });
  if (existing) {
    console.log(`Property already exists (${existing.id}). Updating...`);
    await prisma.property.update({
      where: { id: existing.id },
      data: { ...propertyData() },
    });
    console.log("Updated.");
    return;
  }

  const property = await prisma.property.create({
    data: {
      userId: user.id,
      ...propertyData(),
    },
  });
  console.log(`Created property: ${property.id}`);

  // Energy certificate
  await prisma.energyCertificate.create({
    data: {
      propertyId: property.id,
      type: "VERBRAUCH",
      validUntil: new Date("2034-12-31"),
      energyClass: "D",
      energyValue: 130,
      primarySource: "gas",
    },
  });
  console.log("Created energy certificate");

  // Listing
  const listing = await prisma.listing.create({
    data: {
      propertyId: property.id,
      status: "DRAFT",
      slug: `gaggenau/mfh-${property.id.slice(-4)}`,
      titleShort:
        "Kernsaniertes MFH mit 3 Wohneinheiten – Marktstraße 12, Gaggenau-Ottenau",
      descriptionLong: `In Gaggenau-Ottenau entsteht aus einer ehemaligen Gaststätte ein hochwertiges Mehrfamilienhaus mit drei modernen Wohneinheiten. Zwei großzügige Wohnungen mit je ca. 94–95 m² bieten jeweils zwei Schlafzimmer, einen offenen Wohn-/Essbereich, Abstellkammer und ein großes Bad. Die dritte, kompakte Wohnung mit ca. 55 m² verfügt über ein Schlafzimmer und einen großen Wohn-/Essbereich.

Alle Wohnungen werden im gleichen hochwertigen Stil ausgestattet: Fußbodenheizung, glatt gespachtelte Wände, geklebte Holzdielenböden, hohe Türen (2,10 m) und eine Deckenhöhe von ca. 2,70–2,80 m. Die Bäder erhalten helle Fliesen, bodengleiche Duschen und elektrische Handtuchheizkörper. Elektrische Rollläden und Smart-Home-Grundausstattung mit App-Steuerung runden das moderne Wohnkonzept ab.

Das Gebäude verfügt über 10 Außenstellplätze und 6 Tiefgaragenstellplätze. Ein geteilter Garten mit Wasser- und Stromanschluss, eigene Kellerabteile pro Wohnung sowie Fahrradstellplätze im Kellervorraum komplettieren das Angebot. Die bestehende Gaszentralheizung wird genutzt, die Wohnungen sind jedoch für einen späteren Wärmepumpenanschluss vorbereitet.`,
      askingPrice: 850000,
      highlights: [
        "Fußbodenheizung in allen Räumen",
        "Smart-Home-Grundausstattung mit App-Steuerung",
        "Hohe Räume (2,70–2,80 m Deckenhöhe)",
        "Hochwertige Holzdielenböden, geklebt",
        "Elektrische Rollläden an allen Fenstern",
        "Wärmepumpe vorbereitet",
        "Eigener Kellerabteil pro Wohnung",
        "Garten mit Wasser- und Stromanschluss",
        "10 Außen- und 6 Tiefgaragenstellplätze",
        "Hohe Türen (2,10 m)",
      ],
      locationDescription:
        "Gaggenau-Ottenau liegt im nördlichen Schwarzwald und bietet eine ideale Mischung aus Natur und Infrastruktur. Einkaufsmöglichkeiten, Schulen und Ärzte sind fußläufig erreichbar. Die Anbindung an die B462 und den ÖPNV ermöglicht schnelle Verbindungen nach Rastatt, Baden-Baden und Karlsruhe.",
      buildingDescription:
        "Das Gebäude stammt aus den Jahren 1999/2000 und wird derzeit kernsaniert. Die ehemalige Gaststätte im Erdgeschoss wird in drei hochwertige Wohneinheiten umgebaut. Die bestehende Gaszentralheizung versorgt mehrere Parteien; die neuen Wohnungen erhalten Fußbodenheizung und sind für einen späteren Wärmepumpenanschluss vorbereitet.",
      exposeHeadline: "Wohnen neu gedacht – Kernsaniert in Gaggenau-Ottenau",
      exposeSubheadline: "Marktstraße 12 · 76571 Gaggenau · Baden-Württemberg",
    },
  });
  console.log(`Created listing: ${listing.id} (slug: ${listing.slug})`);

  console.log("\nDone! Visit /dashboard/properties to see the test property.");
}

function propertyData() {
  return {
    type: "MFH" as const,
    street: "Marktstraße",
    houseNumber: "12",
    postcode: "76571",
    city: "Gaggenau",
    country: "DE",
    livingArea: 245,
    plotArea: null,
    yearBuilt: 2000,
    rooms: 8,
    bathrooms: 3,
    floor: null,
    condition: "ERSTBEZUG" as const,
    attributes: [
      "Keller",
      "Stellplatz",
      "Garten",
      "Fußbodenheizung",
    ],

    roomProgram: [
      { name: "WE1 – Wohnen/Essen", area: 38 },
      { name: "WE1 – Schlafzimmer 1", area: 16 },
      { name: "WE1 – Schlafzimmer 2", area: 14 },
      { name: "WE1 – Bad", area: 8.5 },
      { name: "WE1 – Abstellkammer", area: 4.5 },
      { name: "WE1 – Flur", area: 13 },
      { name: "WE2 – Wohnen/Essen", area: 38 },
      { name: "WE2 – Schlafzimmer 1", area: 16 },
      { name: "WE2 – Schlafzimmer 2", area: 14 },
      { name: "WE2 – Bad", area: 8.5 },
      { name: "WE2 – Abstellkammer", area: 4.5 },
      { name: "WE2 – Flur", area: 13 },
      { name: "WE3 – Wohnen/Essen", area: 24 },
      { name: "WE3 – Schlafzimmer", area: 13 },
      { name: "WE3 – Bad", area: 6.5 },
      { name: "WE3 – Flur", area: 8.5 },
    ],

    specifications: {
      Boden: {
        "Wohn-/Schlaf-/Flurbereich": "Holzdielen (Eiche), geklebt",
        Bäder: "Großformatfliesen, helle/beige Töne",
      },
      "Waende & Decke": {
        Wände: "Glatt gespachtelt, weiß",
        Deckenhöhe: "ca. 2,70–2,80 m (Fertigmaß)",
        "Bad-Wandfliesen": "Helle Fliesen bis 1,20 m Höhe",
        "Duschbereich": "Fliesen bis Deckenhöhe",
        Vorsatzschale: "ca. 20 cm Tiefe, als Ablagefläche nutzbar",
      },
      Sanitaer: {
        Dusche: "Bodengleich, geflieste Duschrinne",
        WC: "Wandhängend, Unterputzspülkasten",
        Waschtisch: "Aufsatz- oder Einbauwaschtisch",
        Warmwasser: "Durchlauferhitzer pro Wohnung",
        "Küche Warmwasser": "Kleindurchlauferhitzer unter Spüle",
        Waschmaschine: "Anschluss im Bad (WE1/WE2), in Küche (WE3)",
        Handtuchheizung: "Elektrischer Handtuchheizkörper",
      },
      "Heizung & Warmwasser": {
        Heizungstyp: "Gas-Zentralheizung (Bestandsanlage, Bj. ~2000)",
        Verteilung: "Fußbodenheizung in allen Räumen",
        "Wärmepumpe": "Vorbereitung für späteren Anschluss",
        "Bad-Zusatzheizung": "Elektrischer Handtuchheizkörper",
      },
      "Elektro & Smart Home": {
        Rollläden: "Elektrische Motoren an allen Fenstern",
        "Smart Home": "Smarte Aktoren für Rollläden und Licht",
        Steuerung: "App-steuerbar (herstellerabhängig)",
      },
      Kueche: {
        Küchenform: "Vorbereitung für Küchenzeile (1-Zeiler)",
        Erweiterung: "L-Form möglich, nicht infrastrukturell vorbereitet",
        Anschlüsse: "Wasser, Strom, Kleindurchlauferhitzer",
      },
      "Tueren & Fenster": {
        Innentüren: "Überhohe Türen, ca. 2,10–2,11 m",
        Fenster: "Bestandsfenster, einzelne ausgetauscht/erweitert",
        Rollläden: "Elektrisch mit Smart-Home-Anbindung",
      },
    },

    buildingInfo: {
      Gebäudetyp: "Mehrfamilienhaus (ehem. Gaststätte)",
      Baujahr: "ca. 1999/2000",
      Wohneinheiten: "3 (2× ca. 95 m², 1× ca. 55 m²)",
      Gesamtwohnfläche: "ca. 245 m²",
      "Außenstellplätze": "10 (davon 6–7 verkauft)",
      Tiefgaragenstellplätze: "6",
      Keller: "Eigenes Abteil pro Wohnung",
      Fahrradstellplätze: "Im Kellervorraum, inkl. Kinderwagenplatz",
      Garten: "Geteilt (WE klein + WE groß unten), Wasser- und Stromanschluss",
      Heizungsanlage: "Gas-Zentralheizung (Bestand), geteilt mit weiteren Parteien",
      WEG: "3–4 weitere Eigentümer/Einheiten in dieser Gebäudehälfte",
      "Zählerschrank": "Neuer Hauptzählerschrank im Keller",
    },
  };
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
