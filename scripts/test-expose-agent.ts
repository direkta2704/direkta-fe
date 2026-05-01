/**
 * End-to-end test of the Expose Agent core.
 * Usage: npx tsx scripts/test-expose-agent.ts
 */
require("dotenv").config({ path: ".env.local" });

async function main() {
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();

  console.log("=== EXPOSE AGENT E2E TEST ===\n");

  const apiKey = process.env.OPENROUTER_API_KEY;
  console.log("OpenRouter API Key:", apiKey ? "SET" : "MISSING");
  if (!apiKey) { console.log("Cannot test without API key"); return; }

  const users = await prisma.user.findMany({ take: 1 });
  if (users.length === 0) { console.log("No users in DB"); return; }
  const user = users[0];
  console.log("Test user:", user.email);

  const { runAgentTurn, INITIAL_MEMORY, MAX_COST_CENTS } = require("../src/lib/expose-agent");

  // Create conversation + agent run
  const conversationId = "test-" + Date.now();
  await prisma.conversation.create({
    data: { id: conversationId, userId: user.id, agentKind: "EXPOSE", status: "ACTIVE" },
  });
  const agentRun = await prisma.agentRun.create({
    data: { agentKind: "EXPOSE", conversationId, goal: "Test Expose", status: "RUNNING", costCents: 0 },
  });
  console.log("Conversation:", conversationId);

  const ctx = {
    conversationId,
    agentRunId: agentRun.id,
    userId: user.id,
    startingCostCents: 0,
  };

  let memory = { ...INITIAL_MEMORY };

  try {
    // Turn 1: Greeting (no user message)
    console.log("\n1. Agent greeting...");
    const t1 = await runAgentTurn(ctx, memory, [], null);
    console.log("   Response:", t1.agentMessage?.slice(0, 200));
    console.log("   Cost:", t1.costCentsThisTurn, "cents");
    memory = t1.memory;
    ctx.startingCostCents = t1.costCentsTotal;

    // Turn 2: User provides property info
    console.log("\n2. User sends property info...");
    const userMsg = "Ich möchte eine 3-Zimmer-Eigentumswohnung in Berlin verkaufen. Die Adresse ist Schönhauser Allee 123, 10437 Berlin.";
    const history = [
      { role: "assistant", content: t1.agentMessage },
      { role: "user", content: userMsg },
    ];

    const t2 = await runAgentTurn(ctx, memory, history, userMsg);
    console.log("   Response:", t2.agentMessage?.slice(0, 200));
    console.log("   Cost:", t2.costCentsThisTurn, "cents | Total:", t2.costCentsTotal);
    console.log("   Tools:", t2.toolStepsExecuted);
    memory = t2.memory;

    // Check memory
    console.log("\n3. Memory state:");
    console.log("   type:", memory.type);
    console.log("   city:", memory.city);
    console.log("   street:", memory.street);
    console.log("   postcode:", memory.postcode);
    console.log("   rooms:", memory.rooms);
    console.log("   phase:", memory.phase);
    console.log("   addressValidated:", memory.addressValidated);

    console.log("\n=== TEST PASSED ===");
    console.log("Total cost:", t2.costCentsTotal, "cents of", MAX_COST_CENTS, "budget");

  } catch (e: any) {
    console.error("\nTEST FAILED:", e.message);
    console.error(e.stack?.split("\n").slice(0, 5).join("\n"));
  }

  // Cleanup
  await prisma.conversationTurn.deleteMany({ where: { conversationId } });
  await prisma.agentStep.deleteMany({ where: { agentRunId: agentRun.id } });
  await prisma.agentRun.delete({ where: { id: agentRun.id } });
  await prisma.conversation.delete({ where: { id: conversationId } });
  console.log("Test data cleaned up.");
  await prisma.$disconnect();
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
