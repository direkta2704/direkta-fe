require("dotenv").config({ path: ".env.local" });

async function main() {
  const { PrismaClient } = require("@prisma/client");
  const p = new PrismaClient();

  console.log("=== AUTO-WITHDRAW TEST ===\n");

  // Find MFH parent with units
  const parents = await p.property.findMany({
    where: { type: "MFH", parentId: null },
    include: {
      units: { include: { listings: { take: 1 } } },
      listings: { take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  for (const pr of parents) {
    const mode = (pr.buildingInfo as any)?._sellingMode;
    console.log(`${pr.street} ${pr.houseNumber} | mode: ${mode} | parent listings: ${pr.listings.length} | units: ${pr.units.length}`);
    pr.units.forEach((u: any) => console.log(`  ${u.unitLabel}: ${u.listings[0]?.status || "no listing"} (${u.listings[0]?.id?.slice(0, 12) || "-"})`));
    if (pr.listings[0]) console.log(`  Package: ${pr.listings[0].status} (${pr.listings[0].id.slice(0, 12)})`);
  }

  // Find one with BOTH mode and listings
  const testParent = parents.find((pr: any) => {
    const mode = (pr.buildingInfo as any)?._sellingMode;
    return (mode === "BOTH" || mode === "INDIVIDUAL") && pr.units.some((u: any) => u.listings.length > 0);
  });

  if (!testParent) {
    console.log("\nNo suitable MFH with BOTH/INDIVIDUAL mode and unit listings found.");
    console.log("Setting up test data...");

    // Use the first MFH with units
    const parent = parents.find((pr: any) => pr.units.length > 0);
    if (!parent) { console.log("No MFH with units found"); await p.$disconnect(); return; }

    // Set mode to BOTH
    const existing = (parent.buildingInfo as any) || {};
    await p.property.update({ where: { id: parent.id }, data: { buildingInfo: { ...existing, _sellingMode: "BOTH" } } });

    // Create package listing if none
    if (parent.listings.length === 0) {
      await p.listing.create({ data: { propertyId: parent.id, slug: `test-package-${Date.now()}`, titleShort: "TEST Package", status: "DRAFT" } });
    }

    // Create unit listings if none
    for (const unit of parent.units) {
      if (unit.listings.length === 0) {
        await p.listing.create({ data: { propertyId: unit.id, slug: `test-unit-${Date.now()}-${unit.unitLabel}`, titleShort: `TEST ${unit.unitLabel}`, status: "DRAFT" } });
      }
    }

    console.log("Test data created. Re-running...\n");
    // Refetch
    const refreshed = await p.property.findUnique({
      where: { id: parent.id },
      include: { units: { include: { listings: { take: 1 } } }, listings: { take: 1 } },
    });
    if (!refreshed) { await p.$disconnect(); return; }

    console.log("BEFORE: Package listing:", refreshed.listings[0]?.status);
    refreshed.units.forEach((u: any) => console.log(`  ${u.unitLabel}: ${u.listings[0]?.status}`));

    // Simulate: RESERVE the package listing via API
    console.log("\n--- Simulating: Package gets RESERVED ---");
    const packageListingId = refreshed.listings[0]?.id;
    if (packageListingId) {
      const res = await fetch(`http://localhost:3001/api/listings/${packageListingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: "" },
        body: JSON.stringify({ status: "RESERVED" }),
      });
      console.log("PATCH response:", res.status);

      // Check results
      const after = await p.property.findUnique({
        where: { id: parent.id },
        include: { units: { include: { listings: { take: 1 } } }, listings: { take: 1 } },
      });
      console.log("\nAFTER:");
      console.log("Package listing:", after?.listings[0]?.status);
      after?.units.forEach((u: any) => console.log(`  ${u.unitLabel}: ${u.listings[0]?.status}`));

      const allWithdrawn = after?.units.every((u: any) => u.listings[0]?.status === "WITHDRAWN");
      console.log("\n" + (allWithdrawn ? "✓ All unit listings auto-withdrawn!" : "✗ Unit listings NOT withdrawn"));

      // Reset
      console.log("\n--- Resetting test data ---");
      await p.listing.update({ where: { id: packageListingId }, data: { status: "DRAFT" } });
      for (const u of (after?.units || [])) {
        if (u.listings[0]) await p.listing.update({ where: { id: u.listings[0].id }, data: { status: "DRAFT" } });
      }
      console.log("Reset complete.");
    }
  }

  await p.$disconnect();
}
main().catch(e => console.error(e));
