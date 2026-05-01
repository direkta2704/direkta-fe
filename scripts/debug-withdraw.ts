require("dotenv").config({ path: ".env.local" });
const { PrismaClient } = require("@prisma/client");

async function main() {
  const p = new PrismaClient();

  const listings = await p.listing.findMany({
    where: { status: { in: ["ACTIVE", "RESERVED", "DRAFT"] } },
    include: { property: { select: { id: true, parentId: true, type: true, unitLabel: true, buildingInfo: true } } },
    orderBy: { createdAt: "desc" },
  });

  console.log("ALL ACTIVE/RESERVED/DRAFT LISTINGS:\n");
  for (const l of listings) {
    const mode = (l.property.buildingInfo as any)?._sellingMode;
    console.log(
      l.status.padEnd(10),
      l.property.type.padEnd(4),
      (l.property.unitLabel || "PARENT").padEnd(12),
      "prop:" + l.property.id.slice(0, 12),
      "parent:" + (l.property.parentId?.slice(0, 12) || "null        "),
      "mode:" + (mode || "none").padEnd(12),
      (l.titleShort || "").slice(0, 35)
    );
  }

  // Check the RESERVED listing specifically
  const reserved = listings.find((l: any) => l.status === "RESERVED");
  if (reserved) {
    console.log("\n--- RESERVED listing details ---");
    console.log("Listing ID:", reserved.id);
    console.log("Property ID:", reserved.property.id);
    console.log("Property type:", reserved.property.type);
    console.log("Property parentId:", reserved.property.parentId);
    console.log("Selling mode:", (reserved.property.buildingInfo as any)?._sellingMode);

    // Check if this property has child units
    const units = await p.property.findMany({
      where: { parentId: reserved.property.id },
      include: { listings: { take: 1 } },
    });
    console.log("Child units:", units.length);
    units.forEach((u: any) => console.log("  " + u.unitLabel, u.listings[0]?.status || "no listing"));

    // Check if child units belong to same parent
    const activeETWs = listings.filter((l: any) => l.property.type === "ETW" && l.status === "ACTIVE");
    console.log("\nActive ETW listings:", activeETWs.length);
    activeETWs.forEach((l: any) => console.log("  parentId:", l.property.parentId, "=== reserved propId?", l.property.parentId === reserved.property.id));
  }

  await p.$disconnect();
}
main();
