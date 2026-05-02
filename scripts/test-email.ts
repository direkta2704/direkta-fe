require("dotenv").config({ path: ".env.local" });
async function main() {
  const { sendVerificationEmail } = require("../src/lib/email");
  console.log("Sending test verification email...");
  await sendVerificationEmail("directa2704@gmail.com", "test-token-123");
  console.log("Email sent!");
}
main().catch(e => console.error("Failed:", e));
