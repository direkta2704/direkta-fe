require("dotenv").config({ path: ".env.local" });
const { PrismaClient } = require("@prisma/client");
const { rebuildMemory } = require("../src/lib/expose-agent");

async function main() {
  const p = new PrismaClient();
  const conv = await p.conversation.findFirst({
    where: { id: "cmolfh1ih0013lsskz905yzpf" },
    include: { turns: { orderBy: { createdAt: "asc" } } },
  });
  if (!conv) { console.log("Not found"); return; }

  const memory = rebuildMemory(conv.turns);
  console.log("type:", memory.type);
  console.log("street:", JSON.stringify(memory.street));
  console.log("houseNumber:", JSON.stringify(memory.houseNumber));
  console.log("postcode:", JSON.stringify(memory.postcode));
  console.log("city:", JSON.stringify(memory.city));
  console.log("livingArea:", memory.livingArea);
  console.log("rooms:", memory.rooms);
  console.log("bathrooms:", memory.bathrooms);
  console.log("yearBuilt:", memory.yearBuilt);
  console.log("condition:", JSON.stringify(memory.condition));
  console.log("isReadyForDraft:", !!(memory.type && memory.street && memory.houseNumber && memory.postcode && memory.city && memory.livingArea && memory.condition));
  console.log("\nMissing:");
  if (!memory.type) console.log("  - type");
  if (!memory.street) console.log("  - street");
  if (!memory.houseNumber) console.log("  - houseNumber");
  if (!memory.postcode) console.log("  - postcode");
  if (!memory.city) console.log("  - city");
  if (!memory.livingArea) console.log("  - livingArea");
  if (!memory.condition) console.log("  - condition");

  await p.$disconnect();
}
main();
