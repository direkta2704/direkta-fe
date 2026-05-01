import { config } from "dotenv";
config({ path: ".env.local" });

import { isS3Enabled, uploadToS3, getFromS3 } from "../src/lib/s3";

async function main() {
  console.log("=== S3 Connectivity Test ===\n");
  console.log("Bucket:", process.env.AWS_S3_BUCKET);
  console.log("Region:", process.env.AWS_S3_REGION);
  console.log("Key ID:", process.env.AWS_ACCESS_KEY_ID?.slice(0, 8) + "...");
  console.log("Secret:", process.env.AWS_SECRET_ACCESS_KEY ? "SET" : "MISSING");
  console.log("isS3Enabled():", isS3Enabled());

  if (!isS3Enabled()) {
    console.log("\nS3 is disabled — check env vars");
    return;
  }

  // Test upload
  console.log("\n1. Testing upload...");
  try {
    const url = await uploadToS3("test/s3-check.txt", Buffer.from("hello-direkta"), "text/plain");
    console.log("   Upload OK:", url);
  } catch (e: any) {
    console.log("   Upload FAILED:", e.name, e.message);
    if (e.$metadata) console.log("   HTTP:", e.$metadata.httpStatusCode);
    return;
  }

  // Test read
  console.log("\n2. Testing read...");
  try {
    const data = await getFromS3("test/s3-check.txt");
    console.log("   Read:", data ? `OK (${data.contentLength} bytes)` : "FAILED (null)");
  } catch (e: any) {
    console.log("   Read FAILED:", e.message);
  }

  console.log("\n=== S3 is working ===");
}

main().catch((e) => console.error("Fatal:", e));
