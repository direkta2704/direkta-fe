/**
 * IS24 REST API smoke test — verifies stored OAuth tokens work
 * and tests basic API operations against the sandbox.
 *
 * Prerequisites: Run `npx tsx scripts/is24-authorize.ts` first to obtain tokens.
 * Usage:         npx tsx scripts/test-is24-api.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  console.log("=== IS24 REST API Test ===\n");

  const key = process.env.IS24_CONSUMER_KEY;
  const token = process.env.IS24_ACCESS_TOKEN;
  if (!key) {
    console.error("IS24_CONSUMER_KEY not set. Check .env.local");
    process.exit(1);
  }
  if (!token) {
    console.error("IS24_ACCESS_TOKEN not set. Run: npx tsx scripts/is24-authorize.ts");
    process.exit(1);
  }

  console.log("Consumer Key:", key);
  console.log("Sandbox:", process.env.IS24_USE_SANDBOX === "true" ? "YES" : "NO");
  console.log("Access Token:", token.slice(0, 8) + "...");
  console.log();

  const { testConnection, IS24ApiDriver } = await import("../src/lib/is24-api-driver");

  // 1. Test connection
  console.log("1. Testing API connection...");
  const conn = await testConnection();
  if (conn.ok) {
    console.log(`   ✓ ${conn.message} (${conn.listings} listings on account)`);
  } else {
    console.error(`   ✗ Failed: ${conn.message}`);
    process.exit(1);
  }

  // 2. Test publish
  console.log("\n2. Publishing test listing...");
  const driver = new IS24ApiDriver();

  const result = await driver.publish({
    title: "TEST – 3-Zi-Wohnung Berlin (Direkta Sandbox)",
    description:
      "Automatisierter Testlauf von Direkta. " +
      "Helle 3-Zimmer-Wohnung mit Balkon in ruhiger Lage. " +
      "Die Wohnung verfügt über ein geräumiges Wohnzimmer, " +
      "eine moderne Einbauküche und ein Tageslichtbad.",
    price: 349000,
    propertyType: "ETW",
    livingArea: 78.5,
    rooms: 3,
    city: "Berlin",
    postcode: "10115",
    street: "Musterstraße",
    houseNumber: "42",
    photos: [],
    energyClass: "C",
    energyValue: 95.5,
  });
  console.log(`   ✓ Created: ${result.externalListingId}`);
  console.log(`   ✓ URL: ${result.externalUrl}`);

  // 3. Test stats
  console.log("\n3. Fetching stats...");
  const stats = await driver.fetchStats(result.externalListingId);
  console.log("   ✓ Stats:", stats);

  // 4. Test update
  console.log("\n4. Updating listing title...");
  await driver.update(result.externalListingId, { title: "TEST – Updated Title (Direkta)" });
  console.log("   ✓ Updated");

  // 5. Test pause
  console.log("\n5. Pausing listing...");
  await driver.pause(result.externalListingId);
  console.log("   ✓ Paused");

  // 6. Clean up
  console.log("\n6. Withdrawing test listing...");
  await driver.withdraw(result.externalListingId);
  console.log("   ✓ Withdrawn");

  console.log("\n=== All tests passed ===");
}

main().catch((e) => {
  console.error("\nError:", e instanceof Error ? e.message : e);
  process.exit(1);
});
