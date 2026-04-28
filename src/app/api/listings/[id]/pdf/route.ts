import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont, PDFImage } from "pdf-lib";
import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

// ─── Design Tokens ──────────────────────────────────
const C = {
  accent:  rgb(236/255, 91/255, 19/255),
  dark:    rgb(15/255, 23/255, 42/255),
  heading: rgb(15/255, 23/255, 42/255),
  body:    rgb(51/255, 65/255, 85/255),
  label:   rgb(100/255, 116/255, 139/255),
  faint:   rgb(148/255, 163/255, 184/255),
  card:    rgb(245/255, 247/255, 250/255),
  rule:    rgb(226/255, 232/255, 240/255),
  white:   rgb(1, 1, 1),
  black:   rgb(0, 0, 0),
};
const W = 595.28;
const H = 841.89;
const PX = 52;
const CONTENT_W = W - 2 * PX;

const TYPES: Record<string, string> = {
  ETW: "Eigentumswohnung", EFH: "Einfamilienhaus", MFH: "Mehrfamilienhaus",
  DHH: "Doppelhaushaelfte", RH: "Reihenhaus", GRUNDSTUECK: "Grundstueck",
};
const CONDITIONS: Record<string, string> = {
  ERSTBEZUG: "Erstbezug", NEUBAU: "Neubau", GEPFLEGT: "Gepflegt",
  RENOVIERUNGS_BEDUERFTIG: "Renovierungsbedarf", SANIERUNGS_BEDUERFTIG: "Sanierungsbedarf", ROHBAU: "Rohbau",
};

// ─── Helpers ────────────────────────────────────────
async function img(pdf: PDFDocument, key: string): Promise<PDFImage | null> {
  try {
    const b = await readFile(path.join(process.cwd(), "public", key));
    return key.toLowerCase().endsWith(".png") ? await pdf.embedPng(b) : await pdf.embedJpg(b);
  } catch { return null; }
}

async function pdfPages(pdf: PDFDocument, key: string) {
  try {
    const b = await readFile(path.join(process.cwd(), "public", key));
    const s = await PDFDocument.load(b); return await pdf.copyPages(s, s.getPageIndices());
  } catch { return []; }
}

function wrap(t: string, f: PDFFont, s: number, w: number): string[] {
  const r: string[] = [];
  for (const p of t.split("\n")) {
    if (!p.trim()) { r.push(""); continue; }
    let l = "";
    for (const word of p.split(" ")) {
      const x = l ? `${l} ${word}` : word;
      if (f.widthOfTextAtSize(x, s) > w && l) { r.push(l); l = word; } else l = x;
    }
    if (l) r.push(l);
  }
  return r;
}

function center(pg: PDFPage, t: string, y: number, s: number, fo: PDFFont, c: ReturnType<typeof rgb>) {
  pg.drawText(t, { x: (W - fo.widthOfTextAtSize(t, s)) / 2, y, size: s, font: fo, color: c });
}

// ─── Reusable Components ────────────────────────────

function pageHeader(pg: PDFPage, bold: PDFFont) {
  pg.drawRectangle({ x: 0, y: H - 4, width: W, height: 4, color: C.accent });
  pg.drawText("DIREKTA.", { x: PX, y: H - 28, size: 8, font: bold, color: C.heading });
  pg.drawRectangle({ x: PX, y: H - 34, width: CONTENT_W, height: 0.4, color: C.rule });
}

function pageFooter(pg: PDFPage, reg: PDFFont, num: number, total: number) {
  pg.drawRectangle({ x: PX, y: 48, width: CONTENT_W, height: 0.4, color: C.rule });
  pg.drawText("DIREKTA.  |  www.direkta.de  |  Ohne Provision", { x: PX, y: 34, size: 6.5, font: reg, color: C.faint });
  const p = `${num} / ${total}`;
  pg.drawText(p, { x: W - PX - reg.widthOfTextAtSize(p, 6.5), y: 34, size: 6.5, font: reg, color: C.faint });
}

