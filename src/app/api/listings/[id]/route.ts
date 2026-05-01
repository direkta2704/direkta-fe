import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;

    const listing = await prisma.listing.findFirst({
      where: { id, property: { userId: user.id } },
      include: {
        property: { include: { energyCert: true, media: { orderBy: { ordering: "asc" } } } },
        priceRecommendation: { include: { comparables: true } },
        leads: { orderBy: { qualityScore: "desc" } },
        offers: { orderBy: { scoreComposite: "desc" } },
        events: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });

    if (!listing) {
      return NextResponse.json({ error: "Inserat nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json(listing);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.listing.findFirst({
      where: { id, property: { userId: user.id } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Inserat nicht gefunden" }, { status: 404 });
    }

    // Hard compliance block: cannot publish without energy cert + 6 photos + description + price
    if (body.status === "ACTIVE" && existing.status !== "ACTIVE") {
      const property = await prisma.property.findFirst({
        where: { id: existing.propertyId },
        include: {
          energyCert: { select: { id: true } },
          _count: { select: { media: { where: { kind: "PHOTO" } } } },
        },
      });

      const violations: string[] = [];
      if (!property?.energyCert) violations.push("Energieausweis fehlt");
      if ((property?._count.media || 0) < 6) violations.push(`Mindestens 6 Fotos erforderlich (aktuell: ${property?._count.media || 0})`);
      if (!existing.descriptionLong && !body.descriptionLong) violations.push("Beschreibung fehlt");
      if (!existing.askingPrice && !body.askingPrice) violations.push("Angebotspreis fehlt");

      if (violations.length > 0) {
        return NextResponse.json(
          { error: `Veröffentlichung nicht möglich: ${violations.join(", ")}` },
          { status: 400 }
        );
      }
    }

    const listing = await prisma.listing.update({
      where: { id },
      data: {
        titleShort: body.titleShort ?? existing.titleShort,
        descriptionLong: body.descriptionLong ?? existing.descriptionLong,
        askingPrice: body.askingPrice ?? existing.askingPrice,
        status: body.status ?? existing.status,
        publishedAt: body.status === "ACTIVE" && !existing.publishedAt ? new Date() : existing.publishedAt,
        pausedAt: body.status === "PAUSED" ? new Date() : existing.pausedAt,
        closedAt: body.status === "CLOSED" ? new Date() : existing.closedAt,
      },
    });

    if (body.status && body.status !== existing.status) {
      await prisma.listingEvent.create({
        data: {
          listingId: id,
          type: `STATUS_CHANGED`,
          payload: { from: existing.status, to: body.status },
          actorUserId: user.id,
        },
      });

      // Auto-withdraw: when one selling path closes, withdraw the other
      console.log("[AUTO-WITHDRAW] Status changed to:", body.status, "for listing:", id);
      if (body.status === "RESERVED" || body.status === "CLOSED") {
        console.log("[AUTO-WITHDRAW] Checking auto-withdraw logic...");
        const property = await prisma.property.findUnique({
          where: { id: existing.propertyId },
          include: { parent: true },
        });

        if (property) {
          const isChildUnit = !!property.parentId;
          const parentId = isChildUnit ? property.parentId! : property.id;

          // Get the selling mode
          const parentProp = isChildUnit
            ? await prisma.property.findUnique({ where: { id: parentId } })
            : property;
          const buildingInfo = parentProp?.buildingInfo as Record<string, string> | null;
          const sellingMode = buildingInfo?._sellingMode;

          if (sellingMode === "BOTH") {
            if (!isChildUnit) {
              // PACKAGE listing was reserved/closed → withdraw all individual unit listings
              const units = await prisma.property.findMany({ where: { parentId: parentId } });
              for (const unit of units) {
                await prisma.listing.updateMany({
                  where: { propertyId: unit.id, status: { in: ["ACTIVE", "DRAFT", "REVIEW"] } },
                  data: { status: "WITHDRAWN", closedAt: new Date() },
                });
              }
              await prisma.listingEvent.create({
                data: {
                  listingId: id,
                  type: "AUTO_WITHDRAW",
                  payload: { reason: "Paketverkauf abgeschlossen — Einzelinserate zurückgezogen" },
                  actorUserId: user.id,
                },
              });
            } else {
              // Individual unit listing reserved/closed → check if ALL units are reserved/closed
              const siblings = await prisma.property.findMany({
                where: { parentId },
                include: { listings: { where: { status: { notIn: ["WITHDRAWN", "CLOSED", "RESERVED"] } } } },
              });
              const allUnitsSold = siblings.every((s) => s.listings.length === 0);
              if (allUnitsSold) {
                // All individual units sold → withdraw the package listing
                await prisma.listing.updateMany({
                  where: { propertyId: parentId, status: { in: ["ACTIVE", "DRAFT", "REVIEW"] } },
                  data: { status: "WITHDRAWN", closedAt: new Date() },
                });
                await prisma.listingEvent.create({
                  data: {
                    listingId: id,
                    type: "AUTO_WITHDRAW",
                    payload: { reason: "Alle Wohnungen verkauft — Paketinserat zurückgezogen" },
                    actorUserId: user.id,
                  },
                });
              }
            }
          }
        }
      }
    }

    return NextResponse.json(listing);
  } catch (err) {
    console.error("Update listing error:", err);
    return NextResponse.json({ error: "Aktualisierung fehlgeschlagen" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;
    void req;

    const listing = await prisma.listing.findFirst({
      where: { id, property: { userId: user.id } },
    });

    if (!listing) {
      return NextResponse.json({ error: "Inserat nicht gefunden" }, { status: 404 });
    }

    if (listing.status === "ACTIVE") {
      return NextResponse.json({ error: "Aktive Inserate können nicht gelöscht werden. Bitte zuerst deaktivieren." }, { status: 400 });
    }

    // Delete related records first
    await prisma.listingEvent.deleteMany({ where: { listingId: id } });
    await prisma.portalStat.deleteMany({ where: { syndicationTarget: { listingId: id } } });
    await prisma.syndicationJob.deleteMany({ where: { syndicationTarget: { listingId: id } } });
    await prisma.syndicationTarget.deleteMany({ where: { listingId: id } });
    await prisma.comparable.deleteMany({ where: { priceRecommendation: { listingId: id } } });
    await prisma.priceRecommendation.deleteMany({ where: { listingId: id } });
    await prisma.listing.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete listing error:", err);
    return NextResponse.json({ error: "Löschen fehlgeschlagen" }, { status: 500 });
  }
}
