import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { generateExposePdf } from "@/lib/expose-pdf";
import { getFromS3 } from "@/lib/s3";
import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function loadMediaBytes(storageKey: string, mimeType: string): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  try {
    if (storageKey.startsWith("/uploads/")) {
      const local = path.join(process.cwd(), "public", storageKey.replace(/^\/+/, ""));
      const buf = await readFile(local);
      return { bytes: new Uint8Array(buf), mimeType };
    } else {
      const key = storageKey.replace(/^https?:\/\/[^/]+\//, "").replace(/^\/+/, "");
      const obj = await getFromS3(key);
      if (!obj) return null;
      const reader = obj.body.getReader();
      const chunks: Uint8Array[] = [];
      while (true) { const { done, value } = await reader.read(); if (done) break; if (value) chunks.push(value); }
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const merged = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) { merged.set(c, off); off += c.length; }
      return { bytes: merged, mimeType };
    }
  } catch {
    return null;
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;
    void req;

    const fullUser = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, email: true, phone: true } });

    const listing = await prisma.listing.findFirst({
      where: { id, property: { userId: user.id } },
      include: {
        property: {
          include: {
            energyCert: true,
            media: { orderBy: { ordering: "asc" } },
            units: {
              orderBy: { createdAt: "asc" },
              include: {
                media: { orderBy: { ordering: "asc" } },
                listings: {
                  where: { status: { notIn: ["WITHDRAWN", "CLOSED"] } },
                  select: { askingPrice: true, titleShort: true },
                  take: 1,
                },
              },
            },
          },
        },
        priceRecommendation: true,
      },
    });

    if (!listing) return new Response("Not found", { status: 404 });

    const p = listing.property;
    const TYPES_DE: Record<string, string> = {
      ETW: "Eigentumswohnung", EFH: "Einfamilienhaus", MFH: "Mehrfamilienhaus",
      DHH: "Doppelhaushälfte", RH: "Reihenhaus", GRUNDSTUECK: "Grundstück",
    };
    const COND_DE: Record<string, string> = {
      ERSTBEZUG: "Erstbezug", NEUBAU: "Neubau", GEPFLEGT: "Gepflegt",
      RENOVIERUNGS_BEDUERFTIG: "Renovierungsbedürftig",
      SANIERUNGS_BEDUERFTIG: "Sanierungsbedürftig", ROHBAU: "Rohbau",
    };

    const photoMedia = p.media.filter((m) => m.kind === "PHOTO");
    const photos: { bytes: Uint8Array; mimeType: string }[] = [];
    for (const m of photoMedia) {
      const data = await loadMediaBytes(m.storageKey, m.mimeType);
      if (data) photos.push(data);
    }

    const fpMedia = p.media.filter((m) => m.kind === "FLOORPLAN");
    const floorPlans: { bytes: Uint8Array; mimeType: string }[] = [];
    for (const m of fpMedia) {
      const data = await loadMediaBytes(m.storageKey, m.mimeType);
      if (data) floorPlans.push(data);
    }

    // Load unit data for MFH bundle listings
    const isBundle = !p.parentId && p.units && p.units.length > 0;
    let unitData: { label: string; livingArea: number; rooms: number | null; bathrooms?: number; floor?: number; askingPrice?: number; titleShort?: string; roomProgram?: { name: string; area: number }[]; photos: { bytes: Uint8Array; mimeType: string }[]; floorPlans: { bytes: Uint8Array; mimeType: string }[] }[] | undefined;

    if (isBundle) {
      unitData = [];
      for (const unit of p.units) {
        const uPhotos: { bytes: Uint8Array; mimeType: string }[] = [];
        for (const m of unit.media.filter((m) => m.kind === "PHOTO")) {
          const d = await loadMediaBytes(m.storageKey, m.mimeType);
          if (d) uPhotos.push(d);
        }
        const uFP: { bytes: Uint8Array; mimeType: string }[] = [];
        for (const m of unit.media.filter((m) => m.kind === "FLOORPLAN")) {
          const d = await loadMediaBytes(m.storageKey, m.mimeType);
          if (d) uFP.push(d);
        }
        const uListing = unit.listings[0];
        unitData.push({
          label: unit.unitLabel || `WE ${unitData.length + 1}`,
          livingArea: unit.livingArea,
          rooms: unit.rooms,
          bathrooms: unit.bathrooms || undefined,
          floor: unit.floor != null ? unit.floor : undefined,
          askingPrice: uListing?.askingPrice ? Number(uListing.askingPrice) : undefined,
          titleShort: uListing?.titleShort || undefined,
          roomProgram: Array.isArray(unit.roomProgram) ? (unit.roomProgram as { name: string; area: number }[]) : undefined,
          photos: uPhotos,
          floorPlans: uFP,
        });
      }
    }

    const pdfBuffer = await generateExposePdf({
      titleShort: listing.titleShort || `${p.street} ${p.houseNumber}`,
      descriptionLong: listing.descriptionLong || "",
      address: `${p.street} ${p.houseNumber}, ${p.postcode}`,
      city: p.city,
      propertyType: TYPES_DE[p.type] || p.type,
      livingArea: p.livingArea,
      rooms: p.rooms,
      yearBuilt: p.yearBuilt,
      condition: COND_DE[p.condition] || p.condition,
      askingPrice: listing.askingPrice ? Number(listing.askingPrice) : null,
      priceBand: listing.priceRecommendation
        ? { low: Number(listing.priceRecommendation.low), median: Number(listing.priceRecommendation.median), high: Number(listing.priceRecommendation.high), confidence: listing.priceRecommendation.confidence }
        : null,
      energy: p.energyCert
        ? { class: p.energyCert.energyClass, value: p.energyCert.energyValue, source: p.energyCert.primarySource, type: p.energyCert.type, validUntil: p.energyCert.validUntil.toISOString().split("T")[0] }
        : null,
      attributes: (p.attributes as string[]) || [],
      photos,
      floorPlans,
      generatedAt: new Date().toLocaleDateString("de-DE"),
      postcode: p.postcode,
      contact: (() => {
        const sc = listing.sellerContact as { name?: string; email?: string; phone?: string; company?: string } | null;
        return {
          name: sc?.name || sc?.company || fullUser?.name || undefined,
          email: sc?.email || fullUser?.email,
          phone: sc?.phone || fullUser?.phone || undefined,
        };
      })(),
      locationDescription: listing.locationDescription || undefined,
      bathrooms: p.bathrooms || undefined,
      floor: p.floor != null ? p.floor : undefined,
      plotArea: p.plotArea || undefined,
      roomProgram: Array.isArray(p.roomProgram) ? (p.roomProgram as { name: string; area: number }[]) : undefined,
      highlights: Array.isArray(listing.highlights) ? (listing.highlights as string[]) : undefined,
      exposeHeadline: listing.exposeHeadline || undefined,
      exposeSubheadline: listing.exposeSubheadline || undefined,
      units: unitData,
      specifications: p.specifications && typeof p.specifications === "object" && !Array.isArray(p.specifications) ? (p.specifications as Record<string, string>) : undefined,
      buildingDescription: listing.buildingDescription || undefined,
    });

    const fn = `Expose_${p.street}_${p.houseNumber}_${p.city}.pdf`.replace(/\s+/g, "_");

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fn}"`,
      },
    });
  } catch (err) {
    console.error("PDF error:", err);
    return new Response("PDF-Erstellung fehlgeschlagen", { status: 500 });
  }
}
