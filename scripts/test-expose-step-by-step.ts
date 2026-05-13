/**
 * Step-by-step conversation test — answers one question at a time.
 * Logs every turn clearly. Tests full pipeline to advertisement creation.
 * Usage: npx tsx scripts/test-expose-step-by-step.ts
 */
require("dotenv").config({ path: ".env.local" });

async function main() {
  const { runAgentTurn, INITIAL_MEMORY, MAX_COST_CENTS, completenessScore, getMissingFields, nextQuestion } = require("../src/lib/expose-agent");
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();

  const user = (await prisma.user.findMany({ take: 1 }))[0];
  if (!user) { console.log("No users in DB"); return; }

  const cid = "step-" + Date.now();
  await prisma.conversation.create({ data: { id: cid, userId: user.id, agentKind: "EXPOSE", status: "ACTIVE" } });
  const ar = await prisma.agentRun.create({ data: { agentKind: "EXPOSE", conversationId: cid, goal: "Step test", status: "RUNNING", costCents: 0 } });
  const ctx = { conversationId: cid, agentRunId: ar.id, userId: user.id, startingCostCents: 0 };
  let m = { ...INITIAL_MEMORY, attributes: [] as string[], uploads: [] as unknown[], assumptions: [] as string[], units: [] as unknown[], roomProgram: [] as unknown[], beliefs: {}, extras: [] as unknown[], specifications: {} };
  let h: Array<{ role: string; content: string }> = [];
  let turnNum = 0;

  async function turn(msg: string | null): Promise<any> {
    turnNum++;
    const nqBefore = nextQuestion(m);

    if (msg) h.push({ role: "user", content: msg });
    const t = await runAgentTurn(ctx, m, h, msg);
    m = t.memory; ctx.startingCostCents = t.costCentsTotal;
    h.push({ role: "assistant", content: t.agentMessage });

    // Log
    console.log(`\n${"─".repeat(60)}`);
    console.log(`TURN ${turnNum}`);
    if (msg) console.log(`  👤 SELLER: "${msg}"`);
    else console.log(`  (greeting)`);
    console.log(`  🤖 AGENT:  ${t.agentMessage.split("\n").filter(Boolean).join("\n           ")}`);

    const nqAfter = nextQuestion(m);
    const score = completenessScore(m);
    const missing = getMissingFields(m);
    console.log(`  📊 ${score}% | ${t.costCentsTotal}¢ | tools:${t.toolStepsExecuted} | next:${nqAfter.action}${nqAfter.field ? `[${nqAfter.field}]` : ""}`);
    if (missing.length > 0) console.log(`  ❌ Missing: ${missing.join(", ")}`);
    if (t.finished) console.log(`  🏁 FINISHED — advertisements created!`);
    return t;
  }

  // Answers matching Scenario A from test-answers.txt
  // These will be sent one at a time in response to what the agent asks
  const answerBank: Array<{ keywords: string[]; answer: string; used: boolean }> = [
    { keywords: ["immobilie", "typ", "verkaufen", "was für"], answer: "Mehrfamilienhaus", used: false },
    { keywords: ["straße", "adresse"], answer: "Marktstraße 12", used: false },
    { keywords: ["postleitzahl", "plz", "stadt"], answer: "76571 Gaggenau", used: false },
    { keywords: ["wohnfläche", "fläche", "groß", "quadratmeter", "m²"], answer: "250 m²", used: false },
    { keywords: ["grundstück"], answer: "450 m²", used: false },
    { keywords: ["zimmer"], answer: "8", used: false },
    { keywords: ["bad", "bäder", "badezimmer"], answer: "3", used: false },
    { keywords: ["baujahr", "gebaut", "erbaut"], answer: "1999", used: false },
    { keywords: ["zustand", "beschreiben"], answer: "Gepflegt", used: false },
    { keywords: ["ausstattung", "merkmale", "besonderheiten"], answer: "Keller, Stellplatz, Garten, Fußbodenheizung, Smart Home", used: false },
    { keywords: ["wohneinheiten", "einheiten", "wohnungen", "wie viele"], answer: "3 Wohneinheiten", used: false },
    { keywords: ["einzeln", "wohnung 1", "wohnungen", "beschreiben", "details", "größe"], answer: "WE1: 95m², 3 Zimmer, 1 Bad, 1.OG. WE2: 95m², 3 Zimmer, 1 Bad, EG. WE3: 55m², 2 Zimmer, 1 Bad, EG.", used: false },
    { keywords: ["verkauf", "verkaufen möchten", "paket", "einzeln oder"], answer: "Beides, Paket und Einzelverkauf", used: false },
    { keywords: ["extras", "stellplätze", "kellerabteile", "separat bepreist"], answer: "6 TG-Stellplätze à 15.000€, 10 Außenstellplätze à 8.000€, 3 Kellerabteile à 5.000€", used: false },
    { keywords: ["energieausweis", "energie"], answer: "Ja, Verbrauch, Klasse B, 70,2 kWh, Gas, gültig bis 2034-03-15", used: false },
    { keywords: ["foto", "bild", "upload", "hochladen"], answer: "__INJECT_PHOTOS__", used: false },
    { keywords: ["grundriss"], answer: "Nein, kein Grundriss.", used: false },
    { keywords: ["ausstattungsdetails", "bodenbelag", "parkett", "heizungsart", "fenster"], answer: "Parkett in allen Wohnungen, Fliesen im Bad, Kunststofffenster", used: false },
    { keywords: ["raum", "räume", "einzelnen räume"], answer: "Nein danke.", used: false },
    { keywords: ["kontaktdaten"], answer: "Nein danke.", used: false },
    { keywords: ["preis", "wunschpreis", "angebotspreis"], answer: "525.000 €", used: false },
    { keywords: ["bestätig", "erstellen", "so erstellen", "ja"], answer: "Ja, bitte erstellen.", used: false },
    { keywords: ["stimm", "korrekt", "richtig"], answer: "Ja, stimmt.", used: false },
    { keywords: ["derselben", "gleiche adresse"], answer: "Ja", used: false },
    { keywords: ["entfernen", "unbelegte", "hallucination"], answer: "Ja, bitte entfernen und neu erstellen.", used: false },
    { keywords: ["erweitern", "kürzen", "anpassen", "text"], answer: "Ja, bitte anpassen.", used: false },
  ];

  function pickAnswer(agentMsg: string): string {
    const lower = agentMsg.toLowerCase();
    for (const entry of answerBank) {
      if (entry.used) continue;
      for (const kw of entry.keywords) {
        if (lower.includes(kw)) {
          entry.used = true;
          return entry.answer;
        }
      }
    }
    // Fallback: check unused entries more loosely
    for (const entry of answerBank) {
      if (!entry.used) {
        entry.used = true;
        return entry.answer;
      }
    }
    return "Ja";
  }

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  STEP-BY-STEP TEST — MFH Scenario A (one answer at a time) ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  try {
    // Greeting
    let result = await turn(null);
    let maxTurns = 30;

    while (maxTurns-- > 0) {
      if (result.finished) {
        console.log("\n\n🏁 PIPELINE COMPLETE — ADVERTISEMENTS CREATED!");
        break;
      }

      const nq = nextQuestion(m);

      // If photos needed — inject them
      if (nq.action === "upload_photos" || (nq.action === "ask" && nq.field === "photos")) {
        console.log("\n  📷 [Injecting 3 photos into memory]");
        const photos = await prisma.mediaAsset.findMany({
          where: { propertyId: { not: null }, kind: "PHOTO" },
          select: { storageKey: true, fileName: true, mimeType: true, sizeBytes: true, width: true, height: true },
          take: 3, orderBy: { ordering: "asc" },
        });
        for (const p of photos.length > 0 ? photos : [
          { storageKey: "/uploads/test/p1.jpg", fileName: "p1.jpg", mimeType: "image/jpeg", sizeBytes: 500000, width: 1920, height: 1080 },
          { storageKey: "/uploads/test/p2.jpg", fileName: "p2.jpg", mimeType: "image/jpeg", sizeBytes: 500000, width: 1920, height: 1080 },
          { storageKey: "/uploads/test/p3.jpg", fileName: "p3.jpg", mimeType: "image/jpeg", sizeBytes: 500000, width: 1920, height: 1080 },
        ]) {
          const u = { storageKey: p.storageKey, fileName: p.fileName || "p.jpg", mimeType: p.mimeType || "image/jpeg", sizeBytes: p.sizeBytes || 500000, width: p.width, height: p.height, kind: "PHOTO" as const };
          m.uploads.push(u);
          await prisma.conversationTurn.create({ data: { conversationId: cid, role: "SYSTEM", content: `[Upload] ${p.fileName}`, toolName: "upload", toolOutput: { memoryPatch: { uploads: [u] } } } });
        }
        result = await turn("3 Fotos vom Gebäude hochgeladen.");
        continue;
      }

      // If pricing/draft needed — nudge
      if (nq.action === "trigger_pricing" || nq.action === "trigger_draft") {
        result = await turn("Bitte weiter.");
        continue;
      }

      // If waiting for confirm
      if (nq.action === "wait_confirm") {
        result = await turn("Ja, bitte erstellen.");
        continue;
      }

      // Pick answer based on what agent asked
      const answer = pickAnswer(result.agentMessage);

      // Handle photo injection via answer bank
      if (answer === "__INJECT_PHOTOS__") {
        console.log("\n  📷 [Injecting 3 photos into memory]");
        const photos = await prisma.mediaAsset.findMany({
          where: { propertyId: { not: null }, kind: "PHOTO" },
          select: { storageKey: true, fileName: true, mimeType: true, sizeBytes: true, width: true, height: true },
          take: 3, orderBy: { ordering: "asc" },
        });
        for (const p of photos.length > 0 ? photos : [
          { storageKey: "/uploads/test/p1.jpg", fileName: "p1.jpg", mimeType: "image/jpeg", sizeBytes: 500000, width: 1920, height: 1080 },
        ]) {
          const u = { storageKey: p.storageKey, fileName: p.fileName || "p.jpg", mimeType: p.mimeType || "image/jpeg", sizeBytes: p.sizeBytes || 500000, width: p.width, height: p.height, kind: "PHOTO" as const };
          m.uploads.push(u);
          await prisma.conversationTurn.create({ data: { conversationId: cid, role: "SYSTEM", content: `[Upload] ${p.fileName}`, toolName: "upload", toolOutput: { memoryPatch: { uploads: [u] } } } });
        }
        result = await turn("Fotos hochgeladen.");
        continue;
      }

      result = await turn(answer);
    }

    // Final state
    console.log(`\n${"═".repeat(60)}`);
    console.log("FINAL MEMORY STATE");
    console.log(`${"═".repeat(60)}`);
    console.log(`Type:       ${m.type}`);
    console.log(`Address:    ${m.street} ${m.houseNumber}, ${m.postcode} ${m.city}`);
    console.log(`Area:       ${m.livingArea} m² | Plot: ${m.plotArea} m²`);
    console.log(`Rooms:      ${m.rooms} | Baths: ${m.bathrooms} | Year: ${m.yearBuilt}`);
    console.log(`Condition:  ${m.condition}`);
    console.log(`Attributes: ${m.attributes?.join(", ") || "none"}`);
    console.log(`Energy:     ${m.hasEnergyCert ? `${m.energyClass}/${m.energyValue}kWh/${m.energySource} until ${m.energyValidUntil}` : "—"}`);
    console.log(`Units:      ${m.units?.length || 0}`);
    if (m.units?.length > 0) for (const u of m.units) console.log(`  └ ${u.label}: ${u.livingArea}m² ${u.rooms}Zi`);
    console.log(`Selling:    ${m.sellingMode}`);
    console.log(`Extras:     ${m.extras?.length > 0 ? m.extras.map((e: any) => `${e.name}×${e.quantity} à ${e.pricePerUnit}€`).join(", ") : "none"}`);
    console.log(`Specs:      ${Object.keys(m.specifications || {}).length > 0 ? Object.entries(m.specifications).map(([k, v]: any) => `${k}: ${JSON.stringify(v)}`).join(" | ") : "none"}`);
    console.log(`Photos:     ${m.uploads?.filter((u: any) => u.kind === "PHOTO").length}`);
    console.log(`Price band: ${m.priceBand ? `${m.priceBand.low}-${m.priceBand.high}€` : "—"}`);
    console.log(`Ask price:  ${m.askingPrice || "—"}€`);
    console.log(`Draft:      ${m.draft ? `"${m.draft.titleShort}"` : "—"}`);
    console.log(`Rubric:     ${m.lastRubric ? (m.lastRubric.passed ? "PASSED ✓" : `FAILED: ${m.lastRubric.failures?.join(" | ")}`) : "—"}`);
    console.log(`Handoff:    ${m.handoffReady}`);
    console.log(`Total cost: ${ctx.startingCostCents}¢ / ${MAX_COST_CENTS}¢`);
    console.log(`Turns:      ${turnNum}`);

  } catch (e: any) {
    console.error(`\n❌ ERROR: ${e.message}`);
    console.error(e.stack?.split("\n").slice(0, 5).join("\n"));
  }

  // Cleanup
  console.log("\nCleaning up...");
  await prisma.conversationTurn.deleteMany({ where: { conversationId: cid } });
  await prisma.agentStep.deleteMany({ where: { agentRunId: ar.id } });
  await prisma.agentRun.delete({ where: { id: ar.id } });
  await prisma.conversation.delete({ where: { id: cid } });
  await prisma.$disconnect();
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
