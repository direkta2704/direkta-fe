import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { INITIAL_MEMORY, applyExtracted, isReadyForDraft, type WorkingMemory } from "@/lib/expose-agent";
import { generateListingTexts } from "@/lib/ai";
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

    const conversation = await prisma.conversation.findFirst({
      where: { id, userId: user.id },
      include: { turns: { orderBy: { createdAt: "asc" } } },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Konversation nicht gefunden" }, { status: 404 });
    }

    // Rebuild memory
    let memory: WorkingMemory = { ...INITIAL_MEMORY };
    for (const turn of conversation.turns) {
      if (turn.toolOutput && typeof turn.toolOutput === "object") {
        memory = applyExtracted(memory, turn.toolOutput as Record<string, unknown>);
      }
    }

    if (!isReadyForDraft(memory)) {
      return NextResponse.json({ error: "Nicht alle Pflichtfelder ausgefüllt" }, { status: 400 });
    }

    // Create Property
    const property = await prisma.property.create({
      data: {
        userId: user.id,
        type: memory.type as "ETW" | "EFH" | "MFH" | "DHH" | "RH" | "GRUNDSTUECK",
        street: memory.street!,
        houseNumber: memory.houseNumber!,
        postcode: memory.postcode!,
        city: memory.city!,
        livingArea: memory.livingArea!,
        plotArea: memory.plotArea,
        yearBuilt: memory.yearBuilt,
        rooms: memory.rooms,
        bathrooms: memory.bathrooms,
        floor: memory.floor,
        condition: memory.condition as "ERSTBEZUG" | "NEUBAU" | "GEPFLEGT" | "RENOVIERUNGS_BEDUERFTIG" | "SANIERUNGS_BEDUERFTIG" | "ROHBAU",
        attributes: memory.attributes.length > 0 ? memory.attributes : undefined,
      },
    });

    // Create Energy Certificate if provided
    if (memory.hasEnergyCert && memory.energyClass) {
      await prisma.energyCertificate.create({
        data: {
          propertyId: property.id,
          type: (memory.energyCertType === "BEDARF" ? "BEDARF" : "VERBRAUCH") as "VERBRAUCH" | "BEDARF",
          validUntil: memory.energyValidUntil ? new Date(memory.energyValidUntil) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          energyClass: memory.energyClass,
          energyValue: memory.energyValue || 0,
          primarySource: memory.energySource || "unbekannt",
        },
      });
    }

    // Generate listing text
    let titleShort = null;
    let descriptionLong = null;
    try {
      const texts = await generateListingTexts({
        type: memory.type!,
        street: memory.street!,
        houseNumber: memory.houseNumber!,
        postcode: memory.postcode!,
        city: memory.city!,
        livingArea: memory.livingArea!,
        plotArea: memory.plotArea,
        yearBuilt: memory.yearBuilt,
        rooms: memory.rooms,
        bathrooms: memory.bathrooms,
        floor: memory.floor,
        condition: memory.condition!,
        attributes: memory.attributes.length > 0 ? memory.attributes : null,
        energyCert: memory.energyClass ? {
          type: memory.energyCertType || "VERBRAUCH",
          energyClass: memory.energyClass,
          energyValue: memory.energyValue || 0,
          primarySource: memory.energySource || "",
        } : null,
      });
      titleShort = texts.titleShort;
      descriptionLong = texts.descriptionLong;
    } catch (e) {
      console.error("Text generation during handoff:", e);
    }

    // Create Listing
    const citySlug = memory.city!.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const typeMap: Record<string, string> = { ETW: "wohnung", EFH: "einfamilienhaus", MFH: "mehrfamilienhaus", DHH: "doppelhaushaelfte", RH: "reihenhaus", GRUNDSTUECK: "grundstueck" };
    const slug = `${citySlug}/${typeMap[memory.type!] || memory.type!.toLowerCase()}-${Math.random().toString(36).slice(2, 6)}`;

    const listing = await prisma.listing.create({
      data: {
        propertyId: property.id,
        slug,
        titleShort,
        descriptionLong,
        status: "REVIEW",
      },
    });

    // Run pricing
    try {
      const pricing = calculatePricing({
        type: memory.type!,
        city: memory.city!,
        postcode: memory.postcode!,
        livingArea: memory.livingArea!,
        plotArea: memory.plotArea,
        yearBuilt: memory.yearBuilt,
        rooms: memory.rooms,
        bathrooms: memory.bathrooms,
        floor: memory.floor,
        condition: memory.condition!,
        attributes: memory.attributes.length > 0 ? memory.attributes : null,
        energyCert: memory.energyClass ? { energyClass: memory.energyClass, energyValue: memory.energyValue || 0 } : null,
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
    } catch (e) {
      console.error("Pricing during handoff:", e);
    }

    // Close conversation
    await prisma.conversation.update({
      where: { id },
      data: { status: "COMPLETED", listingId: listing.id, closedAt: new Date() },
    });

    await prisma.listingEvent.create({
      data: {
        listingId: listing.id,
        type: "CREATED",
        payload: { source: "expose-agent", conversationId: id },
        actorUserId: user.id,
      },
    });

    return NextResponse.json({
      ok: true,
      propertyId: property.id,
      listingId: listing.id,
    });
  } catch (err) {
    console.error("Handoff error:", err);
    return NextResponse.json({ error: "Übergabe fehlgeschlagen" }, { status: 500 });
  }
}
