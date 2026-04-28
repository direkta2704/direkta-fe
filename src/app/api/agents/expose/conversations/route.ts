import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { INITIAL_MEMORY, buildPrompt, callAgent, extractData, applyExtracted } from "@/lib/expose-agent";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getRequiredUser();
    const conversations = await prisma.conversation.findMany({
      where: { userId: user.id, agentKind: "EXPOSE" },
      orderBy: { startedAt: "desc" },
      select: { id: true, status: true, startedAt: true, closedAt: true, listingId: true },
    });
    return NextResponse.json(conversations);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getRequiredUser();
    void req;

    const conversation = await prisma.conversation.create({
      data: {
        userId: user.id,
        agentKind: "EXPOSE",
        status: "ACTIVE",
      },
    });

    // Generate initial greeting
    const memory = INITIAL_MEMORY;
    const messages = buildPrompt(memory, []);
    const agentResponse = await callAgent(messages);
    const { cleanMessage } = extractData(agentResponse);

    // Save agent greeting turn
    await prisma.conversationTurn.create({
      data: {
        conversationId: conversation.id,
        role: "AGENT",
        content: cleanMessage,
      },
    });

    return NextResponse.json({
      id: conversation.id,
      status: conversation.status,
      memory,
      turns: [{ role: "AGENT", content: cleanMessage, createdAt: new Date() }],
    }, { status: 201 });
  } catch (err) {
    console.error("Create conversation error:", err);
    return NextResponse.json({ error: "Konversation konnte nicht gestartet werden" }, { status: 500 });
  }
}
