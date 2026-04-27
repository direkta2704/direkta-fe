import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { calculatePricing } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;
    void req;

    const listing = await prisma.listing.findFirst({
      where: { id, property: { userId: user.id } },
      include: {
        property: { include: { energyCert: true } },
      },
    });

    if (!listing) {
      return NextResponse.json(
        { error: "Inserat nicht gefunden" },
        { status: 404 }
      );
    }

    const p = listing.property;
    const result = calculatePricing({
      type: p.type,
      city: p.city,
      postcode: p.postcode,
      livingArea: p.livingArea,
      plotArea: p.plotArea,
      yearBuilt: p.yearBuilt,
      rooms: p.rooms,
      bathrooms: p.bathrooms,
      floor: p.floor,
      condition: p.condition,
      attributes: p.attributes as string[] | null,
      energyCert: p.energyCert
        ? {
            energyClass: p.energyCert.energyClass,
            energyValue: p.energyCert.energyValue,
          }
        : null,
    });

    // Delete old recommendation if exists
    await prisma.priceRecommendation.deleteMany({
      where: { listingId: id },
    });

    // Create new recommendation with comparables
    const recommendation = await prisma.priceRecommendation.create({
      data: {
        listingId: id,
        low: result.low,
        median: result.median,
        high: result.high,
        strategyQuick: result.strategyQuick,
        strategyReal: result.strategyReal,
        strategyMax: result.strategyMax,
        confidence: result.confidence,
        comparables: {
          create: result.comparables.map((c) => ({
            source: c.source,
            type: c.type as "ETW" | "EFH" | "MFH" | "DHH" | "RH" | "GRUNDSTUECK",
            livingArea: c.livingArea,
            pricePerSqm: c.pricePerSqm,
            distanceMeters: c.distanceMeters,
            ageDays: c.ageDays,
            similarityScore: c.similarityScore,
          })),
        },
      },
      include: {
        comparables: { orderBy: { similarityScore: "desc" } },
      },
    });

    await prisma.listingEvent.create({
      data: {
        listingId: id,
        type: "PRICE_RECOMMENDED",
        payload: {
          low: result.low,
          median: result.median,
          high: result.high,
          confidence: result.confidence,
          pricePerSqm: result.pricePerSqm,
          comparableCount: result.comparables.length,
        },
        actorUserId: user.id,
      },
    });

    return NextResponse.json(recommendation);
  } catch (err) {
    console.error("Pricing error:", err);
    const message =
      err instanceof Error ? err.message : "Preisberechnung fehlgeschlagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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

    const recommendation = await prisma.priceRecommendation.findUnique({
      where: { listingId: id },
      include: {
        comparables: { orderBy: { similarityScore: "desc" } },
      },
    });

    if (!recommendation) {
      return NextResponse.json(null);
    }

    return NextResponse.json(recommendation);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}
