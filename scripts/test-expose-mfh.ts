/**
 * Test Expose Agent with MFH multi-unit flow.
 * Usage: npx tsx scripts/test-expose-mfh.ts
 */
require("dotenv").config({ path: ".env.local" });

async function main() {
  const { runAgentTurn, INITIAL_MEMORY, MAX_COST_CENTS } = require("../src/lib/expose-agent");
  const { PrismaClient } = require("@prisma/client");
  const p = new PrismaClient();
  const user = (await p.user.findMany({ take: 1 }))[0];

  const cid = "mfhtest-" + Date.now();
  await p.conversation.create({ data: { id: cid, userId: user.id, agentKind: "EXPOSE", status: "ACTIVE" } });
  const ar = await p.agentRun.create({ data: { agentKind: "EXPOSE", conversationId: cid, goal: "MFH test", status: "RUNNING", costCents: 0 } });
  const ctx = { conversationId: cid, agentRunId: ar.id, userId: user.id, startingCostCents: 0 };
  let m = { ...INITIAL_MEMORY, attributes: [] as string[], uploads: [] as unknown[], assumptions: [] as string[], units: [] as unknown[] };
  let h: Array<{ role: string; content: string }> = [];

  const g = await runAgentTurn(ctx, m, [], null);
  m = g.memory; ctx.startingCostCents = g.costCentsTotal;
  h.push({ role: "assistant", content: g.agentMessage });
  console.log("Greeting OK\n");

  const answers = [
    "Mehrfamilienhaus",
    "Marktstraße 12",
    "76571 Gaggenau",
    "250",
    "450",
    "8",
    "3",
    "1999",
    "Gepflegt",
    "Keller, Stellplatz, Garten, Fußbodenheizung, Smart Home",
    "3",
    "Wohnung 1: 95 m², 3 Zimmer, 1 Bad, 1. OG. Wohnung 2: 95 m², 3 Zimmer, 1 Bad, EG. Wohnung 3: 55 m², 2 Zimmer, 1 Bad, EG.",
    "Beides",
  ];

  for (const ans of answers) {
    h.push({ role: "user", content: ans });
    const t = await runAgentTurn(ctx, m, h, ans);
    m = t.memory; ctx.startingCostCents = t.costCentsTotal;
    h.push({ role: "assistant", content: t.agentMessage });
    console.log(`"${ans.slice(0, 50)}" → ${t.agentMessage?.slice(0, 80)}`);
  }

  console.log("\n=== MEMORY ===");
  console.log("type:", m.type);
  console.log("street:", m.street, "| houseNumber:", m.houseNumber);
  console.log("postcode:", m.postcode, "| city:", m.city);
  console.log("livingArea:", m.livingArea, "| plotArea:", m.plotArea);
  console.log("rooms:", m.rooms, "| bathrooms:", m.bathrooms);
  console.log("yearBuilt:", m.yearBuilt);
  console.log("condition:", m.condition);
  console.log("attributes:", m.attributes);
  console.log("unitCount:", m.unitCount);
  console.log("units:", JSON.stringify(m.units, null, 2));
  console.log("sellingMode:", m.sellingMode);
  console.log("isReady:", !!(m.type && m.street && m.houseNumber && m.postcode && m.city && m.livingArea && m.condition));
  console.log("Cost:", ctx.startingCostCents, "cents");

  // Cleanup
  await p.conversationTurn.deleteMany({ where: { conversationId: cid } });
  await p.agentStep.deleteMany({ where: { agentRunId: ar.id } });
  await p.agentRun.delete({ where: { id: ar.id } });
  await p.conversation.delete({ where: { id: cid } });
  await p.$disconnect();
}

main().catch((e) => console.error(e));
