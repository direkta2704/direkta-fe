import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { getDriver } from "@/lib/portal-driver";
import { isCircuitOpen, recordSuccess, recordFailure } from "@/lib/circuit-breaker";
import { sendSyndicationFailureEmail } from "@/lib/email";

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
      where: { id, property: { userId: user.id } },
      include: {
        property: {
          include: {
            energyCert: true,
            media: { where: { kind: { in: ["PHOTO", "FLOORPLAN"] } }, orderBy: { ordering: "asc" } },
            user: { select: { name: true, email: true, phone: true } },
          },
        },
      },
    });

    if (!listing) {
      return NextResponse.json({ error: "Inserat nicht gefunden" }, { status: 404 });
    }

    if (listing.status !== "ACTIVE") {
      return NextResponse.json({ error: `Inserat ist nicht aktiv (Status: ${listing.status})` }, { status: 422 });
    }

    const credential = await prisma.portalCredential.findFirst({
      where: { userId: user.id, portal, status: "ACTIVE" },
    });

    if (!credential) {
      return NextResponse.json({ error: "Keine aktiven Zugangsdaten für dieses Portal" }, { status: 400 });
    }

    // F-M6-14: Check 90-day reconfirmation — use the most recent confirmation date
    const lastConfirmed = credential.reconfirmedAt || credential.consentedAt;
    const daysSinceConfirm = (Date.now() - lastConfirmed.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceConfirm > 90) {
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

    // Circuit breaker check
    if (isCircuitOpen(portal)) {
      return NextResponse.json({
        error: "Portal-Synchronisation ist vorübergehend pausiert (zu viele Fehler). Bitte versuchen Sie es in 15 Minuten erneut.",
      }, { status: 503 });
    }

    // Execute the job (in MVP, synchronous; production would use a queue)
    try {
      const driver = getDriver(portal);
      const p = listing.property;

      await prisma.syndicationJob.update({
        where: { id: job.id },
        data: { status: "RUNNING", startedAt: new Date() },
      });

      // Pass raw S3 keys — tag floor plans so driver can distinguish
      const photoKeys = p.media.map((m) =>
        m.kind === "FLOORPLAN" ? `floorplan:${m.storageKey}` : m.storageKey
      );

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
      recordSuccess(portal);

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
      recordFailure(portal);

      await prisma.syndicationTarget.update({
        where: { id: target.id },
        data: { status: "FAILED" },
      });

      // F-M6-04: Detect Captcha/MFA/layout failures and notify seller
      const errMsg = String(err).toLowerCase();
      const isCaptchaMfa = errMsg.includes("captcha") || errMsg.includes("mfa") || errMsg.includes("two-factor") || errMsg.includes("challenge") || errMsg.includes("verification");
      const isLayoutChange = errMsg.includes("selector") || errMsg.includes("not found") || errMsg.includes("timeout") || errMsg.includes("navigation");

      try {
        const sellerEmail = listing.property.user?.email;
        if (sellerEmail) {
          await sendSyndicationFailureEmail(sellerEmail, {
            portal,
            propertyAddress: `${listing.property.street} ${listing.property.houseNumber}, ${listing.property.city}`,
            errorType: isCaptchaMfa ? "captcha_mfa" : isLayoutChange ? "layout_change" : "unknown",
            errorMessage: err instanceof Error ? err.message : String(err),
          });
        }
      } catch (emailErr) {
        console.error("Failed to send syndication failure email:", emailErr);
      }

      throw err;
    }
  } catch (err) {
    console.error("Syndication error:", err);
    const message = err instanceof Error ? err.message : "Veröffentlichung fehlgeschlagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
