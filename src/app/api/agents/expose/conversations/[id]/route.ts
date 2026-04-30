import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { rebuildMemory, MAX_COST_CENTS, MAX_TURNS } from "@/lib/expose-agent";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;
    void req;

    const conversation = await prisma.conversation.findFirst({
      where: { id, userId: user.id },
      include: {
        turns: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    const memory = rebuildMemory(conversation.turns);

    const agentRun = await prisma.agentRun.findFirst({
      where: { conversationId: id, agentKind: "EXPOSE" },
      orderBy: { startedAt: "desc" },
      select: { id: true, costCents: true, status: true },
    });

    // Hide tool & internal-system turns from the chat view
    const visibleTurns = conversation.turns.filter((t) => t.role === "USER" || t.role === "AGENT" || t.role === "SYSTEM");

    return NextResponse.json({
      id: conversation.id,
      status: conversation.status,
      listingId: conversation.listingId,
      memory,
      turns: visibleTurns.map((t) => ({
        id: t.id,
        role: t.role,
        content: (t.content || "").replace(/###MEMORY###[\s\S]*?###END###/g, "").trim(),
        createdAt: t.createdAt,
      })),
      costCents: agentRun?.costCents ?? 0,
      maxCostCents: MAX_COST_CENTS,
      maxTurns: MAX_TURNS,
      agentRunStatus: agentRun?.status ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}
