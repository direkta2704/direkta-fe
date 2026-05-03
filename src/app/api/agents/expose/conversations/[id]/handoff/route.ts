import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { rebuildMemory, isReadyForDraft } from "@/lib/expose-agent";
import { calculatePricing } from "@/lib/pricing";
import { generateExposePdf } from "@/lib/expose-pdf";
import { isS3Enabled, uploadToS3, getFromS3 } from "@/lib/s3";
import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
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

    const memory = rebuildMemory(conversation.turns);

    if (!isReadyForDraft(memory)) {
      return NextResponse.json({ error: "Nicht alle Pflichtfelder ausgefüllt" }, { status: 400 });
    }

    // F-M5-05: handoff blocked unless the rubric passed
    if (!memory.lastRubric?.passed) {
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

    // Photos: F-M1-04 / rubric requires ≥6 — already enforced by rubric, but double-check
    const photoCount = memory.uploads.filter((u) => u.kind === "PHOTO").length;
    if (photoCount < 6) {
      return NextResponse.json({ error: `Nur ${photoCount} Fotos vorhanden (Soll: ≥6)` }, { status: 412 });
    }

    const citySlug = memory.city!.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const typeMap: Record<string, string> = {
      ETW: "wohnung", EFH: "einfamilienhaus", MFH: "mehrfamilienhaus",
      DHH: "doppelhaushaelfte", RH: "reihenhaus", GRUNDSTUECK: "grundstueck",
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
        condition: memory.condition as "ERSTBEZUG" | "NEUBAU" | "GEPFLEGT" | "RENOVIERUNGS_BEDUERFTIG" | "SANIERUNGS_BEDUERFTIG" | "ROHBAU",
        attributes: memory.attributes.length > 0 ? memory.attributes : undefined,
        roomProgram: memory.roomProgram && memory.roomProgram.length > 0 ? memory.roomProgram : undefined,
      },
    });

    // Set selling mode and building info for MFH
    if (memory.type === "MFH" && (memory.sellingMode || memory.units.length > 0)) {
      await prisma.property.update({
        where: { id: property.id },
        data: {
          buildingInfo: {
            _sellingMode: memory.sellingMode || "BUNDLE",
            unitCount: memory.unitCount || memory.units.length,
          },
        },
      });

      // Create child unit properties
      for (const unit of memory.units) {
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
            condition: memory.condition as "ERSTBEZUG" | "NEUBAU" | "GEPFLEGT" | "RENOVIERUNGS_BEDUERFTIG" | "SANIERUNGS_BEDUERFTIG" | "ROHBAU",
            attributes: unit.features.length > 0 ? unit.features : memory.attributes,
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

        // Assign only unit-specific uploads — no fallback to property photos
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
            },
          });
        }

        // Create listing for individual unit if selling INDIVIDUAL or BOTH
        if (memory.sellingMode === "INDIVIDUAL" || memory.sellingMode === "BOTH") {
          const unitSlug = `${citySlug}/wohnung-${Math.random().toString(36).slice(2, 6)}`;
          await prisma.listing.create({
            data: {
              propertyId: unitProp.id,
              slug: unitSlug,
              titleShort: `${unit.label}, ${unit.rooms || "?"} Zimmer, ${unit.livingArea || "?"} m², ${memory.city}`,
              descriptionLong: memory.draft!.descriptionLong,
              askingPrice: unit.askingPrice ?? null,
              status: "REVIEW",
            },
          });
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

    // Attach uploaded media to the property
    for (let i = 0; i < memory.uploads.length; i++) {
      const u = memory.uploads[i];
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
        sellerContact: memory.sellerContact || undefined,
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
    try {
      const PROPERTY_TYPE_DE: Record<string, string> = {
        ETW: "Eigentumswohnung", EFH: "Einfamilienhaus", MFH: "Mehrfamilienhaus",
        DHH: "Doppelhaushälfte", RH: "Reihenhaus", GRUNDSTUECK: "Grundstück",
      };
      const CONDITION_DE: Record<string, string> = {
        ERSTBEZUG: "Erstbezug", NEUBAU: "Neubau", GEPFLEGT: "Gepflegt",
        RENOVIERUNGS_BEDUERFTIG: "Renovierungsbedürftig",
        SANIERUNGS_BEDUERFTIG: "Sanierungsbedürftig", ROHBAU: "Rohbau",
      };

      // Load up to 6 photo bytes for the PDF
      const photoBytes: { bytes: Uint8Array; mimeType: string }[] = [];
      for (const u of memory.uploads.filter((u) => u.kind === "PHOTO")) {
        try {
          if (u.storageKey.startsWith("/uploads/")) {
            const local = path.join(process.cwd(), "public", u.storageKey.replace(/^\/+/, ""));
            const buf = await readFile(local);
            photoBytes.push({ bytes: new Uint8Array(buf), mimeType: u.mimeType });
          } else {
            const key = u.storageKey.replace(/^https?:\/\/[^/]+\//, "").replace(/^\/+/, "");
            const obj = await getFromS3(key);
            if (obj) {
              const reader = obj.body.getReader();
              const chunks: Uint8Array[] = [];
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value) chunks.push(value);
              }
              const total = chunks.reduce((n, c) => n + c.length, 0);
              const merged = new Uint8Array(total);
              let off = 0;
              for (const c of chunks) { merged.set(c, off); off += c.length; }
              photoBytes.push({ bytes: merged, mimeType: u.mimeType });
            }
          }
        } catch (e) {
          console.error("Failed to load photo for PDF:", u.fileName, e);
        }
      }

      // Load floor plans for PDF
      const floorPlanBytes: { bytes: Uint8Array; mimeType: string }[] = [];
      for (const u of memory.uploads.filter((u) => u.kind === "FLOORPLAN")) {
        try {
          if (u.storageKey.startsWith("/uploads/")) {
            const local = path.join(process.cwd(), "public", u.storageKey.replace(/^\/+/, ""));
            const buf = await readFile(local);
            floorPlanBytes.push({ bytes: new Uint8Array(buf), mimeType: u.mimeType });
          } else {
            const key = u.storageKey.replace(/^https?:\/\/[^/]+\//, "").replace(/^\/+/, "");
            const obj = await getFromS3(key);
            if (obj) {
              const reader = obj.body.getReader();
              const chunks: Uint8Array[] = [];
              while (true) { const { done, value } = await reader.read(); if (done) break; if (value) chunks.push(value); }
              const total = chunks.reduce((n, c) => n + c.length, 0);
              const merged = new Uint8Array(total);
              let off = 0;
              for (const c of chunks) { merged.set(c, off); off += c.length; }
              floorPlanBytes.push({ bytes: merged, mimeType: u.mimeType });
            }
          }
        } catch (e) {
          console.error("Failed to load floor plan for PDF:", u.fileName, e);
        }
      }

      const pdfBuffer = await generateExposePdf({
        titleShort: memory.draft.titleShort,
        descriptionLong: memory.draft.descriptionLong,
        address: `${memory.street} ${memory.houseNumber}, ${memory.postcode}`,
        city: memory.city!,
        propertyType: PROPERTY_TYPE_DE[memory.type!] || memory.type!,
        livingArea: memory.livingArea!,
        rooms: memory.rooms,
        yearBuilt: memory.yearBuilt,
        condition: CONDITION_DE[memory.condition!] || memory.condition!,
        askingPrice: memory.askingPrice,
        priceBand: memory.priceBand
          ? { low: memory.priceBand.low, median: memory.priceBand.median, high: memory.priceBand.high, confidence: memory.priceBand.confidence }
          : null,
        energy: memory.energyClass
          ? {
              class: memory.energyClass,
              value: memory.energyValue || 0,
              source: memory.energySource || "—",
              type: memory.energyCertType || "VERBRAUCH",
              validUntil: memory.energyValidUntil || "—",
            }
          : null,
        attributes: memory.attributes,
        photos: photoBytes,
        floorPlans: floorPlanBytes,
        generatedAt: new Date().toLocaleDateString("de-DE"),
      });

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
    } catch (e) {
      console.error("Exposé PDF generation failed:", e);
      // PDF is SHOULD priority — don't block handoff if it fails
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
