/**
 * Quick bulk-input test of the Expose Agent pipeline.
 * Usage: npx tsx scripts/test-expose-quick.ts
 */
require("dotenv").config({ path: ".env.local" });

async function main() {
  const { runAgentTurn, INITIAL_MEMORY, MAX_COST_CENTS, completenessScore, getMissingFields } = require("../src/lib/expose-agent");
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();

  const user = (await prisma.user.findMany({ take: 1 }))[0];
  if (!user) { console.log("No users in DB"); return; }

  const cid = "quick-" + Date.now();
  await prisma.conversation.create({ data: { id: cid, userId: user.id, agentKind: "EXPOSE", status: "ACTIVE" } });
  const ar = await prisma.agentRun.create({ data: { agentKind: "EXPOSE", conversationId: cid, goal: "Quick test", status: "RUNNING", costCents: 0 } });
  const ctx = { conversationId: cid, agentRunId: ar.id, userId: user.id, startingCostCents: 0 };
  let m = { ...INITIAL_MEMORY, attributes: [] as string[], uploads: [] as unknown[], assumptions: [] as string[], units: [] as unknown[], roomProgram: [] as unknown[], beliefs: {} };
  let h: Array<{ role: string; content: string }> = [];

  async function turn(msg: string | null) {
    if (msg) h.push({ role: "user", content: msg });
    const t = await runAgentTurn(ctx, m, h, msg);
    m = t.memory; ctx.startingCostCents = t.costCentsTotal;
    h.push({ role: "assistant", content: t.agentMessage });
    const label = msg ? `"${msg.slice(0, 80)}"` : "(greeting)";
    console.log(`\n${label}`);
    console.log(`→ ${t.agentMessage.slice(0, 150)}${t.agentMessage.length > 150 ? "..." : ""}`);
    console.log(`  [${t.costCentsThisTurn}¢ | total ${t.costCentsTotal}¢ | tools: ${t.toolStepsExecuted} | score: ${completenessScore(m)}%]`);
    return t;
  }

  try {
    console.log("=== BULK INPUT → PIPELINE TEST ===\n");

    // Greeting
    await turn(null);

    // Bulk paste
    await turn(`MFH, Marktstraße 12, 76571 Gaggenau. 250 m² Wohnfläche, 450 m² Grundstück, 8 Zimmer, 3 Bäder, Baujahr 1999, gepflegt. Ausstattung: Keller, Stellplatz, Garten, Fußbodenheizung, Smart Home. 10 Außenstellplätze, 6 Tiefgaragenstellplätze.
3 Wohneinheiten: WE1: 95m², 3Zi, 1Bad, 1.OG. WE2: 95m², 3Zi, 1Bad, EG. WE3: 55m², 2Zi, 1Bad, EG.
Verkauf: beides. Energie: Verbrauch, B, 70,2 kWh, Gas, gültig bis 2034-03-15. Preis: 525000`);

    // Inject photos
    console.log("\n--- Injecting 3 photos ---");
    const photos = await prisma.mediaAsset.findMany({
      where: { propertyId: { not: null }, kind: "PHOTO" },
      select: { storageKey: true, fileName: true, mimeType: true, sizeBytes: true, width: true, height: true },
      take: 3, orderBy: { ordering: "asc" },
    });
    for (const p of photos.length > 0 ? photos : [{ storageKey: "/uploads/test/p.jpg", fileName: "p.jpg", mimeType: "image/jpeg", sizeBytes: 500000, width: 1920, height: 1080 }]) {
      const u = { storageKey: p.storageKey, fileName: p.fileName || "p.jpg", mimeType: p.mimeType || "image/jpeg", sizeBytes: p.sizeBytes || 500000, width: p.width, height: p.height, kind: "PHOTO" as const };
      m.uploads.push(u);
      await prisma.conversationTurn.create({ data: { conversationId: cid, role: "SYSTEM", content: `[Upload] ${p.fileName}`, toolName: "upload", toolOutput: { memoryPatch: { uploads: [u] } } } });
    }

    // Trigger pipeline
    const pipeline = await turn("3 Fotos hochgeladen.");

    // If rubric passed, confirm
    if (m.lastRubric?.passed && m.draft) {
      console.log("\n--- Rubric PASSED → confirming ---");
      await turn("Ja, bitte erstellen.");
    } else if (m.lastRubric && !m.lastRubric.passed) {
      console.log("\n--- Rubric FAILED ---");
      for (const f of m.lastRubric.failures) console.log(`  ✗ ${f.slice(0, 100)}`);

      // If only hallucination/price issues, try re-draft
      if (m.draft) {
        console.log("\n--- Retrying: asking to remove hallucinations ---");
        await turn("Ja, bitte entfernen Sie alle unbelegten Behauptungen und erstellen Sie den Text neu.");
      }
    }

    // Final state
    console.log("\n\n=== FINAL STATE ===");
    console.log(`Type: ${m.type} | ${m.street} ${m.houseNumber}, ${m.postcode} ${m.city}`);
    console.log(`Area: ${m.livingArea}m² | Plot: ${m.plotArea}m² | Rooms: ${m.rooms} | Baths: ${m.bathrooms}`);
    console.log(`Year: ${m.yearBuilt} | Condition: ${m.condition}`);
    console.log(`Attributes: ${m.attributes?.join(", ") || "none"}`);
    console.log(`Energy: ${m.energyClass}/${m.energyValue}kWh/${m.energySource} until ${m.energyValidUntil}`);
    console.log(`Units: ${m.units?.length} | Selling: ${m.sellingMode} | Parking: ${m.outdoorParking}/${m.undergroundParking}`);
    console.log(`Photos: ${m.uploads?.filter((u: any) => u.kind === "PHOTO").length}`);
    console.log(`Price: ${m.priceBand ? `${m.priceBand.low}-${m.priceBand.high}€` : "none"} | Ask: ${m.askingPrice}€`);
    console.log(`Draft: ${m.draft ? `"${m.draft.titleShort}"` : "none"}`);
    if (m.draft) console.log(`Desc (first 300): ${m.draft.descriptionLong?.slice(0, 300)}...`);
    console.log(`Rubric: ${m.lastRubric ? (m.lastRubric.passed ? "PASSED ✓" : `FAILED: ${m.lastRubric.failures?.join(" | ")}`) : "none"}`);
    console.log(`Handoff: ${m.handoffReady} | Cost: ${ctx.startingCostCents}¢/${MAX_COST_CENTS}¢`);

  } catch (e: any) {
    console.error("\nERROR:", e.message);
    console.error(e.stack?.split("\n").slice(0, 5).join("\n"));
  }

  await prisma.conversationTurn.deleteMany({ where: { conversationId: cid } });
  await prisma.agentStep.deleteMany({ where: { agentRunId: ar.id } });
  await prisma.agentRun.delete({ where: { id: ar.id } });
  await prisma.conversation.delete({ where: { id: cid } });
  await prisma.$disconnect();
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
