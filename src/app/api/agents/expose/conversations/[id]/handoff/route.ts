import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { rebuildMemory, isReadyForDraft } from "@/lib/expose-agent";
import { calculatePricing } from "@/lib/pricing";
import { isS3Enabled, uploadToS3 } from "@/lib/s3";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getRequiredUser();
    const fullUser = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, email: true, phone: true } });
    const { id } = await params;
    void req;

    const conversation = await prisma.conversation.findFirst({
      where: { id, userId: user.id },
      include: { turns: { orderBy: { createdAt: "asc" } } },
    });
    if (!conversation) {
      return NextResponse.json({ error: "Konversation nicht gefunden" }, { status: 404 });
    }

    const memory = rebuildMemory(conversation.turns);

    if (!isReadyForDraft(memory)) {
      return NextResponse.json({ error: "Nicht alle Pflichtfelder ausgefüllt" }, { status: 400 });
    }

    // F-M5-05: handoff blocked unless the rubric passed OR the seller approved the draft
    if (!memory.lastRubric?.passed && !memory.draftApprovedByUser) {
      return NextResponse.json(
        {
          error: "Quality Rubric nicht bestanden. Bitte den Assistenten 'listing_review' erneut aufrufen lassen.",
          rubric: memory.lastRubric,
        },
        { status: 412 },
      );
    }

    if (!memory.draft) {
      return NextResponse.json({ error: "Kein Entwurf vorhanden" }, { status: 412 });
    }

    const photoCount = memory.uploads.filter((u) => u.kind === "PHOTO").length;
    if (photoCount < 1) {
      return NextResponse.json({ error: "Mindestens 1 Foto erforderlich" }, { status: 412 });
    }

    const citySlug = memory.city!.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const typeMap: Record<string, string> = {
      ETW: "wohnung", EFH: "einfamilienhaus", MFH: "mehrfamilienhaus",
      DHH: "doppelhaushaelfte", RH: "reihenhaus", GRUNDSTUECK: "grundstueck",
    };
    const CONDITION_ADJ: Record<string, string> = {
      ERSTBEZUG: "Erstbezug", NEUBAU: "neugebauten", GEPFLEGT: "gepflegten",
      RENOVIERUNGS_BEDUERFTIG: "renovierungsbedürftigen",
      SANIERUNGS_BEDUERFTIG: "sanierungsbedürftigen", ROHBAU: "Rohbau", KERNSANIERT: "kernsanierten",
    };

    // Create the Property record
    const property = await prisma.property.create({
      data: {
        userId: user.id,
        type: memory.type as "ETW" | "EFH" | "MFH" | "DHH" | "RH" | "GRUNDSTUECK",
        street: memory.street!,
        houseNumber: memory.houseNumber!,
        postcode: memory.postcode!,
        city: memory.city!,
        lat: memory.lat,
        lng: memory.lng,
        livingArea: memory.livingArea!,
        plotArea: memory.plotArea,
        yearBuilt: memory.yearBuilt,
        rooms: memory.rooms,
        bathrooms: memory.bathrooms,
        floor: memory.floor,
        condition: memory.condition as "ERSTBEZUG" | "NEUBAU" | "GEPFLEGT" | "RENOVIERUNGS_BEDUERFTIG" | "SANIERUNGS_BEDUERFTIG" | "ROHBAU" | "KERNSANIERT",
        attributes: (() => {
          const attrs = [...memory.attributes];
          if (memory.barrierefrei === true && !attrs.includes("Barrierefrei")) attrs.push("Barrierefrei");
          return attrs.length > 0 ? attrs : undefined;
        })(),
        roomProgram: memory.roomProgram && memory.roomProgram.length > 0 ? memory.roomProgram : undefined,
        extras: memory.extras && memory.extras.length > 0 ? JSON.parse(JSON.stringify(memory.extras)) : undefined,
        specifications: memory.specifications && Object.keys(memory.specifications).length > 0 ? JSON.parse(JSON.stringify(memory.specifications)) : undefined,
        tagline: memory.draft?.exposeHeadline || null,
      },
    });

    // Persist building info for all property types (heating, roof, insulation for syndication)
    {
      const buildingInfo: Record<string, unknown> = {};
      if (memory.specifications["Heizung & Warmwasser"]?.["Typ"]) buildingInfo.heatingType = memory.specifications["Heizung & Warmwasser"]["Typ"];
      if (memory.specifications["Dach"]?.["Typ"]) buildingInfo.roofType = memory.specifications["Dach"]["Typ"];
      if (memory.specifications["Keller"]?.["Typ"]) buildingInfo.basementType = memory.specifications["Keller"]["Typ"];
      if (memory.specifications["Tueren & Fenster"]?.["Fenster"]) buildingInfo.windowType = memory.specifications["Tueren & Fenster"]["Fenster"];
      if (memory.barrierefrei != null) buildingInfo.barrierefrei = memory.barrierefrei;
      if (memory.type === "MFH" && (memory.sellingMode || memory.units.length > 0)) {
        buildingInfo._sellingMode = memory.sellingMode || "BUNDLE";
        buildingInfo.unitCount = memory.unitCount || memory.units.length;
        buildingInfo.Wohneinheiten = String(memory.unitCount || memory.units.length);
      }
      if (Object.keys(buildingInfo).length > 0) {
        await prisma.property.update({
          where: { id: property.id },
          data: { buildingInfo: JSON.parse(JSON.stringify(buildingInfo)) },
        });
      }
    }
    // sellerContact: use agent-collected contact, fall back to user profile (matches manual flow)
    const sellerContact = memory.sellerContact && (memory.sellerContact.name || memory.sellerContact.email)
      ? memory.sellerContact
      : { name: fullUser?.name || "", email: fullUser?.email || "", phone: fullUser?.phone || "", company: "" };

    if (memory.type === "MFH" && (memory.sellingMode || memory.units.length > 0)) {

      // Create child unit properties — skip ghost units (empty label or no data)
      const validUnits = memory.units.filter(u => u.label && u.label.trim() && (u.livingArea || u.rooms));
      for (const unit of validUnits) {
        const unitProp = await prisma.property.create({
          data: {
            userId: user.id,
            parentId: property.id,
            unitLabel: unit.label,
            type: "ETW",
            street: memory.street!,
            houseNumber: memory.houseNumber!,
            postcode: memory.postcode!,
            city: memory.city!,
            lat: memory.lat,
            lng: memory.lng,
            livingArea: unit.livingArea || memory.livingArea!,
            rooms: unit.rooms,
            bathrooms: unit.bathrooms,
            floor: unit.floor,
            condition: memory.condition as "ERSTBEZUG" | "NEUBAU" | "GEPFLEGT" | "RENOVIERUNGS_BEDUERFTIG" | "SANIERUNGS_BEDUERFTIG" | "ROHBAU" | "KERNSANIERT",
            attributes: unit.features.length > 0 ? unit.features : memory.attributes,
            extras: unit.extras && unit.extras.length > 0
              ? JSON.parse(JSON.stringify(unit.extras))
              : memory.extras && memory.extras.length > 0
                ? JSON.parse(JSON.stringify(memory.extras))
                : undefined,
            specifications: memory.specifications && Object.keys(memory.specifications).length > 0
              ? JSON.parse(JSON.stringify(memory.specifications))
              : undefined,
            roomProgram: memory.roomProgram && memory.roomProgram.length > 0
              ? memory.roomProgram
              : undefined,
            yearBuilt: memory.yearBuilt,
            plotArea: null,
          },
        });

        // Copy energy cert to each unit
        if (memory.hasEnergyCert && memory.energyClass) {
          await prisma.energyCertificate.create({
            data: {
              propertyId: unitProp.id,
              type: (memory.energyCertType === "BEDARF" ? "BEDARF" : "VERBRAUCH") as "VERBRAUCH" | "BEDARF",
              validUntil: memory.energyValidUntil ? new Date(memory.energyValidUntil) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              energyClass: memory.energyClass,
              energyValue: memory.energyValue || 0,
              primarySource: memory.energySource || "unbekannt",
            },
          });
        }

        // Assign unit-specific uploads only — building exterior photos are pulled
        // in at PDF generation time from the parent property, not duplicated here.
        const uploadsForUnit = memory.uploads.filter(
          (u) => (u.kind === "PHOTO" || u.kind === "FLOORPLAN") && u.unitLabel === unit.label
        );
        for (let i = 0; i < uploadsForUnit.length; i++) {
          const u = uploadsForUnit[i];
          await prisma.mediaAsset.create({
            data: {
              propertyId: unitProp.id,
              kind: u.kind as "PHOTO" | "FLOORPLAN",
              storageKey: u.storageKey,
              fileName: u.fileName,
              mimeType: u.mimeType,
              sizeBytes: u.sizeBytes,
              width: u.width,
              height: u.height,
              ordering: i,
              classification: u.classification ? JSON.parse(JSON.stringify(u.classification)) : undefined,
            },
          });
        }

        // Create listing for individual unit if selling INDIVIDUAL or BOTH
        if (memory.sellingMode === "INDIVIDUAL" || memory.sellingMode === "BOTH") {
          const unitSlug = `${citySlug}/wohnung-${Math.random().toString(36).slice(2, 6)}`;
          const unitTitle = `Eigentumswohnung, ${unit.rooms || "?"} Zimmer, ${unit.livingArea || "?"} m², ${memory.city}`;

          const unitIntro = [
            `Diese ${unit.livingArea || "?"}m² große Eigentumswohnung (${unit.label})`,
            unit.floor != null ? `im ${unit.floor === 0 ? "Erdgeschoss" : unit.floor + ". Obergeschoss"}` : "",
            `mit ${unit.rooms || "?"} Zimmern und ${unit.bathrooms || "?"} Bad`,
            `befindet sich in einem ${memory.yearBuilt ? `${memory.yearBuilt} erbauten` : ""} ${CONDITION_ADJ[memory.condition!] || "gepflegten"} Mehrfamilienhaus`,
            `in der ${memory.street} ${memory.houseNumber}, ${memory.postcode} ${memory.city}.`,
            unit.features.length > 0 ? `Zur Ausstattung gehören: ${unit.features.join(", ")}.` : "",
          ].filter(Boolean).join(" ");

          const buildingParagraphs = memory.draft!.descriptionLong.split(/\n\s*\n/).filter(p => p.trim());
          const locationParagraph = buildingParagraphs.length >= 2 ? buildingParagraphs[1] : "";
          const closingParagraph = buildingParagraphs.length >= 3 ? buildingParagraphs[2] : "";
          const unitDescription = [unitIntro, locationParagraph, closingParagraph].filter(Boolean).join("\n\n");

          const unitListing = await prisma.listing.create({
            data: {
              propertyId: unitProp.id,
              slug: unitSlug,
              titleShort: unitTitle.length > 160 ? unitTitle.slice(0, 157) + "..." : unitTitle,
              descriptionLong: unitDescription,
              askingPrice: unit.askingPrice
                ?? (memory.askingPrice && memory.livingArea
                  ? Math.round(memory.askingPrice * ((unit.livingArea || 0) / memory.livingArea))
                  : null),
              status: "REVIEW",
              locationDescription: memory.draft!.locationDescription || null,
              buildingDescription: memory.draft!.buildingDescription || null,
              highlights: memory.draft!.highlights && memory.draft!.highlights.length > 0 ? memory.draft!.highlights : undefined,
              exposeHeadline: memory.draft!.exposeHeadline || null,
              exposeSubheadline: memory.draft!.exposeSubheadline || null,
              sellerContact,
            },
          });

          // Price recommendation for each unit (matches manual flow)
          if (unit.askingPrice || memory.priceBand) {
            try {
              const unitPricing = calculatePricing({
                type: "ETW",
                city: memory.city!,
                postcode: memory.postcode!,
                livingArea: unit.livingArea || memory.livingArea!,
                plotArea: null,
                yearBuilt: memory.yearBuilt,
                rooms: unit.rooms,
                bathrooms: unit.bathrooms,
                floor: unit.floor,
                condition: memory.condition!,
                attributes: unit.features.length > 0 ? unit.features : memory.attributes.length > 0 ? memory.attributes : null,
                energyCert: memory.energyClass ? { energyClass: memory.energyClass, energyValue: memory.energyValue || 0 } : null,
              });
              await prisma.priceRecommendation.create({
                data: {
                  listingId: unitListing.id,
                  low: unitPricing.low,
                  median: unitPricing.median,
                  high: unitPricing.high,
                  strategyQuick: unitPricing.strategyQuick,
                  strategyReal: unitPricing.strategyReal,
                  strategyMax: unitPricing.strategyMax,
                  confidence: unitPricing.confidence,
                  comparables: {
                    create: unitPricing.comparables.map((c) => ({
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
              console.warn("Unit pricing failed:", e);
            }
          }
        }
      }
    }

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

    // Attach building-level media to the building property.
    // Unit-specific uploads (with unitLabel) are attached to their unit properties above.
    const isMfh = memory.type === "MFH" && memory.units.length > 0;
    const buildingUploads = isMfh
      ? memory.uploads.filter(u => !u.unitLabel)
      : memory.uploads;
    for (let i = 0; i < buildingUploads.length; i++) {
      const u = buildingUploads[i];
      await prisma.mediaAsset.create({
        data: {
          propertyId: property.id,
          kind: u.kind,
          storageKey: u.storageKey,
          fileName: u.fileName,
          mimeType: u.mimeType,
          sizeBytes: u.sizeBytes,
          width: u.width,
          height: u.height,
          ordering: i,
          classification: u.classification ? JSON.parse(JSON.stringify(u.classification)) : undefined,
        },
      });
    }

    // Create the Listing in REVIEW status (F-M5-08)
    const slug = `${citySlug}/${typeMap[memory.type!] || memory.type!.toLowerCase()}-${Math.random().toString(36).slice(2, 6)}`;

    const listing = await prisma.listing.create({
      data: {
        propertyId: property.id,
        slug,
        titleShort: memory.draft.titleShort,
        descriptionLong: memory.draft.descriptionLong,
        askingPrice: memory.askingPrice ?? null,
        status: "REVIEW",
        locationDescription: memory.draft.locationDescription || null,
        buildingDescription: memory.draft.buildingDescription || null,
        highlights: memory.draft.highlights && memory.draft.highlights.length > 0 ? memory.draft.highlights : undefined,
        exposeHeadline: memory.draft.exposeHeadline || null,
        exposeSubheadline: memory.draft.exposeSubheadline || null,
        sellerContact,
      },
    });

    // Persist the price recommendation snapshot (recompute to capture comparables)
    if (memory.priceBand) {
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
    }

    // Generate the designed Exposé PDF (F-M5-09)
    // Delegate to the same on-demand PDF route logic that handles all listing
    // types — it loads all photos with classification, does cover selection,
    // geocoding, map rendering, unit assembly, spec flattening, etc.
    try {
      const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
      const pdfRes = await fetch(`${baseUrl}/api/listings/${listing.id}/pdf`, {
        headers: { cookie: req.headers.get("cookie") || "" },
      });
      if (pdfRes.ok) {
        const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
        const fileName = `expose-${randomUUID()}.pdf`;
        let storageKey: string;
        if (isS3Enabled()) {
          const s3Key = `properties/${property.id}/${fileName}`;
          storageKey = await uploadToS3(s3Key, pdfBuffer, "application/pdf");
        } else {
          const dir = path.join(process.cwd(), "public", "uploads", property.id);
          await mkdir(dir, { recursive: true });
          await writeFile(path.join(dir, fileName), pdfBuffer);
          storageKey = `/uploads/${property.id}/${fileName}`;
        }

        await prisma.mediaAsset.create({
          data: {
            propertyId: property.id,
            listingId: listing.id,
            kind: "DOCUMENT",
            storageKey,
            fileName: `Exposé-${memory.city}-${memory.draft.titleShort.slice(0, 30)}.pdf`,
            mimeType: "application/pdf",
            sizeBytes: pdfBuffer.length,
          },
        });
      } else {
        console.error("PDF generation via listing route failed:", pdfRes.status, await pdfRes.text().catch(() => ""));
      }
    } catch (e) {
      console.error("Exposé PDF generation failed:", e);
    }

    await prisma.conversation.update({
      where: { id },
      data: { status: "COMPLETED", listingId: listing.id, closedAt: new Date() },
    });

    await prisma.agentRun.updateMany({
      where: { conversationId: id, status: "RUNNING" },
      data: { status: "SUCCEEDED", listingId: listing.id, finishedAt: new Date() },
    });

    await prisma.listingEvent.create({
      data: {
        listingId: listing.id,
        type: "CREATED",
        payload: JSON.parse(JSON.stringify({
          source: "expose-agent",
          conversationId: id,
          assumptions: memory.assumptions,
          rubric: memory.lastRubric,
        })),
        actorUserId: user.id,
      },
    });

    return NextResponse.json({
      ok: true,
      propertyId: property.id,
      listingId: listing.id,
      assumptions: memory.assumptions,
    });
  } catch (err) {
    console.error("Handoff error:", err);
    return NextResponse.json({ error: "Übergabe fehlgeschlagen" }, { status: 500 });
  }
}
