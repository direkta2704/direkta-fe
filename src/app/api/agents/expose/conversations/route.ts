import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { INITIAL_MEMORY, generateInitialGreeting, MAX_COST_CENTS } from "@/lib/expose-agent";

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

    // Close any existing ACTIVE conversations for this user
    await prisma.conversation.updateMany({
      where: { userId: user.id, agentKind: "EXPOSE", status: "ACTIVE" },
      data: { status: "COMPLETED", closedAt: new Date() },
    });

    const conversation = await prisma.conversation.create({
      data: {
        userId: user.id,
        agentKind: "EXPOSE",
        status: "ACTIVE",
      },
    });

    // Create the AgentRun audit container (Lastenheft §10.5)
    const agentRun = await prisma.agentRun.create({
      data: {
        agentKind: "EXPOSE",
        conversationId: conversation.id,
        goal: "Produce a publication-ready Exposé through conversational dialog",
        status: "RUNNING",
        costCents: 0,
      },
    });

    // Generate initial greeting via the LLM (also persisted as the first AgentStep)
    let greeting = "Willkommen beim Direkta Exposé-Assistenten. Welchen Immobilientyp möchten Sie verkaufen?";
    let greetingCostCents = 0;
    try {
      const r = await generateInitialGreeting({
        conversationId: conversation.id,
        agentRunId: agentRun.id,
        userId: user.id,
        startingCostCents: 0,
      });
      greeting = r.message;
      greetingCostCents = r.costCents;
    } catch (e) {
      console.error("Greeting generation failed:", e);
    }

    await prisma.agentRun.update({
      where: { id: agentRun.id },
      data: { costCents: greetingCostCents },
    });

    await prisma.conversationTurn.create({
      data: {
        conversationId: conversation.id,
        role: "AGENT",
        content: greeting,
      },
    });

    return NextResponse.json(
      {
        id: conversation.id,
        status: conversation.status,
        memory: INITIAL_MEMORY,
        turns: [{ role: "AGENT", content: greeting, createdAt: new Date() }],
        costCents: greetingCostCents,
        maxCostCents: MAX_COST_CENTS,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("Create conversation error:", err);
    return NextResponse.json({ error: "Konversation konnte nicht gestartet werden" }, { status: 500 });
  }
}
