require("dotenv").config({ path: ".env.local" });
async function main() {
  const { PrismaClient } = require("@prisma/client");
  const p = new PrismaClient();

  const listing = await p.listing.findFirst({ where: { status: "ACTIVE" }, select: { id: true, slug: true, titleShort: true } });
  if (!listing) { console.log("No active listing"); await p.$disconnect(); return; }
  console.log("Testing with:", listing.id, listing.titleShort?.slice(0, 40));

  // Test 1: Send inquiry
  console.log("\n1. Testing inquiry...");
  const inqRes = await fetch("http://localhost:3001/api/public/enquire", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      listingId: listing.id,
      name: "Max Müller",
      email: "max.test@example.com",
      phone: "+49 170 1234567",
      message: "Ich interessiere mich für diese Immobilie und würde gerne einen Besichtigungstermin vereinbaren.",
    }),
  });
  const inqData = await inqRes.json();
  console.log("   Status:", inqRes.status);
  console.log("   Response:", JSON.stringify(inqData));

  // Check lead was created
  const lead = await p.lead.findFirst({ where: { listingId: listing.id, emailRaw: "max.test@example.com" } });
  console.log("   Lead created:", lead ? `Yes (score: ${lead.qualityScore})` : "No");

  // Test 2: Submit offer
  console.log("\n2. Testing offer...");
  const offRes = await fetch("http://localhost:3001/api/public/offers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      listingId: listing.id,
      name: "Anna Schmidt",
      email: "anna.test@example.com",
      phone: "+49 171 9876543",
      amount: 260000,
      financingState: "PRE_APPROVED",
      desiredClosingAt: "2026-07-01",
      conditions: "Keine besonderen Bedingungen",
    }),
  });
  const offData = await offRes.json();
  console.log("   Status:", offRes.status);
  console.log("   Response:", JSON.stringify(offData));

  // Check offer was created
  const offer = await p.offer.findFirst({ where: { listingId: listing.id, buyer: { email: "anna.test@example.com" } } });
  console.log("   Offer created:", offer ? `Yes (score: ${offer.scoreComposite}, amount: €${Number(offer.amount).toLocaleString("de-DE")})` : "No");

  // Cleanup test data
  await p.lead.deleteMany({ where: { emailRaw: "max.test@example.com" } });
  await p.offer.deleteMany({ where: { buyer: { email: "anna.test@example.com" } } });
  await p.buyerProfile.deleteMany({ where: { email: "anna.test@example.com" } });
  console.log("\nTest data cleaned up.");

  await p.$disconnect();
}
main().catch(e => console.error(e));
