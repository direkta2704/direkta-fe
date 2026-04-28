import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const PRIMARY = rgb(236 / 255, 91 / 255, 19 / 255);
const BLUEPRINT = rgb(15 / 255, 23 / 255, 42 / 255);
const GRAY = rgb(100 / 255, 116 / 255, 139 / 255);
const LIGHT = rgb(241 / 255, 245 / 255, 249 / 255);
const WHITE = rgb(1, 1, 1);

const TYPE_DE: Record<string, string> = {
  ETW: "Eigentumswohnung", EFH: "Einfamilienhaus", MFH: "Mehrfamilienhaus",
  DHH: "Doppelhaushälfte", RH: "Reihenhaus", GRUNDSTUECK: "Grundstück",
};

const CONDITION_DE: Record<string, string> = {
  ERSTBEZUG: "Erstbezug", NEUBAU: "Neubau", GEPFLEGT: "Gepflegt",
  RENOVIERUNGS_BEDUERFTIG: "Renovierungsbedürftig",
  SANIERUNGS_BEDUERFTIG: "Sanierungsbedürftig", ROHBAU: "Rohbau",
};

async function loadImage(pdf: PDFDocument, storageKey: string) {
  try {
    const filePath = path.join(process.cwd(), "public", storageKey);
    const buffer = await readFile(filePath);
    const ext = storageKey.toLowerCase();
    if (ext.endsWith(".png")) return await pdf.embedPng(buffer);
    return await pdf.embedJpg(buffer);
  } catch {
    return null;
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
      include: {
        property: {
          include: {
            energyCert: true,
            media: { where: { kind: "PHOTO" }, orderBy: { ordering: "asc" } },
          },
        },
        priceRecommendation: true,
      },
    });

    if (!listing) {
      return new Response("Nicht gefunden", { status: 404 });
    }

    const p = listing.property;
    const pdf = await PDFDocument.create();
    const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const W = 595.28; // A4
    const H = 841.89;
    const M = 50; // margin

    // ─── PAGE 1: COVER ───
    const cover = pdf.addPage([W, H]);
    let y = H - M;

    // Header bar
    cover.drawRectangle({ x: 0, y: H - 80, width: W, height: 80, color: BLUEPRINT });
    cover.drawText("DIREKTA.", { x: M, y: H - 55, size: 22, font: helveticaBold, color: WHITE });
    cover.drawText("Immobilie verkaufen. Direkt.", { x: M, y: H - 72, size: 9, font: helvetica, color: rgb(1, 1, 1) });

    y = H - 110;

    // Main photo
    const photos = p.media;
    if (photos.length > 0) {
      const img = await loadImage(pdf, photos[0].storageKey);
      if (img) {
        const imgW = W - 2 * M;
        const imgH = imgW * (img.height / img.width);
        const finalH = Math.min(imgH, 300);
        cover.drawImage(img, { x: M, y: y - finalH, width: imgW, height: finalH });
        y -= finalH + 20;
      }
    }

    // Price
    if (listing.askingPrice) {
      const priceText = `EUR ${Number(listing.askingPrice).toLocaleString("de-DE")}`;
      cover.drawText(priceText, { x: M, y, size: 28, font: helveticaBold, color: PRIMARY });
      y -= 35;
    }

    // Title
    const title = listing.titleShort || `${p.street} ${p.houseNumber}, ${p.city}`;
    cover.drawText(title, { x: M, y, size: 18, font: helveticaBold, color: BLUEPRINT });
    y -= 22;

    // Address
    cover.drawText(`${p.street} ${p.houseNumber}, ${p.postcode} ${p.city}`, {
      x: M, y, size: 11, font: helvetica, color: GRAY,
    });
    y -= 40;

    // Key facts bar
    cover.drawRectangle({ x: M, y: y - 5, width: W - 2 * M, height: 60, color: LIGHT });
    const facts: [string, string][] = [
      ["Wohnflaeche", `${p.livingArea} m2`],
      ["Zimmer", p.rooms ? String(p.rooms) : "-"],
      ["Baujahr", p.yearBuilt ? String(p.yearBuilt) : "-"],
      ["Zustand", CONDITION_DE[p.condition] || p.condition],
      ["Typ", TYPE_DE[p.type] || p.type],
    ];
    const factW = (W - 2 * M) / facts.length;
    facts.forEach(([label, value], i) => {
      const fx = M + i * factW + 10;
      cover.drawText(label.toUpperCase(), { x: fx, y: y + 35, size: 7, font: helveticaBold, color: GRAY });
      cover.drawText(value, { x: fx, y: y + 18, size: 12, font: helveticaBold, color: BLUEPRINT });
    });
    y -= 75;

    // Energy info on cover
    if (p.energyCert) {
      cover.drawText("ENERGIEAUSWEIS", { x: M, y, size: 8, font: helveticaBold, color: GRAY });
      y -= 16;
      const energyLine = `${p.energyCert.type === "VERBRAUCH" ? "Verbrauchsausweis" : "Bedarfsausweis"} | Klasse ${p.energyCert.energyClass} | ${p.energyCert.energyValue} kWh/(m2*a) | ${p.energyCert.primarySource}`;
      cover.drawText(energyLine, { x: M, y, size: 9, font: helvetica, color: BLUEPRINT });
      y -= 30;
    }

    // Footer
    cover.drawRectangle({ x: 0, y: 0, width: W, height: 40, color: BLUEPRINT });
    cover.drawText("Erstellt mit DIREKTA.  |  www.direkta.de  |  Ohne Maklerprovision", {
      x: M, y: 15, size: 8, font: helvetica, color: rgb(0.6, 0.6, 0.7),
    });

    // ─── PAGE 2: DESCRIPTION ───
    if (listing.descriptionLong) {
      const descPage = pdf.addPage([W, H]);
      let dy = H - M;

      descPage.drawText("Beschreibung", { x: M, y: dy, size: 20, font: helveticaBold, color: BLUEPRINT });
      dy -= 30;

      // Draw description with word wrapping
      const lines = wrapText(listing.descriptionLong, helvetica, 10, W - 2 * M);
      for (const line of lines) {
        if (dy < M + 40) {
          // Would need a new page for very long descriptions
          break;
        }
        descPage.drawText(line, { x: M, y: dy, size: 10, font: helvetica, color: rgb(0.2, 0.2, 0.25) });
        dy -= 16;
      }

      // Features
      const attrs = p.attributes as string[] | null;
      if (attrs && attrs.length > 0) {
        dy -= 20;
        descPage.drawText("Ausstattung", { x: M, y: dy, size: 14, font: helveticaBold, color: BLUEPRINT });
        dy -= 22;
        const featPerRow = 3;
        const featW = (W - 2 * M) / featPerRow;
        attrs.forEach((attr, i) => {
          const col = i % featPerRow;
          const row = Math.floor(i / featPerRow);
          descPage.drawText(`•  ${attr}`, {
            x: M + col * featW,
            y: dy - row * 18,
            size: 9, font: helvetica, color: BLUEPRINT,
          });
        });
        dy -= Math.ceil(attrs.length / featPerRow) * 18 + 10;
      }

      // Detailed facts table
      dy -= 20;
      descPage.drawText("Objektdaten", { x: M, y: dy, size: 14, font: helveticaBold, color: BLUEPRINT });
      dy -= 22;

      const details: [string, string][] = [
        ["Immobilientyp", TYPE_DE[p.type] || p.type],
        ["Wohnflaeche", `${p.livingArea} m2`],
        ...(p.plotArea ? [["Grundstuecksflaeche", `${p.plotArea} m2`] as [string, string]] : []),
        ["Zimmer", p.rooms ? String(p.rooms) : "-"],
        ["Badezimmer", p.bathrooms ? String(p.bathrooms) : "-"],
        ["Baujahr", p.yearBuilt ? String(p.yearBuilt) : "-"],
        ...(p.floor != null ? [["Etage", String(p.floor)] as [string, string]] : []),
        ["Zustand", CONDITION_DE[p.condition] || p.condition],
      ];

      details.forEach(([label, value], i) => {
        const rowY = dy - i * 20;
        if (i % 2 === 0) {
          descPage.drawRectangle({ x: M, y: rowY - 5, width: W - 2 * M, height: 20, color: LIGHT });
        }
        descPage.drawText(label, { x: M + 5, y: rowY, size: 9, font: helvetica, color: GRAY });
        descPage.drawText(value, { x: M + 200, y: rowY, size: 9, font: helveticaBold, color: BLUEPRINT });
      });

      // Footer
      descPage.drawRectangle({ x: 0, y: 0, width: W, height: 40, color: BLUEPRINT });
      descPage.drawText("DIREKTA.  |  Alle Angaben ohne Gewaehr", {
        x: M, y: 15, size: 8, font: helvetica, color: rgb(0.6, 0.6, 0.7),
      });
    }

    // ─── PAGE 3+: PHOTOS ───
    if (photos.length > 1) {
      for (let i = 1; i < photos.length; i += 2) {
        const photoPage = pdf.addPage([W, H]);
        let py = H - M;

        if (i === 1) {
          photoPage.drawText("Fotos", { x: M, y: py, size: 20, font: helveticaBold, color: BLUEPRINT });
          py -= 30;
        }

        for (let j = 0; j < 2 && i + j < photos.length; j++) {
          const img = await loadImage(pdf, photos[i + j].storageKey);
          if (img) {
            const imgW = W - 2 * M;
            const imgH = Math.min(imgW * (img.height / img.width), 340);
            photoPage.drawImage(img, { x: M, y: py - imgH, width: imgW, height: imgH });
            py -= imgH + 15;
          }
        }

        photoPage.drawRectangle({ x: 0, y: 0, width: W, height: 40, color: BLUEPRINT });
        photoPage.drawText(`DIREKTA.  |  Seite ${pdf.getPageCount()}`, {
          x: M, y: 15, size: 8, font: helvetica, color: rgb(0.6, 0.6, 0.7),
        });
      }
    }

    const pdfBytes = await pdf.save();
    const fileName = `Expose_${p.street}_${p.houseNumber}_${p.city}.pdf`.replace(/\s+/g, "_");

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    console.error("PDF generation error:", err);
    return new Response("PDF-Erstellung fehlgeschlagen", { status: 500 });
  }
}

function wrapText(text: string, font: { widthOfTextAtSize: (text: string, size: number) => number }, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split("\n");

  for (const para of paragraphs) {
    if (para.trim() === "") {
      lines.push("");
      continue;
    }
    const words = para.split(" ");
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, size);
      if (width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
  }

  return lines;
}
