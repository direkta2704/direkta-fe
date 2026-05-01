require("dotenv").config({ path: ".env.local" });

async function main() {
  const { runAgentTurn, INITIAL_MEMORY, MAX_COST_CENTS } = require("../src/lib/expose-agent");
  const { PrismaClient } = require("@prisma/client");
  const p = new PrismaClient();
  const user = (await p.user.findMany({ take: 1 }))[0];

  const cid = "shorttest-" + Date.now();
  await p.conversation.create({ data: { id: cid, userId: user.id, agentKind: "EXPOSE", status: "ACTIVE" } });
  const ar = await p.agentRun.create({ data: { agentKind: "EXPOSE", conversationId: cid, goal: "Short answer test", status: "RUNNING", costCents: 0 } });
  const ctx = { conversationId: cid, agentRunId: ar.id, userId: user.id, startingCostCents: 0 };
  let m = { ...INITIAL_MEMORY };
  let h: Array<{ role: string; content: string }> = [];

  const g = await runAgentTurn(ctx, m, [], null);
  m = g.memory; ctx.startingCostCents = g.costCentsTotal;
  h.push({ role: "assistant", content: g.agentMessage });
  console.log("Greeting OK\n");

  const answers = ["Mehrfamilienhaus", "Marktstraße 12", "76571 Gaggenau", "250", "8", "3", "1999", "Gepflegt"];
  for (const ans of answers) {
    h.push({ role: "user", content: ans });
    const t = await runAgentTurn(ctx, m, h, ans);
    m = t.memory; ctx.startingCostCents = t.costCentsTotal;
    h.push({ role: "assistant", content: t.agentMessage });
    console.log(`"${ans}" → ${t.agentMessage?.slice(0, 80)}`);
  }

  console.log("\n=== MEMORY ===");
  console.log("type:", m.type);
  console.log("street:", m.street, "| houseNumber:", m.houseNumber);
  console.log("postcode:", m.postcode, "| city:", m.city);
  console.log("livingArea:", m.livingArea);
  console.log("rooms:", m.rooms);
  console.log("bathrooms:", m.bathrooms);
  console.log("yearBuilt:", m.yearBuilt);
  console.log("condition:", m.condition);
  console.log("isReady:", !!(m.type && m.street && m.houseNumber && m.postcode && m.city && m.livingArea && m.condition));
  console.log("Cost:", ctx.startingCostCents, "cents");

  await p.conversationTurn.deleteMany({ where: { conversationId: cid } });
  await p.agentStep.deleteMany({ where: { agentRunId: ar.id } });
  await p.agentRun.delete({ where: { id: ar.id } });
  await p.conversation.delete({ where: { id: cid } });
  await p.$disconnect();
}
main().catch((e) => console.error(e));
