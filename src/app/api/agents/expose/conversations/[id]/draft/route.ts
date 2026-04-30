import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { rebuildMemory, runRubric } from "@/lib/expose-agent";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

function asJson<T>(v: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(v ?? null)) as Prisma.InputJsonValue;
}

// PATCH — seller-edited draft. Updates titleShort/descriptionLong/askingPrice in
// working memory via a SYSTEM turn carrying a memoryPatch, then re-runs the
// quality rubric and persists the new result.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;
    const body = await req.json();

    const conversation = await prisma.conversation.findFirst({
      where: { id, userId: user.id, status: "ACTIVE" },
      include: { turns: { orderBy: { createdAt: "asc" } } },
    });
    if (!conversation) return NextResponse.json({ error: "Konversation nicht gefunden" }, { status: 404 });

    const agentRun = await prisma.agentRun.findFirst({
      where: { conversationId: id, agentKind: "EXPOSE" },
      orderBy: { startedAt: "desc" },
    });
    if (!agentRun) return NextResponse.json({ error: "AgentRun nicht gefunden" }, { status: 500 });

    const memory = rebuildMemory(conversation.turns);
    if (!memory.draft) return NextResponse.json({ error: "Kein Entwurf vorhanden" }, { status: 400 });

    const titleShort = typeof body.titleShort === "string" ? body.titleShort.trim().slice(0, 160) : memory.draft.titleShort;
    const descriptionLong = typeof body.descriptionLong === "string" ? body.descriptionLong.trim() : memory.draft.descriptionLong;
    const askingPrice = typeof body.askingPrice === "number" ? body.askingPrice : memory.askingPrice;
    const priceOverride = typeof body.priceOverride === "boolean" ? body.priceOverride : memory.priceOverride;

    const patch = {
      draft: { titleShort, descriptionLong },
      askingPrice,
      priceOverride,
    };

    await prisma.conversationTurn.create({
      data: {
        conversationId: id,
        role: "SYSTEM",
        content: "[Edit] Verkäufer hat Entwurf bearbeitet",
        toolName: "draft_edit",
        toolOutput: asJson({ memoryPatch: patch }),
      },
    });

    // Re-run rubric on edited draft
    const refreshed = await prisma.conversation.findFirst({
      where: { id },
      include: { turns: { orderBy: { createdAt: "asc" } } },
    });
    const newMemory = rebuildMemory(refreshed?.turns ?? []);
    const r = await runRubric(newMemory);

    const lastOrdinal = await prisma.agentStep.findFirst({
      where: { agentRunId: agentRun.id },
      orderBy: { ordinal: "desc" },
      select: { ordinal: true },
    });
    await prisma.agentStep.create({
      data: {
        agentRunId: agentRun.id,
        ordinal: (lastOrdinal?.ordinal ?? -1) + 1,
        toolName: "listing_review",
        input: asJson({ source: "seller_edit" }),
        output: asJson({ passed: r.result.passed, failures: r.result.failures, details: r.result.details }),
        latencyMs: 0,
        ok: true,
      },
    });

    await prisma.conversationTurn.create({
      data: {
        conversationId: id,
        role: "TOOL",
        content: "listing_review",
        toolName: "listing_review",
        toolOutput: asJson({
          passed: r.result.passed,
          failures: r.result.failures,
          details: r.result.details,
          memoryPatch: { lastRubric: r.result, handoffReady: r.result.passed },
        }),
        latencyMs: 0,
      },
    });

    await prisma.agentRun.update({
      where: { id: agentRun.id },
      data: { costCents: { increment: r.costCents } },
    });

    const finalRefresh = await prisma.conversation.findFirst({
      where: { id },
      include: { turns: { orderBy: { createdAt: "asc" } } },
    });
    return NextResponse.json({
      ok: true,
      memory: rebuildMemory(finalRefresh?.turns ?? []),
      rubric: r.result,
    });
  } catch (err) {
    console.error("Draft edit error:", err);
    return NextResponse.json({ error: "Bearbeitung fehlgeschlagen" }, { status: 500 });
  }
}
