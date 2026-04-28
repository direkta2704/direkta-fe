import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { INITIAL_MEMORY, buildPrompt, callAgent, extractData, applyExtracted, type WorkingMemory } from "@/lib/expose-agent";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;
    const body = await req.json();
    const userMessage = body.content;

    if (!userMessage) {
      return NextResponse.json({ error: "Nachricht erforderlich" }, { status: 400 });
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id, userId: user.id, status: "ACTIVE" },
      include: { turns: { orderBy: { createdAt: "asc" } } },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Konversation nicht gefunden oder beendet" }, { status: 404 });
    }

    // Check max turns
    if (conversation.turns.length >= 120) {
      return NextResponse.json({ error: "Maximale Anzahl an Nachrichten erreicht" }, { status: 400 });
    }

    // Rebuild memory
    let memory: WorkingMemory = { ...INITIAL_MEMORY };
    for (const turn of conversation.turns) {
      if (turn.toolOutput && typeof turn.toolOutput === "object") {
        memory = applyExtracted(memory, turn.toolOutput as Record<string, unknown>);
      }
    }

    // Save user turn
    await prisma.conversationTurn.create({
      data: {
        conversationId: id,
        role: "USER",
        content: userMessage,
      },
    });

    // Build conversation history for LLM
    const history = [
      ...conversation.turns.map((t) => ({
        role: t.role === "AGENT" ? "assistant" : "user",
        content: t.content,
      })),
      { role: "user", content: userMessage },
    ];

    const messages = buildPrompt(memory, history);
    const startTime = Date.now();
    const agentResponse = await callAgent(messages);
    const latencyMs = Date.now() - startTime;

    const { cleanMessage, extracted } = extractData(agentResponse);

    // Apply extracted data to memory
    if (extracted) {
      memory = applyExtracted(memory, extracted);
    }

    // Save agent turn with extracted data
    await prisma.conversationTurn.create({
      data: {
        conversationId: id,
        role: "AGENT",
        content: cleanMessage,
        toolOutput: extracted ? JSON.parse(JSON.stringify(extracted)) : undefined,
        latencyMs,
      },
    });

    return NextResponse.json({
      role: "AGENT",
      content: cleanMessage,
      memory,
      extracted,
    });
  } catch (err) {
    console.error("Turn error:", err);
    const message = err instanceof Error ? err.message : "Fehler bei der Verarbeitung";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
