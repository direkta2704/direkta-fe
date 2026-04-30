/**
 * IS24 OAuth Authorization — one-time setup.
 *
 * This script walks you through the 3-legged OAuth flow:
 *   1. Gets a request token from IS24
 *   2. Opens the IS24 authorization page in your browser
 *   3. You log in and grant access → IS24 shows you a verifier PIN
 *   4. You paste the PIN here
 *   5. Script exchanges it for an access token
 *   6. Prints the env vars to add to .env.local
 *
 * Usage:  npx tsx scripts/is24-authorize.ts
 *
 * After running, add the printed tokens to your .env.local file.
 * Access tokens are long-lived (they don't expire until revoked).
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import * as readline from "readline";

async function main() {
  console.log("=== IS24 OAuth Authorization ===\n");

  const key = process.env.IS24_CONSUMER_KEY;
  if (!key) {
    console.error("IS24_CONSUMER_KEY not set in .env.local");
    process.exit(1);
  }

  const sandbox = process.env.IS24_USE_SANDBOX === "true";
  console.log(`Mode: ${sandbox ? "SANDBOX" : "PRODUCTION"}`);
  console.log(`Consumer Key: ${key}\n`);

  const { startOAuthFlow, completeOAuthFlow, testConnection } = await import(
    "../src/lib/is24-api-driver"
  );

  // Step 1: Get request token
  console.log("Step 1: Requesting OAuth token...");
  const { requestToken, requestTokenSecret, authorizeUrl } = await startOAuthFlow();
  console.log("   ✓ Request token obtained\n");

  // Step 2: User authorizes in browser
  console.log("Step 2: Open this URL in your browser and grant access:\n");
  console.log(`   ${authorizeUrl}\n`);

  // Try to open the URL automatically
  try {
    const { exec } = await import("child_process");
    const cmd =
      process.platform === "win32"
        ? `start "" "${authorizeUrl}"`
        : process.platform === "darwin"
          ? `open "${authorizeUrl}"`
          : `xdg-open "${authorizeUrl}"`;
    exec(cmd);
    console.log("   (Opened in your default browser)\n");
  } catch {
    console.log("   (Could not open automatically — please copy the URL above)\n");
  }

  console.log("After granting access, IS24 will show you a verifier PIN.");
  console.log('It might appear on the page or in the URL as "oauth_verifier=...".\n');

  // Step 3: Get verifier from user
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const verifier = await new Promise<string>((resolve) => {
    rl.question("Paste the verifier PIN here: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  if (!verifier) {
    console.error("No verifier provided. Aborting.");
    process.exit(1);
  }

  // Step 4: Exchange for access token
  console.log("\nStep 3: Exchanging for access token...");
  const { accessToken, accessTokenSecret } = await completeOAuthFlow(
    requestToken,
    requestTokenSecret,
    verifier
  );
  console.log("   ✓ Access token obtained!\n");

  // Step 5: Verify it works
  console.log("Step 4: Verifying connection...");
  const test = await testConnection();
  if (test.ok) {
    console.log(`   ✓ ${test.message} (${test.listings} existing listings)\n`);
  } else {
    console.log(`   ⚠ Connection test returned: ${test.message}\n`);
  }

  // Step 6: Print the env vars
  console.log("════════════════════════════════════════════════════════════");
  console.log("Add these lines to your .env.local file:\n");
  console.log(`IS24_ACCESS_TOKEN="${accessToken}"`);
  console.log(`IS24_ACCESS_TOKEN_SECRET="${accessTokenSecret}"`);
  console.log("\n════════════════════════════════════════════════════════════");
  console.log("\nThese tokens are long-lived and won't expire unless revoked.");
}

main().catch((e) => {
  console.error("\nError:", e instanceof Error ? e.message : e);
  process.exit(1);
});
