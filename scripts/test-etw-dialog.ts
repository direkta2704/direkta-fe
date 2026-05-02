/**
 * ETW Single-Answer Dialog Test — Scenario B1
 * Seller answers one question at a time. Verifies group ordering,
 * extraction accuracy, and pipeline triggering.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { rebuildMemory, runAgentTurn, generateInitialGreeting } from "../src/lib/expose-agent.js";
import type { AgentRunContext } from "../src/lib/expose-agent.js";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";

const prisma = new PrismaClient();

// Scenario B1 answers, given one at a time
const DIALOG_ANSWERS = [
  "Eigentumswohnung",
  "Marktstraße 12",
  "76571 Gaggenau",
  "95",                         // livingArea
  "Gepflegt",                   // condition
  "3",                          // rooms
  "1999",                       // yearBuilt
  "1",                          // bathrooms
  "1",                          // floor
  "Keller, Stellplatz, Fußbodenheizung, Smart Home, Abstellkammer",
  "Ja, Verbrauchsausweis, Klasse B, 70,2 kWh, Gas",  // energy
];

async function uploadPhotos(conversationId: string, count: number) {
  const photoDir = path.join(process.cwd(), "public", "uploads", "cmojjb6jj0027j0iw38kjgdtl");
  const jpgs = fs.readdirSync(photoDir).filter((f) => f.toLowerCase().endsWith(".jpg")).slice(0, count);
  for (let i = 0; i < jpgs.length; i++) {
    const raw = fs.readFileSync(path.join(photoDir, jpgs[i]));
    const resized = await sharp(raw).resize({ width: 1920, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
    const meta = await sharp(resized).metadata();
    const fileName = `${randomUUID()}.jpg`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "conversations", conversationId);
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, fileName), resized);
    await prisma.conversationTurn.create({
      data: {
        conversationId,
        role: "SYSTEM",
        content: `[Upload] Foto: photo-${i}.jpg`,
        toolName: "upload",
        toolOutput: {
          memoryPatch: {
            uploads: [{
              storageKey: `/uploads/conversations/${conversationId}/${fileName}`,
              fileName: `photo-${i}.jpg`,
              mimeType: "image/jpeg",
              sizeBytes: resized.length,
              width: meta.width ?? null,
              height: meta.height ?? null,
              kind: "PHOTO" as const,
              classification: i < 2 ? { roomType: "exterior", qualityScore: 75, qualityFlags: [] } : undefined,
            }],
          },
        },
      },
    });
  }
}

async function main() {
  console.log("═══ ETW SINGLE-ANSWER DIALOG TEST (Scenario B1) ═══\n");

  const user = await prisma.user.findFirst({ orderBy: { createdAt: "desc" } });
  if (!user) throw new Error("No user");

  const conversation = await prisma.conversation.create({
    data: { userId: user.id, agentKind: "EXPOSE", status: "ACTIVE" },
  });
  const agentRun = await prisma.agentRun.create({
    data: { conversationId: conversation.id, agentKind: "EXPOSE", status: "RUNNING", costCents: 0, goal: "ETW dialog test B1" },
  });
  const ctx: AgentRunContext = { conversationId: conversation.id, agentRunId: agentRun.id, userId: user.id, startingCostCents: 0 };
  let totalCost = 0;

  // Greeting
  const greeting = await generateInitialGreeting(ctx);
  await prisma.conversationTurn.create({ data: { conversationId: conversation.id, role: "AGENT", content: greeting.message } });
  totalCost += greeting.costCents;
  await prisma.agentRun.update({ where: { id: agentRun.id }, data: { costCents: totalCost } });
  console.log(`Turn 0 [AGENT]: ${greeting.message.slice(0, 100)}...\n`);

  async function getHistory() {
    const turns = await prisma.conversationTurn.findMany({
      where: { conversationId: conversation.id }, orderBy: { createdAt: "asc" },
    });
    return turns.filter((t) => t.role === "USER" || t.role === "AGENT")
      .map((t) => ({ role: (t.role === "USER" ? "user" : "assistant") as "user" | "assistant", content: t.content }));
  }

  async function sendTurn(msg: string, turnNum: number) {
    await prisma.conversationTurn.create({ data: { conversationId: conversation.id, role: "USER", content: msg } });
    const history = await getHistory();
    const allTurns = await prisma.conversationTurn.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: "asc" } });
    const memory = rebuildMemory(allTurns);
    const r = await runAgentTurn({ ...ctx, startingCostCents: totalCost }, memory, history, msg);
    totalCost += r.costCentsThisTurn;
    await prisma.agentRun.update({ where: { id: agentRun.id }, data: { costCents: totalCost } });
    await prisma.conversationTurn.create({ data: { conversationId: conversation.id, role: "AGENT", content: r.agentMessage } });

    const wmAfter = rebuildMemory(
      await prisma.conversationTurn.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: "asc" } })
    );

    console.log(`Turn ${turnNum} [USER]: ${msg}`);
    console.log(`Turn ${turnNum} [AGENT]: ${r.agentMessage.slice(0, 200)}...`);
    console.log(`  tools: ${r.toolStepsExecuted}, cost: ${r.costCentsThisTurn}c, total: ${totalCost}c, compressed: ${wmAfter.costCompressed}`);
    console.log("");
    return { result: r, memory: wmAfter };
  }

  // Dialog answers
  let turnNum = 1;
  const fieldsAfterTurn: Record<number, string[]> = {};

  for (const answer of DIALOG_ANSWERS) {
    const { result, memory } = await sendTurn(answer, turnNum);

    // Track which fields are filled after each turn
    const filled: string[] = [];
    if (memory.type) filled.push("type=" + memory.type);
    if (memory.street) filled.push("street=" + memory.street);
    if (memory.postcode) filled.push("postcode=" + memory.postcode);
    if (memory.city) filled.push("city=" + memory.city);
    if (memory.livingArea) filled.push("area=" + memory.livingArea);
    if (memory.condition) filled.push("condition=" + memory.condition);
    if (memory.rooms != null) filled.push("rooms=" + memory.rooms);
    if (memory.yearBuilt) filled.push("year=" + memory.yearBuilt);
    if (memory.bathrooms != null) filled.push("baths=" + memory.bathrooms);
    if (memory.floor != null) filled.push("floor=" + memory.floor);
    if (memory.attributes.length > 0) filled.push("attrs=" + memory.attributes.length);
    if (memory.hasEnergyCert !== null) filled.push("energy=" + memory.energyClass);
    if (memory.askingPrice) filled.push("price=" + memory.askingPrice);
    if (memory.addressValidated) filled.push("addrOK");
    fieldsAfterTurn[turnNum] = filled;

    if (result.finished) {
      console.log("── HANDOFF TRIGGERED ──\n");
      break;
    }
    turnNum++;
  }

  // Upload photos
  console.log("── Uploading 6 Photos (2 classified as exterior) ──");
  await uploadPhotos(conversation.id, 6);
  console.log("  📷 6 photos uploaded\n");

  // Tell agent about photos
  const { result: photoResult, memory: photoMem } = await sendTurn("6 Fotos hochgeladen.", turnNum++);

  // Skip floor plan
  if (!photoResult.finished) {
    const { result: fpResult } = await sendTurn("Keinen Grundriss. Preis: 195.000 Euro.", turnNum++);

    // Continue to completion
    for (let i = 0; i < 5 && !fpResult.finished; i++) {
      const allT = await prisma.conversationTurn.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: "asc" } });
      const mem = rebuildMemory(allT);

      if (mem.lastRubric?.passed) {
        const { result: handoffR } = await sendTurn("Ja, Inserat erstellen.", turnNum++);
        if (handoffR.finished) break;
      } else if (mem.lastRubric && !mem.lastRubric.passed) {
        // Check if price-in-band is the issue
        if (!mem.lastRubric.details.priceInBand.ok) {
          await sendTurn("A", turnNum++); // Keep my price
        } else {
          await sendTurn("Ja, bitte anpassen.", turnNum++);
        }
      } else {
        await sendTurn("Bitte fortfahren.", turnNum++);
      }
    }
  }

  // Final report
  const allTurns = await prisma.conversationTurn.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: "asc" } });
  const finalMem = rebuildMemory(allTurns);

  console.log("═══ FINAL REPORT ═══");
  console.log("Conversation ID:", conversation.id);
  console.log("Total turns:", allTurns.length);
  console.log("Total cost:", totalCost + "c (€" + (totalCost / 100).toFixed(2) + ")");
  console.log("Cost compressed:", finalMem.costCompressed);
  console.log("");
  console.log("── Extraction Accuracy ──");
  console.log("type:", finalMem.type, "(expected: ETW)");
  console.log("street:", finalMem.street, finalMem.houseNumber, "(expected: Marktstraße 12)");
  console.log("postcode/city:", finalMem.postcode, finalMem.city, "(expected: 76571 Gaggenau)");
  console.log("livingArea:", finalMem.livingArea, "(expected: 95)");
  console.log("rooms:", finalMem.rooms, "(expected: 3)");
  console.log("bathrooms:", finalMem.bathrooms, "(expected: 1)");
  console.log("floor:", finalMem.floor, "(expected: 1)");
  console.log("yearBuilt:", finalMem.yearBuilt, "(expected: 1999)");
  console.log("condition:", finalMem.condition, "(expected: GEPFLEGT)");
  console.log("attributes:", finalMem.attributes.join(", "));
  console.log("energy:", finalMem.energyClass, finalMem.energyValue, finalMem.energySource, "(expected: B 70.2 Gas)");
  console.log("askingPrice:", finalMem.askingPrice, "(expected: 195000)");
  console.log("addressValidated:", finalMem.addressValidated);
  console.log("");
  console.log("── Pipeline ──");
  console.log("Draft:", finalMem.draft ? "YES (" + finalMem.draft.descriptionLong.split(/\s+/).filter(Boolean).length + " words)" : "NO");
  console.log("Rubric:", finalMem.lastRubric ? (finalMem.lastRubric.passed ? "PASSED" : "FAILED: " + finalMem.lastRubric.failures.join(" | ")) : "NOT RUN");
  if (finalMem.lastRubric) {
    const d = finalMem.lastRubric.details;
    console.log("  wordCount:", d.wordCount.ok ? "PASS (" + d.wordCount.words + "w)" : "FAIL (" + (d.wordCount.words || 0) + "w)");
    console.log("  hallucination:", d.noHallucination.ok ? "PASS" : "FAIL (" + (d.noHallucination.flagged?.length || 0) + " flags)");
    console.log("  photos:", d.photos.ok ? "PASS" : "FAIL");
    console.log("  gegFields:", d.gegFields.ok ? "PASS" : "FAIL");
    console.log("  priceInBand:", d.priceInBand.ok ? "PASS" : "FAIL");
  }
  console.log("handoffReady:", finalMem.handoffReady);
  console.log("Finished:", allTurns.some(t => t.role === "AGENT" && t.content.includes("Inserat ist erstellt")));

  await prisma.$disconnect();
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
