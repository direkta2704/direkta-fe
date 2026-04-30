import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredAdmin } from "@/lib/session";
import { auditAgentTurn, summarizeAudit, type ConversationAuditEntry } from "@/lib/agent-audits";

export const dynamic = "force-dynamic";

// GET /api/admin/agent-audit?windowDays=7
// F-M5-03: scans agent turns for multi-question violations.
export async function GET(req: Request) {
  try {
    await getRequiredAdmin();

    const url = new URL(req.url);
    const windowDays = Math.max(1, Math.min(90, Number(url.searchParams.get("windowDays") ?? "7")));
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const turns = await prisma.conversationTurn.findMany({
      where: { role: "AGENT", createdAt: { gte: since } },
      select: { id: true, conversationId: true, createdAt: true, content: true },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    const entries: ConversationAuditEntry[] = turns.map((t) => ({
      turnId: t.id,
      conversationId: t.conversationId,
      createdAt: t.createdAt.toISOString(),
      content: (t.content || "").replace(/###MEMORY###[\s\S]*?###END###/g, "").trim(),
      audit: auditAgentTurn((t.content || "").replace(/###MEMORY###[\s\S]*?###END###/g, "").trim()),
    }));

    return NextResponse.json({
      windowDays,
      since: since.toISOString(),
      ...summarizeAudit(entries),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fehler";
    if (msg.includes("Admin")) return NextResponse.json({ error: msg }, { status: 403 });
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}
