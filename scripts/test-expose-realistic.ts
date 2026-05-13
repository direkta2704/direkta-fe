/**
 * Realistic seller conversation tests.
 * Tests how the agent handles REAL human input patterns.
 * Usage: npx tsx scripts/test-expose-realistic.ts
 */
require("dotenv").config({ path: ".env.local" });

async function main() {
  const { runAgentTurn, INITIAL_MEMORY, MAX_COST_CENTS, completenessScore, getMissingFields } = require("../src/lib/expose-agent");
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();

  const user = (await prisma.user.findMany({ take: 1 }))[0];
  if (!user) { console.log("No users in DB"); return; }

  async function runScenario(name: string, messages: string[]) {
    console.log(`\n${"═".repeat(64)}`);
    console.log(`  ${name}`);
    console.log(`${"═".repeat(64)}`);

    const cid = "real-" + Date.now() + "-" + Math.random().toString(36).slice(2, 5);
    await prisma.conversation.create({ data: { id: cid, userId: user.id, agentKind: "EXPOSE", status: "ACTIVE" } });
    const ar = await prisma.agentRun.create({ data: { agentKind: "EXPOSE", conversationId: cid, goal: name, status: "RUNNING", costCents: 0 } });
    const ctx = { conversationId: cid, agentRunId: ar.id, userId: user.id, startingCostCents: 0 };
    let m = { ...INITIAL_MEMORY, attributes: [] as string[], uploads: [] as unknown[], assumptions: [] as string[], units: [] as unknown[], roomProgram: [] as unknown[], beliefs: {} };
    let h: Array<{ role: string; content: string }> = [];

    async function turn(msg: string | null) {
      if (msg) h.push({ role: "user", content: msg });
      const t = await runAgentTurn(ctx, m, h, msg);
      m = t.memory; ctx.startingCostCents = t.costCentsTotal;
      h.push({ role: "assistant", content: t.agentMessage });
      if (msg) {
        console.log(`\n  👤 "${msg}"`);
      }
      console.log(`  🤖 ${t.agentMessage.split("\n").map((l: string) => l.trim()).filter(Boolean).join(" ").slice(0, 200)}`);
      console.log(`     [${t.costCentsTotal}¢ | ${completenessScore(m)}% | tools:${t.toolStepsExecuted}]`);
      return t;
    }

    try {
      await turn(null); // greeting

      for (const msg of messages) {
        await turn(msg);
      }

      // Inject photos if needed
      if (m.uploads.filter((u: any) => u.kind === "PHOTO").length === 0) {
        const photos = await prisma.mediaAsset.findMany({
          where: { propertyId: { not: null }, kind: "PHOTO" },
          select: { storageKey: true, fileName: true, mimeType: true, sizeBytes: true, width: true, height: true },
          take: 3, orderBy: { ordering: "asc" },
        });
        if (photos.length > 0) {
          for (const p of photos) {
            const u = { storageKey: p.storageKey, fileName: p.fileName || "p.jpg", mimeType: p.mimeType || "image/jpeg", sizeBytes: p.sizeBytes || 500000, width: p.width, height: p.height, kind: "PHOTO" as const };
            m.uploads.push(u);
            await prisma.conversationTurn.create({ data: { conversationId: cid, role: "SYSTEM", content: `[Upload] ${p.fileName}`, toolName: "upload", toolOutput: { memoryPatch: { uploads: [u] } } } });
          }
          console.log(`\n  📷 [${photos.length} photos injected]`);
          await turn("Fotos hochgeladen.");
        }
      }

      // Confirm if ready
      if (m.lastRubric?.passed && m.draft) {
        await turn("Ja, erstellen.");
      }

      // Summary
      const missing = getMissingFields(m);
      console.log(`\n  ┌── RESULT ──┐`);
      console.log(`  │ Score:  ${completenessScore(m)}%`);
      console.log(`  │ Cost:   ${ctx.startingCostCents}¢`);
      console.log(`  │ Fields: type=${m.type || "?"} area=${m.livingArea || "?"} condition=${m.condition || "?"}`);
      console.log(`  │ Energy: ${m.hasEnergyCert === true ? `${m.energyClass}/${m.energyValue}kWh valid=${m.energyValidUntil}` : m.hasEnergyCert === false ? "none" : "unknown"}`);
      console.log(`  │ Units:  ${m.units?.length || 0} detailed | selling=${m.sellingMode || "?"}`);
      console.log(`  │ Draft:  ${m.draft ? "yes" : "no"} | Rubric: ${m.lastRubric ? (m.lastRubric.passed ? "PASS" : "FAIL") : "—"}`);
      console.log(`  │ Missing: ${missing.length > 0 ? missing.join(", ") : "none"}`);
      console.log(`  └────────────┘`);

    } catch (e: any) {
      console.error(`  ❌ ${e.message}`);
    }

    await prisma.conversationTurn.deleteMany({ where: { conversationId: cid } });
    await prisma.agentStep.deleteMany({ where: { agentRunId: ar.id } });
    await prisma.agentRun.delete({ where: { id: ar.id } });
    await prisma.conversation.delete({ where: { id: cid } });
  }

  // ═══════════════════════════════════════════════════════════════════
  // SCENARIO 1: Natural brain dump — experienced seller, MFH
  // ═══════════════════════════════════════════════════════════════════
  await runScenario("SCENARIO 1: Brain dump — MFH seller knows their stuff", [
    `Hallo, ich will mein Mehrfamilienhaus verkaufen. Marktstraße 12 in Gaggenau, PLZ 76571. 3 Wohnungen, insgesamt ca. 250qm Wohnfläche, Grundstück 450qm. Baujahr 99, guter Zustand, Keller und Garten dabei, FBH in allen Wohnungen plus Smart Home. WE1 ist 95qm mit 3 Zimmern im OG, WE2 auch 95qm 3Zi im EG, WE3 ist kleiner mit 55qm 2Zi auch EG. Energieausweis Verbrauch, Klasse B, ca 70 kWh, Gas, gültig bis März 2034. Will beides machen, Einzelverkauf und Paket. Preislich so 525.000.`,
  ]);

  // ═══════════════════════════════════════════════════════════════════
  // SCENARIO 2: Minimal answers — impatient seller, ETW
  // ═══════════════════════════════════════════════════════════════════
  await runScenario("SCENARIO 2: Minimal answers — impatient ETW seller", [
    "Wohnung",
    "Hauptstraße 15, 80331 München",
    "85qm, 3ZKB, 2. OG, BJ 2005",
    "gut, Parkett, Balkon, EBK, Aufzug",
    "Ja Verbrauch A 45kWh Fernwärme gültig 2032-11-01",
    "350000",
  ]);

  // ═══════════════════════════════════════════════════════════════════
  // SCENARIO 3: "I inherited this" — confused seller, EFH
  // ═══════════════════════════════════════════════════════════════════
  await runScenario("SCENARIO 3: Inherited property — knows very little", [
    "Meine Mutter ist gestorben und ich habe das Haus geerbt. Es ist in Gaggenau, Marktstraße 12. Ich weiß ehrlich gesagt nicht viel darüber.",
    "Ein Einfamilienhaus glaube ich. Ziemlich groß, vielleicht 120 oder 130 qm?",
    "4 oder 5 Zimmer, bin mir nicht sicher. 2 Bäder auf jeden Fall.",
    "Weiß ich nicht genau, vielleicht 70er Jahre? Muss renoviert werden auf jeden Fall.",
    "Energieausweis habe ich keinen, muss ich den besorgen?",
    "OK dann sage ich erstmal nein. Preis weiß ich auch nicht, was empfehlen Sie?",
  ]);

  // ═══════════════════════════════════════════════════════════════════
  // SCENARIO 4: Copy-paste from old listing
  // ═══════════════════════════════════════════════════════════════════
  await runScenario("SCENARIO 4: Copy-paste from existing listing", [
    `Hier ist mein altes Inserat:

Gepflegtes Einfamilienhaus in ruhiger Lage

Zum Verkauf steht ein gepflegtes Einfamilienhaus in Gaggenau. Das 1985 erbaute Haus verfügt über ca. 145 m² Wohnfläche auf einem 520 m² großen Grundstück. Es bietet 6 Zimmer, 2 Bäder, einen Keller und eine Garage. Die Gasheizung wurde 2018 erneuert. Energieausweis: Verbrauchsausweis, Klasse D, 142 kWh/(m²·a), gültig bis 2028-09-30.

Adresse: Waldstraße 8, 76571 Gaggenau
Preis: 385.000 EUR VB`,
  ]);

  console.log("\n\n✅ ALL SCENARIOS COMPLETE");
  await prisma.$disconnect();
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
