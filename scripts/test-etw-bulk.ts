/**
 * ETW Bulk Paste Test — drives a full conversation via agent functions directly.
 * Calls the real LLM. No HTTP layer, no auth. Tests agent logic end-to-end.
 *
 * Run: npx tsx scripts/test-etw-bulk.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { rebuildMemory, runAgentTurn, generateInitialGreeting, executeTool } from "../src/lib/expose-agent.js";
import type { AgentRunContext } from "../src/lib/expose-agent.js";
import { readFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";

const prisma = new PrismaClient();

const BULK_PASTE = `Eigentumswohnung, Marktstraße 12, 76571 Gaggenau, 95 m², 3 Zimmer, 1 Bad, Baujahr 1999, 1. OG, Gepflegt, Keller, Stellplatz, Fußbodenheizung, Smart Home. Energieausweis: Verbrauchsausweis, Klasse B, 70,2 kWh, Gas. Preis: 195.000 €`;

async function uploadPhoto(conversationId: string, agentRunId: string, photoPath: string, index: number) {
  const raw = await readFile(photoPath);
  const resized = await sharp(raw).resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  const meta = await sharp(resized).metadata();

  const fileName = `${randomUUID()}.jpg`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "conversations", conversationId);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, fileName), resized);
  const storageKey = `/uploads/conversations/${conversationId}/${fileName}`;

  // Create SYSTEM turn for the upload
  await prisma.conversationTurn.create({
    data: {
      conversationId,
      role: "SYSTEM",
      content: `[Upload] Foto: photo-${index}.jpg`,
      toolName: "upload",
      toolOutput: {
        memoryPatch: {
          uploads: [{
            storageKey,
            fileName: `photo-${index}.jpg`,
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
  console.log(`  📷 Photo ${index + 1} uploaded: ${storageKey}`);
}

async function main() {
  console.log("═══ ETW BULK PASTE TEST ═══\n");

  // Find a user
  const user = await prisma.user.findFirst({ orderBy: { createdAt: "desc" } });
  if (!user) throw new Error("No user found");
  console.log(`User: ${user.email}\n`);

  // Create conversation
  const conversation = await prisma.conversation.create({
    data: { userId: user.id, agentKind: "EXPOSE", status: "ACTIVE" },
  });
  const agentRun = await prisma.agentRun.create({
    data: {
      conversationId: conversation.id,
      agentKind: "EXPOSE",
      status: "RUNNING",
      costCents: 0,
      goal: "ETW bulk paste test",
    },
  });
  console.log(`Conversation: ${conversation.id}`);
  console.log(`AgentRun: ${agentRun.id}\n`);

  const ctx: AgentRunContext = {
    conversationId: conversation.id,
    agentRunId: agentRun.id,
    userId: user.id,
    startingCostCents: 0,
  };

  // Generate greeting
  console.log("── Turn 0: Greeting ──");
  const greeting = await generateInitialGreeting(ctx);
  await prisma.conversationTurn.create({
    data: { conversationId: conversation.id, role: "AGENT", content: greeting.message },
  });
  console.log(`Agent: ${greeting.message.slice(0, 120)}...`);
  console.log(`Cost: ${greeting.costCents}c\n`);

  let totalCost = greeting.costCents;
  await prisma.agentRun.update({ where: { id: agentRun.id }, data: { costCents: totalCost } });

  // Helper to rebuild history (USER + AGENT only — tool calls are handled inside runAgentTurn)
  async function getHistory() {
    const turns = await prisma.conversationTurn.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
    });
    return turns
      .filter((t) => t.role === "USER" || t.role === "AGENT")
      .map((t) => ({
        role: (t.role === "USER" ? "user" : "assistant") as "user" | "assistant",
        content: t.content,
      }));
  }

  // Turn 1: Bulk paste
  console.log("── Turn 1: Bulk Paste ──");
  console.log(`User: ${BULK_PASTE.slice(0, 100)}...`);

  await prisma.conversationTurn.create({
    data: { conversationId: conversation.id, role: "USER", content: BULK_PASTE },
  });

  let history = await getHistory();
  let allTurns = await prisma.conversationTurn.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
  });
  let memory = rebuildMemory(allTurns);

  const result1 = await runAgentTurn({ ...ctx, startingCostCents: totalCost }, memory, history, BULK_PASTE);
  totalCost += result1.costCentsThisTurn;
  await prisma.agentRun.update({ where: { id: agentRun.id }, data: { costCents: totalCost } });
  await prisma.conversationTurn.create({
    data: { conversationId: conversation.id, role: "AGENT", content: result1.agentMessage },
  });

  console.log(`Agent: ${result1.agentMessage.slice(0, 200)}...`);
  console.log(`Tools: ${result1.toolStepsExecuted}, Cost: ${result1.costCentsThisTurn}c, Total: ${totalCost}c`);

  // Check extraction
  allTurns = await prisma.conversationTurn.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
  });
  memory = rebuildMemory(allTurns);
  console.log(`\n── Extracted Data ──`);
  console.log(`type: ${memory.type}`);
  console.log(`address: ${memory.street} ${memory.houseNumber}, ${memory.postcode} ${memory.city}`);
  console.log(`livingArea: ${memory.livingArea}`);
  console.log(`rooms: ${memory.rooms}`);
  console.log(`bathrooms: ${memory.bathrooms}`);
  console.log(`floor: ${memory.floor}`);
  console.log(`yearBuilt: ${memory.yearBuilt}`);
  console.log(`condition: ${memory.condition}`);
  console.log(`attributes: ${memory.attributes.join(", ")}`);
  console.log(`energy: ${memory.energyClass} ${memory.energyValue} ${memory.energySource}`);
  console.log(`askingPrice: ${memory.askingPrice}`);
  console.log(`photos: ${memory.uploads.filter((u) => u.kind === "PHOTO").length}`);

  // Upload 6 photos
  console.log(`\n── Uploading 6 Photos ──`);
  const photoDir = path.join(process.cwd(), "public", "uploads", "cmojjb6jj0027j0iw38kjgdtl");
  const jpgFiles = (await readFile(photoDir).catch(() => null),
    (await import("fs")).readdirSync(photoDir))
    .filter((f: string) => f.toLowerCase().endsWith(".jpg"))
    .slice(0, 6);

  for (let i = 0; i < jpgFiles.length; i++) {
    await uploadPhoto(conversation.id, agentRun.id, path.join(photoDir, jpgFiles[i]), i);
  }

  // Turn 2: Tell agent photos are uploaded
  console.log(`\n── Turn 2: Photos notification ──`);
  const photoMsg = `${jpgFiles.length} Fotos hochgeladen.`;
  await prisma.conversationTurn.create({
    data: { conversationId: conversation.id, role: "USER", content: photoMsg },
  });

  history = await getHistory();
  allTurns = await prisma.conversationTurn.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
  });
  memory = rebuildMemory(allTurns);

  const result2 = await runAgentTurn({ ...ctx, startingCostCents: totalCost }, memory, history, photoMsg);
  totalCost += result2.costCentsThisTurn;
  await prisma.agentRun.update({ where: { id: agentRun.id }, data: { costCents: totalCost } });
  await prisma.conversationTurn.create({
    data: { conversationId: conversation.id, role: "AGENT", content: result2.agentMessage },
  });

  console.log(`Agent: ${result2.agentMessage.slice(0, 300)}...`);
  console.log(`Tools: ${result2.toolStepsExecuted}, Cost: ${result2.costCentsThisTurn}c, Total: ${totalCost}c`);
  console.log(`Finished: ${result2.finished}`);

  // Check final state
  allTurns = await prisma.conversationTurn.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
  });
  memory = rebuildMemory(allTurns);

  console.log(`\n── Final State ──`);
  console.log(`Phase: ${memory.phase}`);
  console.log(`Draft: ${memory.draft ? "YES" : "NO"}`);
  if (memory.draft) {
    console.log(`Title: ${memory.draft.titleShort}`);
    console.log(`Headline: ${memory.draft.exposeHeadline}`);
    console.log(`Description (${memory.draft.descriptionLong.split(/\s+/).filter(Boolean).length} words):`);
    console.log(memory.draft.descriptionLong);
    console.log(`Highlights: ${JSON.stringify(memory.draft.highlights)}`);
  }
  console.log(`Rubric: ${memory.lastRubric ? (memory.lastRubric.passed ? "PASSED" : `FAILED: ${memory.lastRubric.failures.join(" | ")}`) : "NOT RUN"}`);
  console.log(`Price band: ${memory.priceBand ? `${memory.priceBand.low}-${memory.priceBand.high}` : "NONE"}`);
  console.log(`Asking price: ${memory.askingPrice}`);

  // Continue conversation until draft + rubric or 5 more turns
  async function sendFollowUp(msg: string, turnLabel: string) {
    console.log(`\n── ${turnLabel} ──`);
    console.log(`User: ${msg}`);
    await prisma.conversationTurn.create({ data: { conversationId: conversation.id, role: "USER", content: msg } });
    history = await getHistory();
    allTurns = await prisma.conversationTurn.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: "asc" } });
    memory = rebuildMemory(allTurns);
    const r = await runAgentTurn({ ...ctx, startingCostCents: totalCost }, memory, history, msg);
    totalCost += r.costCentsThisTurn;
    await prisma.agentRun.update({ where: { id: agentRun.id }, data: { costCents: totalCost } });
    await prisma.conversationTurn.create({ data: { conversationId: conversation.id, role: "AGENT", content: r.agentMessage } });
    console.log(`Agent: ${r.agentMessage.slice(0, 400)}...`);
    console.log(`Tools: ${r.toolStepsExecuted}, Cost: ${r.costCentsThisTurn}c, Total: ${totalCost}c, Finished: ${r.finished}`);
    allTurns = await prisma.conversationTurn.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: "asc" } });
    memory = rebuildMemory(allTurns);
    return r;
  }

  if (!result2.finished) {
    // Turn 3: provide price and skip floor plan
    let r = await sendFollowUp("Keinen Grundriss. Mein Preis ist 195.000 Euro.", "Turn 3");

    // Up to 3 more turns to reach completion
    for (let i = 4; i <= 6 && !r.finished; i++) {
      allTurns = await prisma.conversationTurn.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: "asc" } });
      memory = rebuildMemory(allTurns);

      if (memory.lastRubric && !memory.lastRubric.passed) {
        r = await sendFollowUp("Ja, bitte den Text anpassen.", `Turn ${i}`);
      } else if (memory.draft) {
        r = await sendFollowUp("Ja, das Inserat erstellen.", `Turn ${i}`);
      } else {
        r = await sendFollowUp("Bitte Exposé erstellen.", `Turn ${i}`);
      }
    }
  }

  console.log(`\n═══ SUMMARY ═══`);
  const finalTurns = await prisma.conversationTurn.findMany({ where: { conversationId: conversation.id } });
  console.log(`Conversation ID: ${conversation.id}`);
  console.log(`Total turns: ${finalTurns.length}`);
  console.log(`Total cost: ${totalCost}c (€${(totalCost / 100).toFixed(2)})`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
