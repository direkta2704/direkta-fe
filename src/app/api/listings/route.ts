import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { calculatePricing } from "@/lib/pricing";
import { generateListingTexts } from "@/lib/ai";
import { generateExposeContent } from "@/lib/expose-content-ai";

export const dynamic = "force-dynamic";

function generateSlug(city: string, type: string): string {
  const citySlug = city.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const typeMap: Record<string, string> = {
    ETW: "wohnung",
    EFH: "einfamilienhaus",
    MFH: "mehrfamilienhaus",
    DHH: "doppelhaushaelfte",
    RH: "reihenhaus",
    GRUNDSTUECK: "grundstueck",
  };
  const typeSlug = typeMap[type] || type.toLowerCase();
  const shortId = Math.random().toString(36).slice(2, 6);
  return `${citySlug}/${typeSlug}-${shortId}`;
}

export async function GET() {
  try {
    const user = await getRequiredUser();
    const listings = await prisma.listing.findMany({
      where: { property: { userId: user.id } },
      include: {
        property: {
          select: {
            id: true, street: true, houseNumber: true, city: true, postcode: true, type: true, livingArea: true, rooms: true,
            media: { where: { kind: "PHOTO" }, orderBy: { ordering: "asc" }, take: 1, select: { storageKey: true } },
          },
        },
        syndicationTargets: { select: { portal: true, status: true, externalUrl: true }, take: 1 },
        _count: { select: { leads: true, offers: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(listings);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getRequiredUser();
    const body = await req.json();

    const property = await prisma.property.findFirst({
      where: { id: body.propertyId, userId: user.id },
      include: { energyCert: true },
    });

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    const slug = generateSlug(property.city, property.type);

    // Auto-generate title if not provided
    const TYPES_DE: Record<string, string> = {
      ETW: "Eigentumswohnung", EFH: "Einfamilienhaus", MFH: "Mehrfamilienhaus",
      DHH: "Doppelhaushälfte", RH: "Reihenhaus", GRUNDSTUECK: "Grundstück",
    };
    const autoTitle = body.titleShort ||
      `${TYPES_DE[property.type] || property.type}, ${property.rooms ? property.rooms + " Zimmer, " : ""}${property.livingArea} m², ${property.city}`;

    const listing = await prisma.listing.create({
      data: {
        propertyId: property.id,
        slug,
        titleShort: autoTitle.slice(0, 160),
        descriptionLong: body.descriptionLong || null,
        askingPrice: body.askingPrice || null,
      },
    });

    // Auto-calculate price recommendation if property has enough data
    if (property.type && property.city && property.postcode && property.livingArea && property.condition) {
      try {
        const pricing = calculatePricing({
          type: property.type,
          city: property.city,
          postcode: property.postcode,
          livingArea: property.livingArea,
          plotArea: property.plotArea,
          yearBuilt: property.yearBuilt,
          rooms: property.rooms,
          bathrooms: property.bathrooms,
          floor: property.floor,
          condition: property.condition,
          attributes: property.attributes as string[] | null,
          energyCert: property.energyCert ? { energyClass: property.energyCert.energyClass, energyValue: property.energyCert.energyValue } : null,
        });
        await prisma.priceRecommendation.create({
          data: {
            listingId: listing.id,
            low: pricing.low,
            median: pricing.median,
            high: pricing.high,
            strategyQuick: pricing.strategyQuick,
            strategyReal: pricing.strategyReal,
            strategyMax: pricing.strategyMax,
            confidence: pricing.confidence,
            comparables: {
              create: pricing.comparables.map((c) => ({
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
        });
        // Set asking price to realistic strategy
        await prisma.listing.update({
          where: { id: listing.id },
          data: { askingPrice: pricing.strategyReal },
        });
      } catch (e) {
        console.warn("Auto-pricing failed:", e);
      }
    }

    // Auto-generate AI description + expose content
    const propInput = {
      type: property.type,
      street: property.street,
      houseNumber: property.houseNumber,
      postcode: property.postcode,
      city: property.city,
      livingArea: property.livingArea,
      plotArea: property.plotArea,
      yearBuilt: property.yearBuilt,
      rooms: property.rooms,
      bathrooms: property.bathrooms,
      floor: property.floor,
      condition: property.condition,
      attributes: property.attributes as string[] | null,
      energyCert: property.energyCert
        ? { type: property.energyCert.type, energyClass: property.energyCert.energyClass, energyValue: property.energyCert.energyValue, primarySource: property.energyCert.primarySource }
        : null,
    };

    try {
      const [texts, expose] = await Promise.all([
        generateListingTexts(propInput),
        generateExposeContent(propInput),
      ]);
      await prisma.listing.update({
        where: { id: listing.id },
        data: {
          descriptionLong: texts.descriptionLong,
          titleShort: texts.titleShort,
          exposeHeadline: expose.exposeHeadline,
          exposeSubheadline: expose.exposeSubheadline,
          locationDescription: expose.locationDescription,
          buildingDescription: expose.buildingDescription,
          highlights: expose.highlights,
        },
      });
    } catch (e) {
      console.warn("Auto-generation failed:", e);
    }

    await prisma.listingEvent.create({
      data: {
        listingId: listing.id,
        type: "CREATED",
        payload: { source: "form", autoGenerated: true },
        actorUserId: user.id,
      },
    });

    const final = await prisma.listing.findUnique({ where: { id: listing.id }, include: { priceRecommendation: true } });
    return NextResponse.json(final || listing, { status: 201 });
  } catch (err) {
    console.error("Create listing error:", err);
    return NextResponse.json({ error: "Inserat konnte nicht erstellt werden" }, { status: 500 });
  }
}
