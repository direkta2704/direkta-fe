import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDriver } from "@/lib/portal-driver";

export const dynamic = "force-dynamic";

// Called daily by cron job or manually: GET /api/cron/sync-is24-stats
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const targets = await prisma.syndicationTarget.findMany({
      where: { status: "LIVE", portal: "IMMOSCOUT24", externalListingId: { not: null } },
    });

    let synced = 0;
    let failed = 0;

    const driver = getDriver("IMMOSCOUT24");

    for (const target of targets) {
      try {
        const stats = await driver.fetchStats(target.externalListingId!);
        const today = new Date(new Date().toDateString());

        await prisma.portalStat.upsert({
          where: { syndicationTargetId_date: { syndicationTargetId: target.id, date: today } },
          update: stats,
          create: { syndicationTargetId: target.id, date: today, ...stats },
        });

        await prisma.syndicationTarget.update({
          where: { id: target.id },
          data: { lastSyncedAt: new Date() },
        });

        synced++;
      } catch (e) {
        console.error(`Stats sync failed for ${target.externalListingId}:`, e);
        failed++;
      }
    }

    return NextResponse.json({ ok: true, synced, failed, total: targets.length });
  } catch (err) {
    console.error("Cron sync error:", err);
    return NextResponse.json({ error: "Sync fehlgeschlagen" }, { status: 500 });
  }
}
