import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { INITIAL_MEMORY, applyExtracted, type WorkingMemory } from "@/lib/expose-agent";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
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

    // Rebuild working memory from turns
    let memory: WorkingMemory = { ...INITIAL_MEMORY };
    for (const turn of conversation.turns) {
      if (turn.toolOutput && typeof turn.toolOutput === "object") {
        memory = applyExtracted(memory, turn.toolOutput as Record<string, unknown>);
      }
    }

    return NextResponse.json({
      id: conversation.id,
      status: conversation.status,
      listingId: conversation.listingId,
      memory,
      turns: conversation.turns.map((t) => ({
        id: t.id,
        role: t.role,
        content: t.content,
        createdAt: t.createdAt,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}
