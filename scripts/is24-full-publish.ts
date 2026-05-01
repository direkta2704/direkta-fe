import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { IS24ApiDriver, testConnection } from "../src/lib/is24-api-driver";
import { getFromS3 } from "../src/lib/s3";

async function main() {
  const prisma = new PrismaClient();
  const driver = new IS24ApiDriver();

  // Check connection
  const conn = await testConnection();
  console.log("Connection:", conn.ok, "| Existing listings:", conn.listings);

  // Load listing with all data
  const listing = await prisma.listing.findUnique({
    where: { id: "cmojjg3zw003dj0iwxh8z0hm1" },
    include: {
      property: {
        include: {
          energyCert: true,
          media: { where: { kind: "PHOTO" }, orderBy: { ordering: "asc" } },
          user: { select: { name: true, email: true, phone: true } },
        },
      },
    },
  });

  if (!listing) {
    console.error("Listing not found");
    return;
  }

  const p = listing.property;
  console.log("\nProperty:", p.type, p.city, p.street, p.houseNumber);
  console.log("Photos:", p.media.length);

  // Test S3 access
  if (p.media.length > 0) {
    const key = p.media[0].storageKey.replace(/^\/+/, "");
    console.log("\nTesting S3 access for:", key);
    const s3 = await getFromS3(key);
    if (s3) {
      console.log("  OK:", s3.contentType, s3.contentLength, "bytes");
    } else {
      console.log("  FAILED - S3 returned null");
    }
  }

  // Split name
  const parts = (p.user?.name || "Eigentümer").split(" ");
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ") || "Direkta";

  console.log("\nPublishing to IS24...");
  const result = await driver.publish({
    title: listing.titleShort || `${p.street} ${p.houseNumber}`,
    description: listing.descriptionLong || "",
    price: listing.askingPrice ? Number(listing.askingPrice) : 0,
    propertyType: p.type,
    livingArea: p.livingArea,
    plotArea: p.plotArea,
    rooms: p.rooms,
    bathrooms: p.bathrooms,
    floor: p.floor,
    yearBuilt: p.yearBuilt,
    condition: p.condition,
    attributes: (p.attributes as string[]) || [],
    city: p.city,
    postcode: p.postcode,
    street: p.street,
    houseNumber: p.houseNumber,
    photos: p.media.map((m) => m.storageKey),
    energyClass: p.energyCert?.energyClass || null,
    energyValue: p.energyCert?.energyValue || null,
    energyCertType: p.energyCert?.type || null,
    energyPrimarySource: p.energyCert?.primarySource || null,
    sellerFirstName: firstName,
    sellerLastName: lastName,
    sellerEmail: p.user?.email || null,
    sellerPhone: p.user?.phone || null,
  });

  console.log("\n=== PUBLISHED ===");
  console.log("ID:", result.externalListingId);
  console.log("URL:", result.externalUrl);

  // Update DB
  await prisma.syndicationTarget.updateMany({
    where: { listingId: listing.id },
    data: {
      status: "LIVE",
      externalListingId: result.externalListingId,
      externalUrl: result.externalUrl,
      lastSyncedAt: new Date(),
    },
  });
  console.log("DB updated");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
