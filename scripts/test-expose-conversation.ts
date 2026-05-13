/**
 * Full conversation test of the Expose Agent.
 * Test 1: Bulk input (seller pastes all data at once)
 * Test 2: Adaptive dialog (respond to what the agent actually asks)
 *
 * Usage: npx tsx scripts/test-expose-conversation.ts
 */
require("dotenv").config({ path: ".env.local" });

async function main() {
  const { runAgentTurn, INITIAL_MEMORY, MAX_COST_CENTS, nextQuestion, completenessScore, getMissingFields } = require("../src/lib/expose-agent");
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();

  const user = (await prisma.user.findMany({ take: 1 }))[0];
  if (!user) { console.log("No users in DB"); return; }

  function freshMemory() {
    return { ...INITIAL_MEMORY, attributes: [] as string[], uploads: [] as unknown[], assumptions: [] as string[], units: [] as unknown[], roomProgram: [] as unknown[], beliefs: {} };
  }

  async function createConversation() {
    const cid = "conv-test-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
    await prisma.conversation.create({ data: { id: cid, userId: user.id, agentKind: "EXPOSE", status: "ACTIVE" } });
    const ar = await prisma.agentRun.create({ data: { agentKind: "EXPOSE", conversationId: cid, goal: "Test", status: "RUNNING", costCents: 0 } });
    return {
      cid,
      arId: ar.id,
      ctx: { conversationId: cid, agentRunId: ar.id, userId: user.id, startingCostCents: 0 },
    };
  }

  async function cleanup(cid: string, arId: string) {
    await prisma.conversationTurn.deleteMany({ where: { conversationId: cid } });
    await prisma.agentStep.deleteMany({ where: { agentRunId: arId } });
    await prisma.agentRun.delete({ where: { id: arId } });
    await prisma.conversation.delete({ where: { id: cid } });
  }

  function printAgent(turnNum: number, agentMsg: string, t: any, memory: any) {
    console.log(`\n🤖 AGENT (turn ${turnNum}):`);
    for (const line of agentMsg.split("\n")) {
      console.log(`  ${line}`);
    }
    const score = completenessScore(memory);
    const missing = getMissingFields(memory);
    console.log(`  💰 ${t.costCentsThisTurn}¢ | total ${t.costCentsTotal}¢ | tools: ${t.toolStepsExecuted}`);
    console.log(`  📊 ${score}% complete | missing: ${missing.length > 0 ? missing.join(", ") : "none"}`);
  }

  function printMemoryDump(memory: any, totalCost: number) {
    console.log("\n┌─────────── FINAL MEMORY ───────────┐");
    console.log(`│ Type:       ${memory.type || "—"}`);
    console.log(`│ Address:    ${memory.street || "?"} ${memory.houseNumber || "?"}, ${memory.postcode || "?"} ${memory.city || "?"}`);
    console.log(`│ Validated:  ${memory.addressValidated}`);
    console.log(`│ Area:       ${memory.livingArea ?? "—"} m²`);
    console.log(`│ Plot:       ${memory.plotArea ?? "—"} m²`);
    console.log(`│ Rooms:      ${memory.rooms ?? "—"}`);
    console.log(`│ Baths:      ${memory.bathrooms ?? "—"}`);
    console.log(`│ Year:       ${memory.yearBuilt ?? "—"}`);
    console.log(`│ Condition:  ${memory.condition || "—"}`);
    console.log(`│ Attributes: ${memory.attributes?.join(", ") || "—"}`);
    console.log(`│ Energy:     ${memory.hasEnergyCert ? `${memory.energyClass}/${memory.energyValue}kWh/${memory.energySource}/until ${memory.energyValidUntil}` : memory.hasEnergyCert === false ? "no cert" : "—"}`);
    console.log(`│ Units:      ${memory.unitCount ?? "—"} (${memory.units?.length || 0} detailed)`);
    if (memory.units?.length > 0) {
      for (const u of memory.units) {
        console.log(`│   └ ${u.label}: ${u.livingArea}m², ${u.rooms}Zi, ${u.bathrooms}Bad, floor=${u.floor}`);
      }
    }
    console.log(`│ Selling:    ${memory.sellingMode || "—"}`);
    console.log(`│ Parking:    outdoor=${memory.outdoorParking ?? "—"} underground=${memory.undergroundParking ?? "—"}`);
    console.log(`│ Photos:     ${memory.uploads?.filter((u: any) => u.kind === "PHOTO").length}`);
    console.log(`│ Price band: ${memory.priceBand ? `${memory.priceBand.low}–${memory.priceBand.high}€ (${memory.priceBand.confidence})` : "—"}`);
    console.log(`│ Ask price:  ${memory.askingPrice ? `${memory.askingPrice}€` : "—"}`);
    console.log(`│ Draft:      ${memory.draft ? `"${memory.draft.titleShort}"` : "—"}`);
    console.log(`│ Rubric:     ${memory.lastRubric ? (memory.lastRubric.passed ? "PASSED ✓" : `FAILED ✗`) : "—"}`);
    if (memory.lastRubric && !memory.lastRubric.passed) {
      for (const f of memory.lastRubric.failures) console.log(`│   ✗ ${f.slice(0, 70)}`);
    }
    console.log(`│ Handoff:    ${memory.handoffReady}`);
    console.log(`│ Score:      ${completenessScore(memory)}%`);
    console.log(`│ Cost:       ${totalCost}¢ / ${MAX_COST_CENTS}¢`);
    console.log("└────────────────────────────────────┘");
  }

  // ═══════════════════════════════════════════════════════════════
  // TEST 1: BULK INPUT
  // ═══════════════════════════════════════════════════════════════
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║   TEST 1: BULK INPUT — seller pastes everything at once    ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  {
    const { cid, arId, ctx } = await createConversation();
    let memory = freshMemory();
    let history: Array<{ role: string; content: string }> = [];
    let turnNum = 0;

    async function turn(msg: string | null) {
      turnNum++;
      if (msg) {
        console.log(`\n👤 USER (turn ${turnNum}): "${msg.slice(0, 120)}${msg.length > 120 ? "..." : ""}"`);
        history.push({ role: "user", content: msg });
      }
      const t = await runAgentTurn(ctx, memory, history, msg);
      memory = t.memory;
      ctx.startingCostCents = t.costCentsTotal;
      history.push({ role: "assistant", content: t.agentMessage });
      printAgent(turnNum, t.agentMessage, t, memory);
      console.log("─".repeat(64));
      return t;
    }

    try {
      // Greeting
      await turn(null);

      // Bulk paste — everything at once
      const bulkMsg = `MFH, Marktstraße 12, 76571 Gaggenau. 250 m² Wohnfläche, 450 m² Grundstück, 8 Zimmer, 3 Bäder, Baujahr 1999, gepflegt. Ausstattung: Keller, Stellplatz, Garten, Fußbodenheizung, Smart Home. 10 Außenstellplätze, 6 Tiefgaragenstellplätze.
3 Wohneinheiten:
- WE1: 95m², 3 Zimmer, 1 Bad, 1. OG
- WE2: 95m², 3 Zimmer, 1 Bad, EG
- WE3: 55m², 2 Zimmer, 1 Bad, EG
Verkauf: beides (Paket + Einzeln).
Energieausweis: Verbrauch, Klasse B, 70,2 kWh, Gas, gültig bis 2034-03-15.
Wunschpreis: 525.000 €`;

      await turn(bulkMsg);

      // Inject photos
      console.log("\n📷 Injecting 3 photos into memory...");
      const existingPhotos = await prisma.mediaAsset.findMany({
        where: { propertyId: { not: null }, kind: "PHOTO" },
        select: { storageKey: true, fileName: true, mimeType: true, sizeBytes: true, width: true, height: true },
        take: 3, orderBy: { ordering: "asc" },
      });
      for (const photo of existingPhotos.length > 0 ? existingPhotos : [{ storageKey: "/uploads/test/p1.jpg", fileName: "p1.jpg", mimeType: "image/jpeg", sizeBytes: 500000, width: 1920, height: 1080 }]) {
        const upload = { storageKey: photo.storageKey, fileName: photo.fileName || "photo.jpg", mimeType: photo.mimeType || "image/jpeg", sizeBytes: photo.sizeBytes || 500000, width: photo.width, height: photo.height, kind: "PHOTO" as const };
        memory.uploads.push(upload);
        await prisma.conversationTurn.create({ data: { conversationId: cid, role: "SYSTEM", content: `[Upload] ${photo.fileName}`, toolName: "upload", toolOutput: { memoryPatch: { uploads: [upload] } } } });
      }
      console.log(`  ✓ ${memory.uploads.filter((u: any) => u.kind === "PHOTO").length} photos in memory`);

      // Trigger pipeline
      const pipeline = await turn("3 Fotos hochgeladen. Bitte Preis berechnen und Entwurf erstellen.");

      // Confirm if ready
      if (memory.lastRubric?.passed && memory.draft) {
        await turn("Ja, bitte erstellen.");
      }

      printMemoryDump(memory, ctx.startingCostCents);

    } catch (e: any) {
      console.error("\n❌ ERROR:", e.message);
      console.error(e.stack?.split("\n").slice(0, 5).join("\n"));
    }

    await cleanup(cid, arId);
  }

  // ═══════════════════════════════════════════════════════════════
  // TEST 2: ADAPTIVE DIALOG — respond to agent's actual questions
  // ═══════════════════════════════════════════════════════════════
  console.log("\n\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║   TEST 2: ADAPTIVE DIALOG — answer what the agent asks     ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  {
    const { cid, arId, ctx } = await createConversation();
    let memory = freshMemory();
    let history: Array<{ role: string; content: string }> = [];
    let turnNum = 0;

    // Answer bank: maps fields/keywords to answers
    const answers: Record<string, string> = {
      // Type
      "immobilie": "Mehrfamilienhaus",
      "typ": "Mehrfamilienhaus",
      "verkaufen": "Mehrfamilienhaus",
      // Address
      "straße": "Marktstraße 12",
      "adresse": "Marktstraße 12, 76571 Gaggenau",
      // PLZ
      "postleitzahl": "76571 Gaggenau",
      "plz": "76571 Gaggenau",
      // Area
      "wohnfläche": "250 m²",
      "fläche": "250 m²",
      "groß": "250 m² Wohnfläche, 450 m² Grundstück",
      // Rooms
      "zimmer": "8 Zimmer",
      // Baths
      "badezimmer": "3",
      "bäder": "3",
      "bad": "3",
      // Year
      "baujahr": "1999",
      "gebaut": "1999",
      // Condition
      "zustand": "Gepflegt",
      // Features
      "ausstattung": "Keller, Stellplatz, Garten, Fußbodenheizung, Smart Home",
      // Units
      "wohneinheiten": "3",
      "einheiten": "3",
      "wohnungen": "WE1: 95m², 3Zi, 1Bad, 1.OG. WE2: 95m², 3Zi, 1Bad, EG. WE3: 55m², 2Zi, 1Bad, EG.",
      "beschreiben": "WE1: 95m², 3Zi, 1Bad, 1.OG. WE2: 95m², 3Zi, 1Bad, EG. WE3: 55m², 2Zi, 1Bad, EG.",
      "einzeln": "WE1: 95m², 3Zi, 1Bad, 1.OG. WE2: 95m², 3Zi, 1Bad, EG. WE3: 55m², 2Zi, 1Bad, EG.",
      // Selling
      "verkauf": "Beides",
      "paket": "Beides",
      // Energy
      "energieausweis": "Ja, Verbrauch, B, 70,2 kWh, Gas, gültig bis 2034-03-15",
      "energie": "Ja, Verbrauch, B, 70,2 kWh, Gas, gültig bis 2034-03-15",
      // Photos
      "foto": "Ich lade gleich Fotos hoch.",
      "photo": "Ich lade gleich Fotos hoch.",
      "bild": "Ich lade gleich Fotos hoch.",
      // Floor plan
      "grundriss": "Nein, kein Grundriss vorhanden.",
      // Stockwerk
      "stockwerk": "Ja, alle an derselben Adresse.",
      // Same address
      "adresse": "Ja",
      "derselben": "Ja",
      // Room program
      "räume": "Nein danke, überspringen.",
      "raumprogramm": "Nein",
      // Confirm
      "bestätig": "Ja",
      "erstellen": "Ja, bitte erstellen.",
      // Contact
      "kontaktdaten": "Nein danke",
      // Price
      "preis": "525.000 €",
      // Valid until
      "gültig": "2034-03-15",
      // Default
      "default": "Ja",
    };

    function pickAnswer(agentMsg: string): string {
      const lower = agentMsg.toLowerCase();
      // Priority matching — check specific keywords first
      const priorities = [
        "immobilie", "typ", "verkaufen",
        "postleitzahl", "plz",
        "straße", "adresse",
        "wohnfläche", "fläche", "groß",
        "zimmer", "badezimmer", "bäder",
        "baujahr", "gebaut",
        "zustand",
        "ausstattung",
        "wohneinheiten", "einheiten",
        "beschreiben", "einzeln",
        "verkauf", "paket",
        "energieausweis", "energie",
        "gültig",
        "foto", "photo", "bild",
        "grundriss",
        "stockwerk", "derselben",
        "räume", "raumprogramm",
        "kontaktdaten",
        "preis",
        "bestätig", "erstellen",
      ];
      for (const key of priorities) {
        if (lower.includes(key) && answers[key]) {
          return answers[key];
        }
      }
      return answers["default"];
    }

    async function turn(msg: string | null, label?: string): Promise<any> {
      turnNum++;
      if (msg) {
        console.log(`\n👤 USER (turn ${turnNum}): "${msg}"`);
        history.push({ role: "user", content: msg });
      }
      const t = await runAgentTurn(ctx, memory, history, msg);
      memory = t.memory;
      ctx.startingCostCents = t.costCentsTotal;
      history.push({ role: "assistant", content: t.agentMessage });
      printAgent(turnNum, t.agentMessage, t, memory);
      console.log("─".repeat(64));
      return t;
    }

    try {
      // Greeting
      let result = await turn(null);
      let maxTurns = 25;

      while (maxTurns-- > 0) {
        const score = completenessScore(memory);
        const nq = nextQuestion(memory);

        // If pipeline is done and confirmed
        if (result.finished) {
          console.log("\n🏁 HANDOFF TRIGGERED!");
          break;
        }

        // If photos needed — inject them
        if (nq.action === "upload_photos" || (nq.action === "ask" && nq.field === "photos")) {
          console.log("\n📷 Injecting photos...");
          const existingPhotos = await prisma.mediaAsset.findMany({
            where: { propertyId: { not: null }, kind: "PHOTO" },
            select: { storageKey: true, fileName: true, mimeType: true, sizeBytes: true, width: true, height: true },
            take: 3, orderBy: { ordering: "asc" },
          });
          for (const photo of existingPhotos.length > 0 ? existingPhotos : [{ storageKey: "/uploads/test/p1.jpg", fileName: "p1.jpg", mimeType: "image/jpeg", sizeBytes: 500000, width: 1920, height: 1080 }]) {
            const upload = { storageKey: photo.storageKey, fileName: photo.fileName || "photo.jpg", mimeType: photo.mimeType || "image/jpeg", sizeBytes: photo.sizeBytes || 500000, width: photo.width, height: photo.height, kind: "PHOTO" as const };
            memory.uploads.push(upload);
            await prisma.conversationTurn.create({ data: { conversationId: cid, role: "SYSTEM", content: `[Upload] ${photo.fileName}`, toolName: "upload", toolOutput: { memoryPatch: { uploads: [upload] } } } });
          }
          result = await turn("3 Fotos hochgeladen.");
          continue;
        }

        // If pricing/draft/review needed — just send a nudge
        if (nq.action === "trigger_pricing" || nq.action === "trigger_draft") {
          result = await turn("Bitte weiter.");
          continue;
        }

        // If waiting for confirm
        if (nq.action === "wait_confirm") {
          result = await turn("Ja, bitte erstellen.");
          continue;
        }

        // Pick an adaptive answer based on the agent's last message
        const answer = pickAnswer(result.agentMessage);
        result = await turn(answer);
      }

      printMemoryDump(memory, ctx.startingCostCents);

    } catch (e: any) {
      console.error("\n❌ ERROR:", e.message);
      console.error(e.stack?.split("\n").slice(0, 5).join("\n"));
    }

    await cleanup(cid, arId);
  }

  console.log("\n✅ ALL TESTS COMPLETE");
  await prisma.$disconnect();
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
