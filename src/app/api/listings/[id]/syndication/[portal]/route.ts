import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { getDriver } from "@/lib/portal-driver";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; portal: string }> }
) {
  try {
    const user = await getRequiredUser();
    const { id, portal } = await params;
    const body = await req.json();
    const action = body.action; // "pause" | "withdraw" | "resync"

    const target = await prisma.syndicationTarget.findFirst({
      where: {
        listingId: id,
        portal: portal as "IMMOSCOUT24" | "IMMOWELT" | "KLEINANZEIGEN",
        listing: { property: { userId: user.id } },
      },
    });

    if (!target) {
      return NextResponse.json({ error: "Syndikation nicht gefunden" }, { status: 404 });
    }

    const driver = getDriver(portal);

    if (action === "pause" && target.externalListingId) {
      await driver.pause(target.externalListingId);
      await prisma.syndicationTarget.update({
        where: { id: target.id },
        data: { status: "PAUSED" },
      });
      await prisma.syndicationJob.create({
        data: { syndicationTargetId: target.id, kind: "PAUSE", status: "SUCCESS", finishedAt: new Date() },
      });
    } else if (action === "withdraw" && target.externalListingId) {
      await driver.withdraw(target.externalListingId);
      await prisma.syndicationTarget.update({
        where: { id: target.id },
        data: { status: "WITHDRAWN" },
      });
      await prisma.syndicationJob.create({
        data: { syndicationTargetId: target.id, kind: "WITHDRAW", status: "SUCCESS", finishedAt: new Date() },
      });
    } else if (action === "resync" && target.externalListingId) {
      const stats = await driver.fetchStats(target.externalListingId);
      await prisma.portalStat.upsert({
        where: { syndicationTargetId_date: { syndicationTargetId: target.id, date: new Date(new Date().toDateString()) } },
        update: stats,
        create: { syndicationTargetId: target.id, date: new Date(new Date().toDateString()), ...stats },
      });
      await prisma.syndicationTarget.update({
        where: { id: target.id },
        data: { lastSyncedAt: new Date() },
      });
      await prisma.syndicationJob.create({
        data: { syndicationTargetId: target.id, kind: "SYNC_STATS", status: "SUCCESS", finishedAt: new Date() },
      });

      return NextResponse.json({ ok: true, stats });
    }

    await prisma.listingEvent.create({
      data: {
        listingId: id,
        type: `SYNDICATION_${action?.toUpperCase()}`,
        payload: { portal, action },
        actorUserId: user.id,
      },
    });

    return NextResponse.json({ ok: true, action });
  } catch (err) {
    console.error("Syndication action error:", err);
    return NextResponse.json({ error: "Aktion fehlgeschlagen" }, { status: 500 });
  }
}
