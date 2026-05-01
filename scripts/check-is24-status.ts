require("dotenv").config({ path: ".env.local" });

async function main() {
  const { PrismaClient } = require("@prisma/client");
  const p = new PrismaClient();

  console.log("=== SYNDICATION TARGETS ===\n");
  const targets = await p.syndicationTarget.findMany({
    include: {
      listing: { select: { id: true, status: true, titleShort: true } },
      jobs: { orderBy: { scheduledFor: "desc" }, take: 1 },
    },
  });

  if (targets.length === 0) {
    console.log("No syndication targets found.");
  }

  for (const t of targets) {
    console.log("Listing:", t.listing?.titleShort?.slice(0, 50));
    console.log("  Listing status:", t.listing?.status);
    console.log("  Portal:", t.portal, "| Syndication:", t.status);
    console.log("  External ID:", t.externalListingId || "none");
    console.log("  URL:", t.externalUrl || "none");
    console.log("  Last synced:", t.lastSyncedAt || "never");
    if (t.jobs[0]) console.log("  Last job:", t.jobs[0].kind, t.jobs[0].status, t.jobs[0].lastError || "");
    console.log();
  }

  // Test IS24 API connection
  console.log("=== IS24 API ===\n");
  const { testConnection } = require("../src/lib/is24-api-driver");
  const conn = await testConnection();
  console.log("Connection:", conn.ok ? "OK" : "FAILED");
  console.log("Message:", conn.message);
  console.log("Listings on IS24:", conn.listings);

  await p.$disconnect();
}
main();
