/**
 * Test the Expose Agent with real voice note data (mix_8m57s.docx).
 * Simulates a multi-turn conversation where the seller provides property info.
 *
 * Usage: npx tsx scripts/test-expose-voicenote.ts
 */
require("dotenv").config({ path: ".env.local" });

const SELLER_MESSAGES = [
  "Hallo, ich möchte ein Mehrfamilienhaus verkaufen.",
  "Die Adresse ist Marktstraße 12, 76571 Gaggenau-Ottenau.",
  "Das Gebäude hat insgesamt circa 250 Quadratmeter Wohnfläche, aufgeteilt in drei Wohnungen.",
  "8 Zimmer insgesamt — die zwei großen Wohnungen haben je 2 Schlafzimmer plus Wohn-/Essbereich, die kleine hat 1 Schlafzimmer plus Wohn-/Essbereich.",
  "3 Bäder, eins pro Wohnung. Dusche, Waschbecken, WC in jedem Bad.",
  "Das Gebäude ist von 1999.",
  "Der Zustand ist gepflegt — wir haben es komplett kernsaniert. Neue Fußbodenheizung, glatt gespachtelte Wände, Holzdielenböden.",
  "Ja, es gibt einiges: Keller mit separaten Abteilen pro Wohnung, 10 Außenstellplätze, 6 Tiefgaragenstellplätze, Garten mit Wasser- und Stromanschluss, Smart Home Vorbereitung mit App-Steuerung, hohe Decken 2,70-2,80m, hohe Türen 2,10m.",
  "Ja, wir haben einen Energieausweis. Verbrauchsausweis.",
  "Energieklasse B, 70,2 kWh pro Quadratmeter und Jahr, Primärenergieträger ist Gas.",
  "Fotos haben wir schon hochgeladen, die müssten bereits im System sein.",
  "Das Grundstück hat circa 450 Quadratmeter.",
];

async function main() {
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  const { runAgentTurn, INITIAL_MEMORY, MAX_COST_CENTS } = require("../src/lib/expose-agent");

  console.log("=== EXPOSE AGENT — VOICE NOTE TEST ===\n");

  const users = await prisma.user.findMany({ take: 1 });
  const user = users[0];
  console.log("User:", user.email, "\n");

  const conversationId = "voicetest-" + Date.now();
  await prisma.conversation.create({
    data: { id: conversationId, userId: user.id, agentKind: "EXPOSE", status: "ACTIVE" },
  });
  const agentRun = await prisma.agentRun.create({
    data: { agentKind: "EXPOSE", conversationId, goal: "Voice note test", status: "RUNNING", costCents: 0 },
  });

  const ctx = { conversationId, agentRunId: agentRun.id, userId: user.id, startingCostCents: 0 };
  let memory = { ...INITIAL_MEMORY };
  let history: Array<{ role: string; content: string }> = [];

  // Greeting
  console.log("── AGENT (greeting) ──");
  const g = await runAgentTurn(ctx, memory, [], null);
  console.log(g.agentMessage?.slice(0, 200));
  console.log(`   [cost: ${g.costCentsThisTurn}¢ | total: ${g.costCentsTotal}¢]\n`);
  memory = g.memory;
  ctx.startingCostCents = g.costCentsTotal;
  history.push({ role: "assistant", content: g.agentMessage });

  // Multi-turn conversation
  for (let i = 0; i < SELLER_MESSAGES.length; i++) {
    const msg = SELLER_MESSAGES[i];
    console.log(`── SELLER (${i + 1}/${SELLER_MESSAGES.length}) ──`);
    console.log(msg);
    history.push({ role: "user", content: msg });

    const t = await runAgentTurn(ctx, memory, history, msg);
    console.log(`\n── AGENT ──`);
    console.log(t.agentMessage?.slice(0, 250));
    console.log(`   [cost: ${t.costCentsThisTurn}¢ | total: ${t.costCentsTotal}¢ | tools: ${t.toolStepsExecuted}]`);

    memory = t.memory;
    ctx.startingCostCents = t.costCentsTotal;
    history.push({ role: "assistant", content: t.agentMessage });

    // Check for abort
    if (t.abortedReason) {
      console.log(`\n⚠️ ABORTED: ${t.abortedReason}`);
      break;
    }
    console.log();
  }

  // Final memory snapshot
  console.log("\n══════════════════════════════════════");
  console.log("FINAL MEMORY STATE:");
  console.log("══════════════════════════════════════");
  console.log("type:", memory.type);
  console.log("street:", memory.street, memory.houseNumber);
  console.log("postcode:", memory.postcode, memory.city);
  console.log("livingArea:", memory.livingArea, "m²");
  console.log("plotArea:", memory.plotArea, "m²");
  console.log("rooms:", memory.rooms);
  console.log("bathrooms:", memory.bathrooms);
  console.log("yearBuilt:", memory.yearBuilt);
  console.log("floor:", memory.floor);
  console.log("condition:", memory.condition);
  console.log("attributes:", memory.attributes);
  console.log("hasEnergyCert:", memory.hasEnergyCert);
  console.log("energyCertType:", memory.energyCertType);
  console.log("energyClass:", memory.energyClass);
  console.log("energyValue:", memory.energyValue);
  console.log("energySource:", memory.energySource);
  console.log("addressValidated:", memory.addressValidated);
  console.log("phase:", memory.phase);
  console.log("assumptions:", memory.assumptions);
  console.log("uploads:", memory.uploads.length, "files");
  console.log("draft:", memory.draft ? "YES" : "NO");
  console.log("\nTotal cost:", ctx.startingCostCents, "¢ of", MAX_COST_CENTS, "¢ budget");

  // Cleanup
  await prisma.conversationTurn.deleteMany({ where: { conversationId } });
  await prisma.agentStep.deleteMany({ where: { agentRunId: agentRun.id } });
  await prisma.agentRun.delete({ where: { id: agentRun.id } });
  await prisma.conversation.delete({ where: { id: conversationId } });
  console.log("\nTest data cleaned up.");
  await prisma.$disconnect();
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
