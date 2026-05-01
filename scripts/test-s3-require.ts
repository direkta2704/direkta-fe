// Use require to ensure dotenv loads BEFORE s3 module
require("dotenv").config({ path: ".env.local" });

async function main() {
  const { isS3Enabled, uploadToS3, getFromS3 } = require("../src/lib/s3");

  console.log("isS3Enabled:", isS3Enabled());
  console.log("Bucket:", process.env.AWS_S3_BUCKET);

  if (!isS3Enabled()) {
    console.log("S3 disabled");
    return;
  }

  try {
    const url = await uploadToS3("test/check.txt", Buffer.from("hello-direkta"), "text/plain");
    console.log("Upload OK:", url);
  } catch (e: any) {
    console.log("Upload FAILED:", e.name, e.message);
    if (e.$metadata) console.log("HTTP:", e.$metadata.httpStatusCode);
  }

  try {
    const data = await getFromS3("test/check.txt");
    console.log("Read:", data ? "OK" : "FAIL");
  } catch (e: any) {
    console.log("Read FAILED:", e.message);
  }
}

main();
