/**
 * Migrate all locally-stored media assets to S3.
 * Updates the storageKey in the database to the S3 URL.
 *
 * Usage: npx tsx scripts/migrate-photos-to-s3.ts
 */

require("dotenv").config({ path: ".env.local" });

async function main() {
  const { isS3Enabled, uploadToS3 } = require("../src/lib/s3");
  const { PrismaClient } = require("@prisma/client");
  const { readFile } = require("fs/promises");
  const { join } = require("path");

  if (!isS3Enabled()) {
    console.error("S3 is not enabled. Check AWS env vars.");
    process.exit(1);
  }

  const prisma = new PrismaClient();

  // Find all media assets with local storage keys
  const localAssets = await prisma.mediaAsset.findMany({
    where: {
      storageKey: { startsWith: "/uploads/" },
    },
  });

  console.log(`Found ${localAssets.length} locally-stored assets to migrate.\n`);

  let migrated = 0;
  let failed = 0;

  for (const asset of localAssets) {
    const localKey = asset.storageKey.replace(/^\/+/, "");
    const localPath = join(process.cwd(), "public", localKey);

    // Build S3 key: properties/{propertyId}/{filename}
    const parts = localKey.split("/");
    const fileName = parts[parts.length - 1];
    const s3Key = `properties/${asset.propertyId}/${fileName}`;

    try {
      const buf = await readFile(localPath);
      const s3Url = await uploadToS3(s3Key, buf, asset.mimeType);

      await prisma.mediaAsset.update({
        where: { id: asset.id },
        data: { storageKey: s3Url },
      });

      migrated++;
      console.log(`  ✓ ${asset.kind} ${fileName} (${(buf.length / 1024).toFixed(0)} KB) → S3`);
    } catch (e: any) {
      failed++;
      console.log(`  ✗ ${fileName}: ${e.message}`);
    }
  }

  console.log(`\n=== Migration complete: ${migrated} migrated, ${failed} failed ===`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
