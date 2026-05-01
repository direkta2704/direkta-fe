require("dotenv").config({ path: ".env.local" });

async function main() {
  const { runAgentTurn, INITIAL_MEMORY, MAX_COST_CENTS } = require("../src/lib/expose-agent");
  const { PrismaClient } = require("@prisma/client");
  const p = new PrismaClient();
  const user = (await p.user.findMany({ take: 1 }))[0];

  const cid = "bulktest-" + Date.now();
  await p.conversation.create({ data: { id: cid, userId: user.id, agentKind: "EXPOSE", status: "ACTIVE" } });
  const ar = await p.agentRun.create({ data: { agentKind: "EXPOSE", conversationId: cid, goal: "Bulk test", status: "RUNNING", costCents: 0 } });
  const ctx = { conversationId: cid, agentRunId: ar.id, userId: user.id, startingCostCents: 0 };
  let m = { ...INITIAL_MEMORY, attributes: [] as string[], uploads: [] as any[], assumptions: [] as string[], units: [] as any[] };
  let h: Array<{ role: string; content: string }> = [];

  // Greeting
  const g = await runAgentTurn(ctx, m, [], null);
  m = g.memory; ctx.startingCostCents = g.costCentsTotal;
  h.push({ role: "assistant", content: g.agentMessage });
  console.log("AGENT:", g.agentMessage?.slice(0, 100));

  // Bulk message — all data at once
  const bulk = `Mehrfamilienhaus, Marktstraße 12, 76571 Gaggenau. 250 m² Wohnfläche, 450 m² Grundstück, 8 Zimmer, 3 Bäder, Baujahr 1999, gepflegt. Ausstattung: Keller, Stellplatz, Garten, Fußbodenheizung, Smart Home. 3 Wohneinheiten: Wohnung 1 hat 95 m², 3 Zimmer, 1 Bad, Obergeschoss. Wohnung 2 hat 95 m², 3 Zimmer, 1 Bad, Erdgeschoss. Wohnung 3 hat 55 m², 2 Zimmer, 1 Bad, Erdgeschoss. Verkauf als Paket und einzeln. Verbrauchsausweis, Klasse B, 70,2 kWh, Gas. Preis 525000 Euro.`;

  console.log("\nUSER:", bulk.slice(0, 80) + "...\n");
  h.push({ role: "user", content: bulk });
  const t = await runAgentTurn(ctx, m, h, bulk);
  m = t.memory; ctx.startingCostCents = t.costCentsTotal;
  h.push({ role: "assistant", content: t.agentMessage });

  console.log("AGENT:", t.agentMessage);
  console.log("\n=== EXTRACTED ===");
  console.log("type:", m.type);
  console.log("address:", m.street, m.houseNumber + ",", m.postcode, m.city);
  console.log("living:", m.livingArea, "| plot:", m.plotArea);
  console.log("rooms:", m.rooms, "| baths:", m.bathrooms, "| year:", m.yearBuilt);
  console.log("condition:", m.condition);
  console.log("attributes:", m.attributes);
  console.log("units:", m.units.length, m.units.map((u: any) => `${u.label}:${u.livingArea}m²`).join(", "));
  console.log("sellingMode:", m.sellingMode);
  console.log("energy:", m.energyCertType, m.energyClass, m.energyValue, m.energySource);
  console.log("price:", m.askingPrice);
  console.log("isReady:", !!(m.type && m.street && m.houseNumber && m.postcode && m.city && m.livingArea && m.condition));
  console.log("Cost:", ctx.startingCostCents, "¢");

  // Cleanup
  await p.conversationTurn.deleteMany({ where: { conversationId: cid } });
  await p.agentStep.deleteMany({ where: { agentRunId: ar.id } });
  await p.agentRun.delete({ where: { id: ar.id } });
  await p.conversation.delete({ where: { id: cid } });
  await p.$disconnect();
}
main().catch((e) => console.error(e));
