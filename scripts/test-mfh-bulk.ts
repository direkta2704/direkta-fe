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

const MFH_BULK = `Mehrfamilienhaus, Marktstraße 12, 76571 Gaggenau, 250 m², Grundstück 450 m², 8 Zimmer, 3 Bäder, Baujahr 1999, Gepflegt, Keller, Stellplatz, Garten, Fußbodenheizung, Smart Home. 3 Wohnungen: Wohnung 1: 95 m², 3 Zimmer, 1 Bad, Obergeschoss. Wohnung 2: 95 m², 3 Zimmer, 1 Bad, Erdgeschoss. Wohnung 3: 55 m², 2 Zimmer, 1 Bad, Erdgeschoss. Verkauf: Beides (Paket und Einzelverkauf). Energieausweis: Verbrauchsausweis, Klasse B, 70,2 kWh, Gas. Preis: 525.000 €`;

async function uploadPhotos(conversationId: string) {
  const photoDir = path.join(process.cwd(), "public", "uploads", "cmojjb6jj0027j0iw38kjgdtl");
  const jpgs = fs.readdirSync(photoDir).filter((f) => f.toLowerCase().endsWith(".jpg")).slice(0, 6);
  for (let i = 0; i < jpgs.length; i++) {
    const raw = fs.readFileSync(path.join(photoDir, jpgs[i]));
    const resized = await sharp(raw).resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
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
              kind: "PHOTO",
            }],
          },
        },
      },
    });
  }
  console.log(`  📷 ${jpgs.length} photos uploaded`);
}

async function main() {
  console.log("═══ MFH BULK PASTE TEST (All 4 bug fixes) ═══\n");

  const user = await prisma.user.findFirst({ orderBy: { createdAt: "desc" } });
  if (!user) throw new Error("No user");

  const conversation = await prisma.conversation.create({
    data: { userId: user.id, agentKind: "EXPOSE", status: "ACTIVE" },
  });
  const agentRun = await prisma.agentRun.create({
    data: { conversationId: conversation.id, agentKind: "EXPOSE", status: "RUNNING", costCents: 0, goal: "MFH bulk paste test" },
  });
  const ctx: AgentRunContext = { conversationId: conversation.id, agentRunId: agentRun.id, userId: user.id, startingCostCents: 0 };
  let totalCost = 0;

  // Greeting
  const greeting = await generateInitialGreeting(ctx);
  await prisma.conversationTurn.create({ data: { conversationId: conversation.id, role: "AGENT", content: greeting.message } });
  totalCost += greeting.costCents;
  await prisma.agentRun.update({ where: { id: agentRun.id }, data: { costCents: totalCost } });
  console.log("Turn 0 (greeting): " + greeting.message.slice(0, 80) + "...\n");

  async function getHistory() {
    const turns = await prisma.conversationTurn.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
    });
    return turns
      .filter((t) => t.role === "USER" || t.role === "AGENT")
      .map((t) => ({ role: (t.role === "USER" ? "user" : "assistant") as "user" | "assistant", content: t.content }));
  }

  async function sendTurn(msg: string, label: string) {
    console.log(`── ${label} ──`);
    console.log(`User: ${msg.slice(0, 100)}...`);
    await prisma.conversationTurn.create({ data: { conversationId: conversation.id, role: "USER", content: msg } });
    const history = await getHistory();
    const allTurns = await prisma.conversationTurn.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: "asc" } });
    const memory = rebuildMemory(allTurns);
    const r = await runAgentTurn({ ...ctx, startingCostCents: totalCost }, memory, history, msg);
    totalCost += r.costCentsThisTurn;
    await prisma.agentRun.update({ where: { id: agentRun.id }, data: { costCents: totalCost } });
    await prisma.conversationTurn.create({ data: { conversationId: conversation.id, role: "AGENT", content: r.agentMessage } });
    console.log(`Agent: ${r.agentMessage.slice(0, 250)}...`);
    console.log(`Tools: ${r.toolStepsExecuted}, Cost: ${r.costCentsThisTurn}c, Total: ${totalCost}c, Finished: ${r.finished}\n`);
    return r;
  }

  // Turn 1: MFH bulk paste
  let r = await sendTurn(MFH_BULK, "Turn 1: MFH Bulk Paste");

  // Upload photos
  console.log("── Uploading Photos ──");
  await uploadPhotos(conversation.id);
  console.log("");

  // Turn 2: Photos notification
  r = await sendTurn("6 Fotos hochgeladen.", "Turn 2: Photos");

  // Turn 3: Skip floor plan, confirm price
  if (!r.finished) r = await sendTurn("Keinen Grundriss.", "Turn 3: No floor plan");

  // Continue up to 5 more turns
  for (let i = 4; i <= 8 && !r.finished; i++) {
    const allTurns = await prisma.conversationTurn.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: "asc" } });
    const memory = rebuildMemory(allTurns);

    if (memory.lastRubric && !memory.lastRubric.passed) {
      r = await sendTurn("Ja, bitte den Text anpassen.", `Turn ${i}: Rubric re-ask`);
    } else if (memory.draft && memory.lastRubric?.passed) {
      r = await sendTurn("Ja, Inserat erstellen.", `Turn ${i}: Confirm handoff`);
    } else {
      r = await sendTurn("Bitte fortfahren.", `Turn ${i}: Continue`);
    }
  }

  // Final state
  const allTurns = await prisma.conversationTurn.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: "asc" } });
  const memory = rebuildMemory(allTurns);

  console.log("═══ FINAL STATE ═══");
  console.log("Conversation ID:", conversation.id);
  console.log("Total turns:", allTurns.length);
  console.log("Total cost:", totalCost + "c (€" + (totalCost / 100).toFixed(2) + ")");
  console.log("");
  console.log("addressValidated:", memory.addressValidated);
  console.log("lat/lng:", memory.lat, memory.lng);
  console.log("sellerContact:", JSON.stringify(memory.sellerContact));
  console.log("askingPrice:", memory.askingPrice);
  console.log("unitCount:", memory.unitCount);
  console.log("units:", memory.units.length);
  console.log("sellingMode:", memory.sellingMode);
  console.log("");
  console.log("Draft:", memory.draft ? "YES (" + memory.draft.descriptionLong.split(/\s+/).filter(Boolean).length + " words)" : "NO");
  console.log("Rubric:", memory.lastRubric ? (memory.lastRubric.passed ? "PASSED" : "FAILED: " + memory.lastRubric.failures.join(" | ")) : "NOT RUN");

  if (memory.lastRubric) {
    const d = memory.lastRubric.details;
    console.log("  wordCount:", d.wordCount.ok ? "PASS (" + d.wordCount.words + "w)" : "FAIL (" + d.wordCount.words + "w)");
    console.log("  hallucination:", d.noHallucination.ok ? "PASS" : "FAIL (" + (d.noHallucination.flagged?.length || 0) + " flags)");
    console.log("  photos:", d.photos.ok ? "PASS" : "FAIL");
    console.log("  gegFields:", d.gegFields.ok ? "PASS" : "FAIL");
    console.log("  superlatives:", d.noSuperlatives.ok ? "PASS" : "FAIL");
    console.log("  priceInBand:", d.priceInBand.ok ? "PASS" : "FAIL");
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
