import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

// GET /api/admin/agent-stats?windowDays=7
// Computes M5 latency SLOs (F-M5-01) over agent turns in the time window.
export async function GET(req: Request) {
  try {
    await getRequiredAdmin();

    const url = new URL(req.url);
    const windowDays = Math.max(1, Math.min(90, Number(url.searchParams.get("windowDays") ?? "7")));
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const [agentTurns, conversations, agentRuns] = await Promise.all([
      prisma.conversationTurn.findMany({
        where: { role: "AGENT", createdAt: { gte: since }, latencyMs: { not: null } },
        select: { latencyMs: true },
      }),
      prisma.conversation.findMany({
        where: { agentKind: "EXPOSE", startedAt: { gte: since } },
        select: { id: true, status: true, listingId: true, startedAt: true, closedAt: true },
      }),
      prisma.agentRun.findMany({
        where: { agentKind: "EXPOSE", startedAt: { gte: since } },
        select: { id: true, status: true, costCents: true, conversationId: true, startedAt: true, finishedAt: true },
      }),
    ]);

    const latencies = agentTurns
      .map((t) => t.latencyMs ?? 0)
      .filter((n) => n > 0)
      .sort((a, b) => a - b);

    const conversationsCount = conversations.length;
    const completed = conversations.filter((c) => c.status === "COMPLETED").length;
    const abandoned = conversations.filter((c) => c.status === "ABANDONED").length;
    const failedRuns = agentRuns.filter((r) => r.status === "FAILED").length;
    const succeededRuns = agentRuns.filter((r) => r.status === "SUCCEEDED").length;

    const totalCostCents = agentRuns.reduce((s, r) => s + (r.costCents ?? 0), 0);
    const avgCostCents = agentRuns.length > 0 ? Math.round(totalCostCents / agentRuns.length) : 0;

    return NextResponse.json({
      windowDays,
      since: since.toISOString(),
      latencyMs: {
        samples: latencies.length,
        p50: percentile(latencies, 0.5),
        p95: percentile(latencies, 0.95),
        p99: percentile(latencies, 0.99),
        max: latencies[latencies.length - 1] ?? 0,
        mean: latencies.length > 0 ? Math.round(latencies.reduce((s, n) => s + n, 0) / latencies.length) : 0,
        // F-M5-01 SLOs from §6.6: P95 < 5000 mocked, < 12000 live
        sloLiveP95Ms: 12000,
        sloMockedP95Ms: 5000,
        slaPass: latencies.length === 0 ? null : percentile(latencies, 0.95) < 12000,
      },
      conversations: {
        total: conversationsCount,
        completed,
        abandoned,
        active: conversationsCount - completed - abandoned,
        completionRatePct: conversationsCount > 0 ? Math.round((completed / conversationsCount) * 100) : 0,
      },
      runs: {
        total: agentRuns.length,
        succeeded: succeededRuns,
        failed: failedRuns,
        avgCostCents,
        totalCostCents,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fehler";
    if (msg.includes("Admin")) return NextResponse.json({ error: msg }, { status: 403 });
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}
