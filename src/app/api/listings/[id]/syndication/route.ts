import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { getDriver } from "@/lib/portal-driver";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;
    void req;

    const listing = await prisma.listing.findFirst({
      where: { id, property: { userId: user.id } },
    });

    if (!listing) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    const targets = await prisma.syndicationTarget.findMany({
      where: { listingId: id },
      include: {
        jobs: { orderBy: { scheduledFor: "desc" }, take: 5 },
        stats: { orderBy: { date: "desc" }, take: 30 },
      },
    });

    return NextResponse.json(targets);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;
    const body = await req.json();
    const portal = body.portal || "IMMOSCOUT24";

    const listing = await prisma.listing.findFirst({
      where: { id, property: { userId: user.id }, status: "ACTIVE" },
      include: {
        property: {
          include: {
            energyCert: true,
            media: { where: { kind: "PHOTO" }, orderBy: { ordering: "asc" } },
            user: { select: { name: true, email: true, phone: true } },
          },
        },
      },
    });

    if (!listing) {
      return NextResponse.json({ error: "Inserat nicht gefunden oder nicht aktiv" }, { status: 404 });
    }

    const credential = await prisma.portalCredential.findFirst({
      where: { userId: user.id, portal, status: "ACTIVE" },
    });

    if (!credential) {
      return NextResponse.json({ error: "Keine aktiven Zugangsdaten für dieses Portal" }, { status: 400 });
    }

    // Check 90-day reconfirmation
    const daysSinceConsent = (Date.now() - credential.consentedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceConsent > 90 && !credential.reconfirmedAt) {
      return NextResponse.json({ error: "Bitte bestätigen Sie Ihre Zugangsdaten erneut (90-Tage-Frist)" }, { status: 403 });
    }

    // Create or get syndication target
    let target = await prisma.syndicationTarget.findUnique({
      where: { listingId_portal: { listingId: id, portal } },
    });

    if (!target) {
      target = await prisma.syndicationTarget.create({
        data: { listingId: id, portal, status: "QUEUED" },
      });
    } else {
      await prisma.syndicationTarget.update({
        where: { id: target.id },
        data: { status: "QUEUED" },
      });
    }

    // Create syndication job
    const job = await prisma.syndicationJob.create({
      data: {
        syndicationTargetId: target.id,
        kind: target.externalListingId ? "UPDATE" : "PUBLISH",
        status: "QUEUED",
      },
    });

    // Execute the job (in MVP, synchronous; production would use a queue)
    try {
      const driver = getDriver(portal);
      const p = listing.property;

      await prisma.syndicationJob.update({
        where: { id: job.id },
        data: { status: "RUNNING", startedAt: new Date() },
      });

      // Pass raw S3 keys — the driver downloads from S3 directly
      const photoKeys = p.media.map((m) => m.storageKey);

      // Split seller name into first/last
      const nameParts = (p.user?.name || "").split(" ");
      const firstName = nameParts[0] || null;
      const lastName = nameParts.slice(1).join(" ") || null;

      const result = await driver.publish({
        title: listing.titleShort || `${p.street} ${p.houseNumber}`,
        description: listing.descriptionLong || "",
        price: listing.askingPrice ? Number(listing.askingPrice) : 0,
        propertyType: p.type,
        livingArea: p.livingArea,
        plotArea: p.plotArea,
        rooms: p.rooms,
        bathrooms: p.bathrooms,
        floor: p.floor,
        yearBuilt: p.yearBuilt,
        condition: p.condition,
        attributes: (p.attributes as string[]) || [],
        city: p.city,
        postcode: p.postcode,
        street: p.street,
        houseNumber: p.houseNumber,
        photos: photoKeys,
        energyClass: p.energyCert?.energyClass || null,
        energyValue: p.energyCert?.energyValue || null,
        energyCertType: p.energyCert?.type || null,
        energyPrimarySource: p.energyCert?.primarySource || null,
        sellerFirstName: firstName,
        sellerLastName: lastName,
        sellerEmail: p.user?.email || null,
        sellerPhone: p.user?.phone || null,
      });

      await prisma.syndicationTarget.update({
        where: { id: target.id },
        data: {
          status: "LIVE",
          externalListingId: result.externalListingId,
          externalUrl: result.externalUrl,
          lastSyncedAt: new Date(),
        },
      });

      await prisma.syndicationJob.update({
        where: { id: job.id },
        data: { status: "SUCCESS", finishedAt: new Date() },
      });

      // Create initial stats
      await prisma.portalStat.create({
        data: {
          syndicationTargetId: target.id,
          date: new Date(),
          impressions: 0,
          detailViews: 0,
          contactRequests: 0,
          bookmarks: 0,
        },
      });

      await prisma.listingEvent.create({
        data: {
          listingId: id,
          type: "SYNDICATED",
          payload: { portal, externalUrl: result.externalUrl },
          actorUserId: user.id,
        },
      });

      return NextResponse.json({
        ok: true,
        externalUrl: result.externalUrl,
        status: "LIVE",
      });
    } catch (err) {
      await prisma.syndicationJob.update({
        where: { id: job.id },
        data: { status: "FAILED", finishedAt: new Date(), lastError: String(err) },
      });

      await prisma.syndicationTarget.update({
        where: { id: target.id },
        data: { status: "FAILED" },
      });

      throw err;
    }
  } catch (err) {
    console.error("Syndication error:", err);
    const message = err instanceof Error ? err.message : "Veröffentlichung fehlgeschlagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
