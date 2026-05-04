import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { generateExposePdf } from "@/lib/expose-pdf";
import type { ExposePhoto } from "@/lib/expose-pdf";
import { getFromS3 } from "@/lib/s3";
import { readFile } from "fs/promises";
import path from "path";
import puppeteer from "puppeteer";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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

async function convertPdfToImage(pdfBytes: Uint8Array): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  let browser;
  try {
    const b64 = Buffer.from(pdfBytes).toString("base64");
    const html = `<!DOCTYPE html><html><head><style>
      * { margin: 0; padding: 0; }
      body { background: #fff; }
      canvas { display: block; }
    </style></head><body>
    <canvas id="c"></canvas>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
    <script>
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      var raw = atob('${b64}');
      var bytes = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      pdfjsLib.getDocument({ data: bytes }).promise.then(function(pdf) {
        pdf.getPage(1).then(function(pg) {
          var vp = pg.getViewport({ scale: 2.0 });
          var canvas = document.getElementById('c');
          canvas.width = vp.width;
          canvas.height = vp.height;
          pg.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise.then(function() {
            document.title = 'OK';
          });
        });
      });
    </script></body></html>`;

    browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(() => document.title === "OK", { timeout: 20000 });

    const canvasEl = await page.$("#c");
    if (!canvasEl) return null;
    const screenshot = await canvasEl.screenshot({ type: "png" });
    return { bytes: new Uint8Array(screenshot), mimeType: "image/png" };
  } catch (e) {
    console.error("PDF-to-image conversion failed:", e);
    return null;
  } finally {
    if (browser) await browser.close();
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
    const allPhotos: ExposePhoto[] = [];
    const allScores: number[] = [];
    for (const m of photoMedia) {
      const data = await loadMediaBytes(m.storageKey, m.mimeType);
      if (data) {
        const cls = m.classification as { roomType?: string; caption?: string; description?: string; features?: string[]; lighting?: string; estimatedArea?: number; qualityScore?: number } | null;
        allPhotos.push({
          ...data,
          roomType: cls?.roomType,
          caption: cls?.caption,
          description: cls?.description,
          features: cls?.features,
          lighting: cls?.lighting,
          estimatedArea: cls?.estimatedArea,
        });
        allScores.push(typeof cls?.qualityScore === "number" ? cls.qualityScore : 0);
      }
    }

    // Pick the highest-scoring exterior shot for the cover; fall back to a
    // typography-only cover when no exterior is detected (avoids putting
    // an empty room or interior on the front of the brochure).
    let coverIdx = -1;
    let bestScore = -1;
    allPhotos.forEach((ph, i) => {
      if (ph.roomType === "exterior" && allScores[i] > bestScore) {
        bestScore = allScores[i];
        coverIdx = i;
      }
    });
    const coverPhoto: ExposePhoto | undefined = coverIdx >= 0 ? allPhotos[coverIdx] : undefined;
    const photos: ExposePhoto[] = coverIdx >= 0
      ? allPhotos.filter((_, i) => i !== coverIdx)
      : allPhotos;

    const fpMedia = p.media.filter((m) => m.kind === "FLOORPLAN");
    const floorPlans: ExposePhoto[] = [];
    for (const m of fpMedia) {
      const data = await loadMediaBytes(m.storageKey, m.mimeType);
      if (!data) continue;
      if (data.mimeType === "application/pdf") {
        const converted = await convertPdfToImage(data.bytes);
        if (converted) floorPlans.push(converted);
      } else {
        floorPlans.push(data);
      }
    }

    // Load unit data for MFH bundle listings
    const isBundle = !p.parentId && p.units && p.units.length > 0;
    let unitData: { label: string; livingArea: number; rooms: number | null; bathrooms?: number; floor?: number; askingPrice?: number; titleShort?: string; roomProgram?: { name: string; area: number }[]; photos: ExposePhoto[]; floorPlans: ExposePhoto[] }[] | undefined;

    if (isBundle) {
      unitData = [];
      for (const unit of p.units) {
        const uPhotos: ExposePhoto[] = [];
        for (const m of unit.media.filter((m) => m.kind === "PHOTO")) {
          const d = await loadMediaBytes(m.storageKey, m.mimeType);
          if (d) {
            const cls = m.classification as { roomType?: string; caption?: string; description?: string; features?: string[]; lighting?: string; estimatedArea?: number } | null;
            uPhotos.push({ ...d, roomType: cls?.roomType, caption: cls?.caption, description: cls?.description, features: cls?.features, lighting: cls?.lighting, estimatedArea: cls?.estimatedArea });
          }
        }
        const uFP: ExposePhoto[] = [];
        for (const m of unit.media.filter((m) => m.kind === "FLOORPLAN")) {
          const d = await loadMediaBytes(m.storageKey, m.mimeType);
          if (!d) continue;
          if (d.mimeType === "application/pdf") {
            const conv = await convertPdfToImage(d.bytes);
            if (conv) uFP.push(conv);
          } else {
            uFP.push(d);
          }
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
      coverPhoto,
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

    const fn = p.unitLabel
      ? `Expose_${p.unitLabel}.pdf`.replace(/\s+/g, "_")
      : `Expose_${p.street}_${p.houseNumber}_${p.city}.pdf`.replace(/\s+/g, "_");
    const url = new URL(req.url);
    const inline = url.searchParams.get("inline") === "1";

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${fn}"`,
      },
    });
  } catch (err) {
    console.error("PDF error:", err);
    return new Response("PDF-Erstellung fehlgeschlagen", { status: 500 });
  }
}
