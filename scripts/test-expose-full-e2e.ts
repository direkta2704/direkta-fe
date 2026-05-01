/**
 * Full E2E test: MFH with photos, floor plans, multi-unit, pricing, draft, review, handoff.
 * Usage: npx tsx scripts/test-expose-full-e2e.ts
 */
require("dotenv").config({ path: ".env.local" });

import { readFile } from "fs/promises";
import { join } from "path";

async function main() {
  const { runAgentTurn, INITIAL_MEMORY, MAX_COST_CENTS } = require("../src/lib/expose-agent");
  const { PrismaClient } = require("@prisma/client");
  const p = new PrismaClient();
  const user = (await p.user.findMany({ take: 1 }))[0];

  console.log("=== FULL E2E TEST: MFH with photos + floor plans ===\n");

  // Get real S3 photo URLs from existing property
  const existingPhotos = await p.mediaAsset.findMany({
    where: { propertyId: { not: null }, kind: "PHOTO" },
    select: { storageKey: true, fileName: true, mimeType: true, sizeBytes: true, width: true, height: true },
    take: 6,
    orderBy: { ordering: "asc" },
  });
  console.log(`Found ${existingPhotos.length} existing photos to reuse\n`);

  const cid = "e2e-" + Date.now();
  await p.conversation.create({ data: { id: cid, userId: user.id, agentKind: "EXPOSE", status: "ACTIVE" } });
  const ar = await p.agentRun.create({ data: { agentKind: "EXPOSE", conversationId: cid, goal: "Full E2E", status: "RUNNING", costCents: 0 } });
  const ctx = { conversationId: cid, agentRunId: ar.id, userId: user.id, startingCostCents: 0 };
  let m = { ...INITIAL_MEMORY, attributes: [] as string[], uploads: [] as any[], assumptions: [] as string[], units: [] as any[] };
  let h: Array<{ role: string; content: string }> = [];

  // Helper
  async function turn(msg: string | null) {
    if (msg) h.push({ role: "user", content: msg });
    const t = await runAgentTurn(ctx, m, h, msg);
    m = t.memory; ctx.startingCostCents = t.costCentsTotal;
    h.push({ role: "assistant", content: t.agentMessage });
    const label = msg ? `"${msg.slice(0, 50)}"` : "(greeting)";
    console.log(`${label} → ${t.agentMessage?.slice(0, 80)}  [${t.costCentsThisTurn}¢, tools:${t.toolStepsExecuted}]`);
    return t;
  }

  // 1. Conversation flow
  await turn(null); // greeting
  await turn("Mehrfamilienhaus");
  await turn("Marktstraße 12");
  await turn("76571 Gaggenau");
  await turn("250");
  await turn("450");
  await turn("8");
  await turn("3");
  await turn("1999");
  await turn("Gepflegt");
  await turn("Keller, Stellplatz, Garten, Fußbodenheizung, Smart Home");
  await turn("3 Wohneinheiten");
  await turn("Wohnung 1: 95 m², 3 Zimmer, 1 Bad, 1. OG. Wohnung 2: 95 m², 3 Zimmer, 1 Bad, EG. Wohnung 3: 55 m², 2 Zimmer, 1 Bad, EG.");
  await turn("Beides, Paket und Einzelverkauf");
  await turn("Ja, Verbrauchsausweis, Klasse B, 70,2 kWh, Gas");

  // 2. Inject photo uploads into memory (simulate upload endpoint)
  console.log("\n--- Injecting 6 photos into memory ---");
  for (let i = 0; i < Math.min(existingPhotos.length, 6); i++) {
    const photo = existingPhotos[i];
    const upload = {
      storageKey: photo.storageKey,
      fileName: photo.fileName || `photo_${i}.jpg`,
      mimeType: photo.mimeType,
      sizeBytes: photo.sizeBytes || 0,
      width: photo.width,
      height: photo.height,
      kind: "PHOTO",
    };
    m.uploads.push(upload);

    // Persist as SYSTEM turn for rebuildMemory
    await p.conversationTurn.create({
      data: {
        conversationId: cid,
        role: "SYSTEM",
        content: `[Upload] Foto: ${photo.fileName}`,
        toolName: "upload",
        toolOutput: { memoryPatch: { uploads: [upload] } },
      },
    });
  }
  console.log(`Photos in memory: ${m.uploads.filter((u: any) => u.kind === "PHOTO").length}`);

  // 3. Inject floor plans
  console.log("\n--- Injecting floor plans ---");
  const floorPlanFiles = ["AB+TE_Erdgeschoss.pdf", "EG  VAR 03 Endzustand.pdf"];
  for (const fp of floorPlanFiles) {
    try {
      const buf = await readFile(join(process.cwd(), fp));
      const upload = {
        storageKey: `/uploads/test/${fp}`,
        fileName: fp,
        mimeType: "application/pdf",
        sizeBytes: buf.length,
        width: null,
        height: null,
        kind: "FLOORPLAN",
      };
      m.uploads.push(upload);
      m.hasFloorPlan = true;

      await p.conversationTurn.create({
        data: {
          conversationId: cid,
          role: "SYSTEM",
          content: `[Upload] Grundriss: ${fp}`,
          toolName: "upload",
          toolOutput: { memoryPatch: { uploads: [upload], hasFloorPlan: true } },
        },
      });
      console.log(`  ✓ ${fp} (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (e: any) {
      console.log(`  ✗ ${fp}: ${e.message}`);
    }
  }

  // 4. Continue: tell agent photos and floor plans are done
  await turn("Fotos und Grundrisse sind hochgeladen. Bitte Preis berechnen.");

  // 5. Set price
  await turn("525000");

  // 6. Check memory state
  console.log("\n=== MEMORY STATE ===");
  console.log("type:", m.type);
  console.log("address:", m.street, m.houseNumber, m.postcode, m.city);
  console.log("area:", m.livingArea, "m² | plot:", m.plotArea, "m²");
  console.log("rooms:", m.rooms, "| baths:", m.bathrooms, "| year:", m.yearBuilt);
  console.log("condition:", m.condition);
  console.log("attributes:", m.attributes);
  console.log("unitCount:", m.unitCount);
  console.log("units:", m.units.length, "units");
  m.units.forEach((u: any) => console.log(`  ${u.label}: ${u.livingArea}m², ${u.rooms}Zi, ${u.bathrooms}Bad, OG${u.floor}`));
  console.log("sellingMode:", m.sellingMode);
  console.log("energy:", m.energyCertType, m.energyClass, m.energyValue, m.energySource);
  console.log("photos:", m.uploads.filter((u: any) => u.kind === "PHOTO").length);
  console.log("floorplans:", m.uploads.filter((u: any) => u.kind === "FLOORPLAN").length);
  console.log("hasFloorPlan:", m.hasFloorPlan);
  console.log("priceBand:", m.priceBand ? `${m.priceBand.low}-${m.priceBand.high}` : "—");
  console.log("askingPrice:", m.askingPrice);
  console.log("draft:", m.draft ? "YES" : "NO");
  console.log("rubric:", m.lastRubric ? (m.lastRubric.passed ? "PASSED" : `FAILED: ${m.lastRubric.failures.join(", ")}`) : "—");
  console.log("isReady:", !!(m.type && m.street && m.houseNumber && m.postcode && m.city && m.livingArea && m.condition));
  console.log("Cost:", ctx.startingCostCents, "¢ of", MAX_COST_CENTS, "¢");

  // Cleanup
  console.log("\n--- Cleaning up ---");
  await p.conversationTurn.deleteMany({ where: { conversationId: cid } });
  await p.agentStep.deleteMany({ where: { agentRunId: ar.id } });
  await p.agentRun.delete({ where: { id: ar.id } });
  await p.conversation.delete({ where: { id: cid } });
  console.log("Done.");
  await p.$disconnect();
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