function section(pg: PDFPage, y: number, title: string, bold: PDFFont): number {
  pg.drawRectangle({ x: PX, y: y + 1, width: 3, height: 14, color: C.accent });
  pg.drawText(title.toUpperCase(), { x: PX + 12, y: y + 2, size: 10, font: bold, color: C.heading });
  return y - 30;
}

function factCard(pg: PDFPage, x: number, y: number, w: number, label: string, value: string, reg: PDFFont, bold: PDFFont) {
  const h = 52;
  pg.drawRectangle({ x, y, width: w, height: h, color: C.card });
  pg.drawText(label.toUpperCase(), { x: x + 12, y: y + h - 18, size: 6.5, font: bold, color: C.label });
  pg.drawText(value, { x: x + 12, y: y + 12, size: 13, font: bold, color: C.heading });
}

// ─── Main ───────────────────────────────────────────

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;
    void req;

    const listing = await prisma.listing.findFirst({
      where: { id, property: { userId: user.id } },
      include: { property: { include: { energyCert: true, media: { orderBy: { ordering: "asc" } } } }, priceRecommendation: true },
    });
    if (!listing) return new Response("Not found", { status: 404 });

    const p = listing.property;
    const photos = p.media.filter(m => m.kind === "PHOTO");
    const floors = p.media.filter(m => m.kind === "FLOORPLAN");
    const doc = await PDFDocument.create();
    const R = await doc.embedFont(StandardFonts.Helvetica);
    const B = await doc.embedFont(StandardFonts.HelveticaBold);

    // ====================================================
    //  COVER
    // ====================================================
    const c1 = doc.addPage([W, H]);

    if (photos.length > 0) {
      const hero = await img(doc, photos[0].storageKey);
      if (hero) {
        const sc = Math.max(W / hero.width, H / hero.height);
        c1.drawImage(hero, { x: (W - hero.width * sc) / 2, y: (H - hero.height * sc) / 2, width: hero.width * sc, height: hero.height * sc });
      }
    } else {
      c1.drawRectangle({ x: 0, y: 0, width: W, height: H, color: C.dark });
    }

    // Gradient overlay bottom 50%
    for (let i = 0; i < 25; i++) {
      const s = H * 0.55 / 25;
      c1.drawRectangle({ x: 0, y: i * s, width: W, height: s + 1, color: C.black, opacity: 0.92 - (i / 25) * 0.92 });
    }
    // Subtle top tint
    c1.drawRectangle({ x: 0, y: H - 50, width: W, height: 50, color: C.black, opacity: 0.3 });

    // Logo
    c1.drawText("DIREKTA.", { x: PX, y: H - 34, size: 13, font: B, color: C.white });
    // Badge
    c1.drawRectangle({ x: W - PX - 58, y: H - 38, width: 58, height: 20, color: C.accent });
    c1.drawText("EXPOSE", { x: W - PX - 50, y: H - 33, size: 8, font: B, color: C.white });

    let cy = 250;

    // Price
    if (listing.askingPrice) {
      c1.drawText("EUR " + Number(listing.askingPrice).toLocaleString("de-DE"), { x: PX, y: cy, size: 34, font: B, color: C.white });
      cy -= 48;
    }

    // Title
    for (const ln of wrap(listing.titleShort || `${p.street} ${p.houseNumber}, ${p.city}`, B, 20, CONTENT_W)) {
      c1.drawText(ln, { x: PX, y: cy, size: 20, font: B, color: C.white });
      cy -= 27;
    }
    cy -= 3;

    // Address
    c1.drawText([p.street + " " + p.houseNumber, p.postcode + " " + p.city, "Deutschland"].join("  |  "), {
      x: PX, y: cy, size: 9, font: R, color: rgb(0.76, 0.78, 0.82),
    });
    cy -= 42;

    // Bottom facts
    const cf: [string, string][] = [
      [p.livingArea + " m²", "Wohnflaeche"],
      [p.rooms ? String(p.rooms) : "-", "Zimmer"],
      [p.yearBuilt ? String(p.yearBuilt) : "-", "Baujahr"],
      [CONDITIONS[p.condition] || p.condition, "Zustand"],
      [p.energyCert?.energyClass || "-", "Energie"],
    ];
    const fw = CONTENT_W / cf.length;
    cf.forEach(([v, l], i) => {
      c1.drawText(v, { x: PX + i * fw, y: cy, size: 14, font: B, color: C.white });
      c1.drawText(l.toUpperCase(), { x: PX + i * fw, y: cy - 14, size: 6, font: R, color: rgb(0.55, 0.58, 0.65) });
      if (i < cf.length - 1) c1.drawRectangle({ x: PX + (i + 1) * fw - 6, y: cy - 18, width: 0.5, height: 36, color: C.white, opacity: 0.15 });
    });

    // ====================================================
    //  ECKDATEN PAGE
    // ====================================================
    const c2 = doc.addPage([W, H]);
    pageHeader(c2, B);
    let y = H - 55;

    // Section: Eckdaten
    y = section(c2, y, "Eckdaten", B);

    const grid: [string, string][] = [
      ["Immobilientyp", TYPES[p.type] || p.type],
      ["Wohnflaeche", p.livingArea + " m²"],
      ["Zimmer", p.rooms ? String(p.rooms) : "-"],
      ["Badezimmer", p.bathrooms ? String(p.bathrooms) : "-"],
      ["Baujahr", p.yearBuilt ? String(p.yearBuilt) : "-"],
      ["Zustand", CONDITIONS[p.condition] || p.condition],
    ];
    if (p.plotArea) grid.push(["Grundstueck", p.plotArea + " m²"]);
    if (p.floor != null) grid.push(["Etage", String(p.floor)]);

    const gCols = 3;
    const gGap = 8;
    const gW = (CONTENT_W - (gCols - 1) * gGap) / gCols;
    grid.forEach(([l, v], i) => {
      const col = i % gCols;
      const row = Math.floor(i / gCols);
      factCard(c2, PX + col * (gW + gGap), y - row * 60, gW, l, v, R, B);
    });
    y -= Math.ceil(grid.length / gCols) * 60 + 30;

    // Section: Energieausweis
    if (p.energyCert) {
      y = section(c2, y, "Energieausweis", B);
      const ePairs: [string, string][] = [
        ["Typ", p.energyCert.type === "VERBRAUCH" ? "Verbrauch" : "Bedarf"],
        ["Klasse", p.energyCert.energyClass],
        ["Kennwert", p.energyCert.energyValue + " kWh/(m²a)"],
        ["Quelle", p.energyCert.primarySource],
      ];
      const eCols = ePairs.length;
      const eW = (CONTENT_W - (eCols - 1) * gGap) / eCols;
      ePairs.forEach(([l, v], i) => factCard(c2, PX + i * (eW + gGap), y, eW, l, v, R, B));
      y -= 80;
    }

    // Section: Ausstattung
    const attrs = p.attributes as string[] | null;
    if (attrs && attrs.length > 0) {
      y = section(c2, y, "Ausstattung", B);
      const aCols = 2;
      const aW = CONTENT_W / aCols;
      attrs.forEach((a, i) => {
        const col = i % aCols;
        const row = Math.floor(i / aCols);
        const ax = PX + col * aW;
        const ay = y - row * 24;
        // Orange square bullet
        c2.drawRectangle({ x: ax, y: ay + 2, width: 5, height: 5, color: C.accent });
        c2.drawText(a, { x: ax + 14, y: ay, size: 9.5, font: R, color: C.body });
      });
    }

    // ====================================================
    //  DESCRIPTION PAGE
    // ====================================================
    if (listing.descriptionLong) {
      const c3 = doc.addPage([W, H]);
      pageHeader(c3, B);
      let dy = H - 55;

      dy = section(c3, dy, "Beschreibung", B);

      for (const ln of wrap(listing.descriptionLong, R, 10, CONTENT_W - 8)) {
        if (dy < 70) break;
        if (ln === "") { dy -= 12; continue; }
        c3.drawText(ln, { x: PX + 4, y: dy, size: 10, font: R, color: C.body });
        dy -= 17;
      }
    }

    // ====================================================
    //  FLOOR PLAN PAGE(S) — image only, no raw data
    // ====================================================
    for (const fp of floors) {
      if (fp.storageKey.toLowerCase().endsWith(".pdf")) {
        for (const cp of await pdfPages(doc, fp.storageKey)) doc.addPage(cp);
      } else {
        const pg = doc.addPage([W, H]);
        pageHeader(pg, B);
        let fy = H - 55;
        fy = section(pg, fy, "Grundriss", B);

        const image = await img(doc, fp.storageKey);
        if (image) {
          const mw = CONTENT_W - 30;
          const mh = fy - 80;
          const sc = Math.min(mw / image.width, mh / image.height, 1);
          const iw = image.width * sc;
          const ih = image.height * sc;
          pg.drawImage(image, { x: PX + (CONTENT_W - iw) / 2, y: fy - ih, width: iw, height: ih });
        }
      }
    }

    // ====================================================
    //  PHOTO GALLERY
    // ====================================================
    if (photos.length > 1) {
      // Page 1: one large + two half-width
      const gp = doc.addPage([W, H]);
      pageHeader(gp, B);
      let gy = H - 55;
      gy = section(gp, gy, "Impressionen", B);

      const p1 = photos[1] ? await img(doc, photos[1].storageKey) : null;
      if (p1) {
        const ih = Math.min(CONTENT_W * (p1.height / p1.width), 260);
        gp.drawImage(p1, { x: PX, y: gy - ih, width: CONTENT_W, height: ih });
        gy -= ih + 12;
      }

      const half = (CONTENT_W - 10) / 2;
      for (let j = 0; j < 2; j++) {
        if (2 + j >= photos.length) break;
        const pi = await img(doc, photos[2 + j].storageKey);
        if (pi) {
          const ih = Math.min(half * (pi.height / pi.width), 200);
          gp.drawImage(pi, { x: PX + j * (half + 10), y: gy - ih, width: half, height: ih });
        }
      }

      // Remaining photos
      for (let i = 4; i < photos.length; i += 2) {
        const pp = doc.addPage([W, H]);
        pageHeader(pp, B);
        let py = H - 50;
        for (let j = 0; j < 2 && i + j < photos.length; j++) {
          const pi = await img(doc, photos[i + j].storageKey);
          if (pi) {
            const ih = Math.min(CONTENT_W * (pi.height / pi.width), 340);
            pp.drawImage(pi, { x: PX, y: py - ih, width: CONTENT_W, height: ih });
            py -= ih + 18;
          }
        }
      }
    }

    // ====================================================
    //  BACK COVER
    // ====================================================
    const bc = doc.addPage([W, H]);
    bc.drawRectangle({ x: 0, y: 0, width: W, height: H, color: C.dark });
    center(bc, "DIREKTA.", H / 2 + 30, 40, B, C.white);
    bc.drawRectangle({ x: (W - 45) / 2, y: H / 2 + 20, width: 45, height: 2.5, color: C.accent });
    center(bc, "Immobilie verkaufen. Direkt.", H / 2 - 6, 11, R, C.faint);
    center(bc, "www.direkta.de", H / 2 - 32, 9, R, C.label);
    center(bc, "Alle Angaben ohne Gewaehr. Preisempfehlungen sind unverbindlich.", 50, 6.5, R, rgb(0.3, 0.35, 0.45));

    // ─── Footers on content pages (skip cover + back) ───
    const all = doc.getPages();
    const contentCount = all.length - 2;
    all.forEach((pg, i) => { if (i > 0 && i < all.length - 1) pageFooter(pg, R, i, contentCount); });

    const bytes = await doc.save();
    const fn = `Expose_${p.street}_${p.houseNumber}_${p.city}.pdf`.replace(/\s+/g, "_");

    return new Response(Buffer.from(bytes), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${fn}"` },
    });
  } catch (err) {
    console.error("PDF error:", err);
    return new Response("PDF-Erstellung fehlgeschlagen", { status: 500 });
  }
}
