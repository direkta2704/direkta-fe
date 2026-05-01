require("dotenv").config({ path: ".env.local" });
const { PrismaClient } = require("@prisma/client");

async function main() {
  const p = new PrismaClient();

  const parent = await p.property.findFirst({
    where: { type: "MFH", parentId: null, units: { some: {} } },
    include: { units: { include: { listings: { take: 1 } } }, listings: { take: 1 } },
    orderBy: { createdAt: "desc" },
  });

  if (!parent) { console.log("No MFH with units"); return; }

  // Set BOTH mode
  const info = (parent.buildingInfo as any) || {};
  info._sellingMode = "BOTH";
  await p.property.update({ where: { id: parent.id }, data: { buildingInfo: info } });

  // Package listing
  if (!parent.listings.length) {
    await p.listing.create({ data: { propertyId: parent.id, slug: "pkg-" + Date.now(), titleShort: "MFH Paket", status: "ACTIVE", askingPrice: 525000 } });
  } else {
    await p.listing.update({ where: { id: parent.listings[0].id }, data: { status: "ACTIVE", askingPrice: 525000 } });
  }

  // Unit listings
  for (const u of parent.units) {
    if (!u.listings.length) {
      await p.listing.create({ data: { propertyId: u.id, slug: "unit-" + Date.now() + u.unitLabel, titleShort: u.unitLabel, status: "ACTIVE", askingPrice: 190000 } });
    } else {
      await p.listing.update({ where: { id: u.listings[0].id }, data: { status: "ACTIVE" } });
    }
  }

  const r = await p.property.findUnique({ where: { id: parent.id }, include: { units: { include: { listings: { take: 1 } } }, listings: { take: 1 } } });
  console.log("Done! Mode: BOTH");
  console.log("Package:", r.listings[0]?.status, r.listings[0]?.id);
  r.units.forEach((u: any) => console.log("  " + u.unitLabel + ":", u.listings[0]?.status, u.listings[0]?.id));
  console.log("\nProperty:", parent.id);
  console.log("URL: http://localhost:3001/dashboard/properties/" + parent.id);

  await p.$disconnect();
}
main();
