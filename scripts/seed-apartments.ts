/**
 * Seeds 3 apartment units (WE1, WE2, WE3) under the Marktstraße 12 parent property.
 * Uses data extracted from the voice note (mix_8m57s.docx).
 *
 * Usage:  npx tsx scripts/seed-apartments.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const UNITS = [
  {
    unitLabel: "WE1",
    livingArea: 94.5,
    rooms: 4,
    bathrooms: 1,
    floor: 0,
    roomProgram: [
      { name: "Wohnen/Essen", area: 38 },
      { name: "Schlafzimmer 1", area: 16 },
      { name: "Schlafzimmer 2", area: 14 },
      { name: "Bad", area: 8.5 },
      { name: "Abstellkammer", area: 4.5 },
      { name: "Flur", area: 13 },
    ],
  },
  {
    unitLabel: "WE2",
    livingArea: 94.5,
    rooms: 4,
    bathrooms: 1,
    floor: 0,
    roomProgram: [
      { name: "Wohnen/Essen", area: 38 },
      { name: "Schlafzimmer 1", area: 16 },
      { name: "Schlafzimmer 2", area: 14 },
      { name: "Bad", area: 8.5 },
      { name: "Abstellkammer", area: 4.5 },
      { name: "Flur", area: 13 },
    ],
  },
  {
    unitLabel: "WE3",
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
  },
];

async function main() {
  // Find the parent MFH property (the one with photos, or fallback to the seeded one)
  const parent = await prisma.property.findFirst({
    where: {
      street: { contains: "arkt" },
      houseNumber: "12",
      city: { contains: "aggenau" },
      parentId: null,
    },
    orderBy: { createdAt: "asc" },
  });

  if (!parent) {
    console.error("Parent property not found. Create the Marktstraße 12 property first.");
    process.exit(1);
  }
  console.log(`Parent: ${parent.street} ${parent.houseNumber} (${parent.id})`);

  for (const u of UNITS) {
    // Check if unit already exists
    const existing = await prisma.property.findFirst({
      where: { parentId: parent.id, unitLabel: u.unitLabel },
    });
    if (existing) {
      console.log(`  ${u.unitLabel} already exists (${existing.id}), skipping`);
      continue;
    }

    const unit = await prisma.property.create({
      data: {
        userId: parent.userId,
        parentId: parent.id,
        unitLabel: u.unitLabel,
        type: "ETW",
        street: parent.street,
        houseNumber: parent.houseNumber,
        postcode: parent.postcode,
        city: parent.city,
        country: parent.country,
        livingArea: u.livingArea,
        rooms: u.rooms,
        bathrooms: u.bathrooms,
        floor: u.floor,
        condition: parent.condition,
        attributes: parent.attributes ?? undefined,
        roomProgram: u.roomProgram,
        specifications: parent.specifications ?? undefined,
        buildingInfo: parent.buildingInfo ?? undefined,
        yearBuilt: parent.yearBuilt,
      },
    });
    console.log(`  Created ${u.unitLabel}: ${unit.id} (${u.livingArea} m², ${u.rooms} rooms)`);
  }

  console.log("\nDone! Visit the parent property page to see the apartments.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
