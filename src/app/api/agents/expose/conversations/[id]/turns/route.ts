import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import {
  rebuildMemory,
  runAgentTurn,
  MAX_TURNS,
  MAX_COST_CENTS,
} from "@/lib/expose-agent";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;
    const body = await req.json();
    const userMessage = typeof body.content === "string" ? body.content.trim() : "";

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

    // F-M5-02: 24h resume cutoff
    const ageMs = Date.now() - new Date(conversation.startedAt).getTime();
    if (ageMs > 24 * 60 * 60 * 1000) {
      await prisma.conversation.update({
        where: { id },
        data: { status: "ABANDONED", closedAt: new Date() },
      });
      return NextResponse.json({ error: "Diese Konversation ist älter als 24 Stunden und wurde geschlossen. Bitte starten Sie eine neue." }, { status: 410 });
    }

    // Hard cap: count only USER+AGENT turns toward MAX_TURNS, not TOOL/SYSTEM bookkeeping
    const userVisibleTurns = conversation.turns.filter((t) => t.role === "USER" || t.role === "AGENT").length;
    if (userVisibleTurns >= MAX_TURNS * 2) {
      // MAX_TURNS=60 means up to 60 user turns + 60 agent turns; flag for human review
      await prisma.agentRun.updateMany({
        where: { conversationId: id, status: "RUNNING" },
        data: { status: "FAILED", error: "MAX_TURNS exceeded — human review required", finishedAt: new Date() },
      });
      return NextResponse.json({ error: "Maximale Gesprächslänge erreicht. Bitte verwenden Sie das Formular oder kontaktieren Sie den Support." }, { status: 400 });
    }

    const agentRun = await prisma.agentRun.findFirst({
      where: { conversationId: id, agentKind: "EXPOSE" },
      orderBy: { startedAt: "desc" },
    });
    if (!agentRun) {
      return NextResponse.json({ error: "AgentRun nicht gefunden" }, { status: 500 });
    }
    if (agentRun.status !== "RUNNING") {
      return NextResponse.json({ error: "AgentRun ist nicht aktiv" }, { status: 400 });
    }

    // Cost cap pre-check
    const startingCost = agentRun.costCents ?? 0;
    if (startingCost >= MAX_COST_CENTS) {
      return NextResponse.json({ error: "Kostenobergrenze erreicht. Bitte das Formular verwenden." }, { status: 402 });
    }

    // Rebuild memory from persisted turns
    const memory = rebuildMemory(conversation.turns);

    // Build chat history for LLM (excluding TOOL turns; those are reflected in memory snapshot)
    const history = conversation.turns
      .filter((t) => t.role === "USER" || t.role === "AGENT" || t.role === "SYSTEM")
      .map((t) => ({
        role: t.role === "AGENT" ? ("assistant" as const) : t.role === "SYSTEM" ? ("system" as const) : ("user" as const),
        content: (t.content || "").replace(/###MEMORY###[\s\S]*?###END###/g, "").trim(),
      }));

    // Persist the user turn first
    const userTurn = await prisma.conversationTurn.create({
      data: { conversationId: id, role: "USER", content: userMessage },
    });

    const startTime = Date.now();
    const result = await runAgentTurn(
      {
        conversationId: id,
        agentRunId: agentRun.id,
        userId: user.id,
        startingCostCents: startingCost,
      },
      memory,
      history,
      userMessage,
    );
    const latencyMs = Date.now() - startTime;

    // Persist the agent's user-facing turn
    const agentTurn = await prisma.conversationTurn.create({
      data: {
        conversationId: id,
        role: "AGENT",
        content: result.agentMessage || "(keine Antwort)",
        latencyMs,
        toolOutput: JSON.parse(JSON.stringify({ costCentsThisTurn: result.costCentsThisTurn, toolStepsExecuted: result.toolStepsExecuted })),
      },
    });

    // Update AgentRun cost
    await prisma.agentRun.update({
      where: { id: agentRun.id },
      data: { costCents: result.costCentsTotal },
    });

    // Auto-handoff if agent committed
    let listingId: string | null = null;
    if (result.finished) {
      const handoffRes = await fetch(new URL(`/api/agents/expose/conversations/${id}/handoff`, req.url), {
        method: "POST",
        headers: { cookie: req.headers.get("cookie") || "" },
      });
      if (handoffRes.ok) {
        const data = await handoffRes.json();
        listingId = data.listingId;
      }
    }

    // Abort run if cost cap or max iterations
    if (result.abortedReason === "cost_cap") {
      await prisma.agentRun.update({
        where: { id: agentRun.id },
        data: { status: "FAILED", error: "MAX_COST_CENTS exceeded", finishedAt: new Date() },
      });
    }

    return NextResponse.json({
      role: "AGENT",
      content: result.agentMessage,
      memory: result.memory,
      finished: result.finished,
      listingId,
      costCents: result.costCentsTotal,
      maxCostCents: MAX_COST_CENTS,
      abortedReason: result.abortedReason,
      userTurnId: userTurn.id,
      agentTurnId: agentTurn.id,
    });
  } catch (err) {
    console.error("Turn error:", err);
    const message = err instanceof Error ? err.message : "Fehler bei der Verarbeitung";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
