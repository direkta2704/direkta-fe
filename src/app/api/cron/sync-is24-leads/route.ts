import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDriver } from "@/lib/portal-driver";
import { calculateLeadScore } from "@/lib/lead-scoring";

export const dynamic = "force-dynamic";

// Called daily by cron job: GET /api/cron/sync-is24-leads
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const targets = await prisma.syndicationTarget.findMany({
      where: { status: "LIVE", portal: "IMMOSCOUT24", externalListingId: { not: null } },
      include: { listing: { select: { id: true, askingPrice: true } } },
    });

    let ingested = 0;
    let duplicates = 0;

    const driver = getDriver("IMMOSCOUT24");

    for (const target of targets) {
      try {
        const leads = await driver.fetchLeads(target.externalListingId!);

        for (const lead of leads) {
          const normalizedEmail = lead.email.toLowerCase().trim();

          // Deduplicate by email per listing (F-M6-09)
          const existing = await prisma.lead.findFirst({
            where: { listingId: target.listing.id, emailRaw: normalizedEmail },
          });

          if (existing) {
            duplicates++;
            continue;
          }

          const askingPrice = target.listing.askingPrice ? Number(target.listing.askingPrice) : 0;
          const score = calculateLeadScore({
            financingState: null,
            timing: null,
            budget: null,
            phone: lead.phone || null,
            message: lead.message || null,
            askingPrice,
          });

          await prisma.lead.create({
            data: {
              listingId: target.listing.id,
              emailRaw: normalizedEmail,
              name: lead.name || null,
              phone: lead.phone || null,
              message: lead.message || null,
              qualityScore: score,
              status: "NEW",
              source: "is24",
            },
          });

          ingested++;
        }
      } catch (e) {
        console.error(`Lead sync failed for ${target.externalListingId}:`, e);
      }
    }

    return NextResponse.json({ ok: true, ingested, duplicates, total: targets.length });
  } catch (err) {
    console.error("Lead sync error:", err);
    return NextResponse.json({ error: "Sync fehlgeschlagen" }, { status: 500 });
  }
}
