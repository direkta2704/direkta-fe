require("dotenv").config({ path: ".env.local" });
const { PrismaClient } = require("@prisma/client");

async function main() {
  const p = new PrismaClient();
  const conv = await p.conversation.findFirst({
    where: { agentKind: "EXPOSE", status: "ACTIVE" },
    orderBy: { startedAt: "desc" },
    include: {
      turns: { orderBy: { createdAt: "desc" }, take: 8 },
    },
  });
  if (!conv) { console.log("No active conversation"); await p.$disconnect(); return; }

  console.log("Conversation:", conv.id, "| started:", conv.startedAt);
  console.log("\nLast turns (newest first):");
  for (const t of conv.turns) {
    const preview = (t.content || "").slice(0, 150).replace(/\n/g, " ");
    console.log(`  [${t.role}] ${t.toolName || ""} ${preview}`);
    console.log(`       at ${t.createdAt}`);
  }

  const run = await p.agentRun.findFirst({
    where: { conversationId: conv.id },
    include: { steps: { orderBy: { ordinal: "desc" }, take: 5 } },
  });
  if (run) {
    console.log("\nAgent run:", run.status, "| cost:", run.costCents, "cents");
    console.log("Steps (newest first):");
    for (const s of run.steps) {
      console.log(`  ${s.ordinal}. ${s.toolName} ${s.ok ? "OK" : "FAIL"} ${s.error || ""}`);
    }
  }
  await p.$disconnect();
}
main();
