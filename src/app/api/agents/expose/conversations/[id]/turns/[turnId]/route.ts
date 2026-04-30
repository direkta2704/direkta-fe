import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { rebuildMemory } from "@/lib/expose-agent";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

function asJson<T>(v: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(v ?? null)) as Prisma.InputJsonValue;
}

// PATCH — F-M5-10: seller edits an earlier USER turn. We update the turn
// content and append a SYSTEM correction note so the agent picks up the
// revision on the next turn. Memory revisions propagate downstream because
// the agent re-derives state from the conversation history.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; turnId: string }> },
) {
  try {
    const user = await getRequiredUser();
    const { id, turnId } = await params;
    const body = await req.json();
    const newContent = typeof body.content === "string" ? body.content.trim() : "";
    if (!newContent) return NextResponse.json({ error: "Inhalt erforderlich" }, { status: 400 });

    const conversation = await prisma.conversation.findFirst({
      where: { id, userId: user.id, status: "ACTIVE" },
    });
    if (!conversation) return NextResponse.json({ error: "Konversation nicht gefunden" }, { status: 404 });

    const turn = await prisma.conversationTurn.findFirst({
      where: { id: turnId, conversationId: id, role: "USER" },
    });
    if (!turn) return NextResponse.json({ error: "Nachricht nicht gefunden oder nicht editierbar" }, { status: 404 });

    const oldContent = turn.content;
    if (oldContent === newContent) {
      return NextResponse.json({ ok: true, unchanged: true });
    }

    // Update the user turn
    await prisma.conversationTurn.update({
      where: { id: turnId },
      data: { content: newContent },
    });

    // Append a SYSTEM correction note after the edited turn — the agent will
    // see this on the next turn and integrate the correction.
    await prisma.conversationTurn.create({
      data: {
        conversationId: id,
        role: "SYSTEM",
        content: `[Korrektur] Der Verkäufer hat eine vorherige Antwort geändert. Alt: "${oldContent.slice(0, 200)}". Neu: "${newContent.slice(0, 200)}". Bitte berücksichtige die Änderung und aktualisiere ggf. das Working Memory.`,
        toolName: "user_revision",
        toolOutput: asJson({ turnId, oldContent, newContent }),
      },
    });

    const refreshed = await prisma.conversation.findFirst({
      where: { id },
      include: { turns: { orderBy: { createdAt: "asc" } } },
    });

    return NextResponse.json({
      ok: true,
      memory: rebuildMemory(refreshed?.turns ?? []),
    });
  } catch (err) {
    console.error("Turn edit error:", err);
    return NextResponse.json({ error: "Bearbeitung fehlgeschlagen" }, { status: 500 });
  }
}
