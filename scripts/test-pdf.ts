/**
 * Standalone PDF test: generates the expose PDF for the Marktstraße 12
 * test property directly via Prisma (bypassing auth).
 *
 * Usage:  npx tsx scripts/test-pdf.ts
 * Output: test_expose.pdf in project root
 */

import { PrismaClient } from "@prisma/client";
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont, PDFImage } from "pdf-lib";
import { readFile, writeFile } from "fs/promises";
import path from "path";

const prisma = new PrismaClient();

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

async function img(pdf: PDFDocument, key: string): Promise<PDFImage | null> {
  try {
    const b = await readFile(path.join(process.cwd(), "public", key));
    return key.toLowerCase().endsWith(".png") ? await pdf.embedPng(b) : await pdf.embedJpg(b);
  } catch { return null; }
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

function sectionHeader(pg: PDFPage, y: number, title: string, bold: PDFFont): number {
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

async function main() {
  const listing = await prisma.listing.findFirst({
    where: { slug: { contains: "gaggenau" } },
    include: { property: { include: { energyCert: true, media: { orderBy: { ordering: "asc" } } } } },
    orderBy: { createdAt: "desc" },
  });

  if (!listing) {
    console.error("No listing found. Run seed-test-property.ts first.");
    process.exit(1);
  }

  const p = listing.property;
  console.log(`Generating PDF for: ${p.street} ${p.houseNumber}, ${p.city}`);
  console.log(`Listing: ${listing.titleShort}`);

  const doc = await PDFDocument.create();
  const R = await doc.embedFont(StandardFonts.Helvetica);
  const B = await doc.embedFont(StandardFonts.HelveticaBold);

  // ── COVER ────────────────────────────────────────────
  const c1 = doc.addPage([W, H]);
  c1.drawRectangle({ x: 0, y: 0, width: W, height: H, color: C.dark });
  // Gradient overlay
  for (let i = 0; i < 25; i++) {
    const s = H * 0.55 / 25;
    c1.drawRectangle({ x: 0, y: i * s, width: W, height: s + 1, color: C.black, opacity: 0.92 - (i / 25) * 0.92 });
  }
  c1.drawRectangle({ x: 0, y: H - 50, width: W, height: 50, color: C.black, opacity: 0.3 });
  c1.drawText("DIREKTA.", { x: PX, y: H - 34, size: 13, font: B, color: C.white });
  c1.drawRectangle({ x: W - PX - 58, y: H - 38, width: 58, height: 20, color: C.accent });
  c1.drawText("EXPOSE", { x: W - PX - 50, y: H - 33, size: 8, font: B, color: C.white });

  let cy = 250;
  if (listing.askingPrice) {
    c1.drawText("EUR " + Number(listing.askingPrice).toLocaleString("de-DE"), { x: PX, y: cy, size: 34, font: B, color: C.white });
    cy -= 48;
  }
  for (const ln of wrap(listing.titleShort || `${p.street} ${p.houseNumber}, ${p.city}`, B, 20, CONTENT_W)) {
    c1.drawText(ln, { x: PX, y: cy, size: 20, font: B, color: C.white });
    cy -= 27;
  }
  cy -= 3;
  c1.drawText([p.street + " " + p.houseNumber, p.postcode + " " + p.city, "Deutschland"].join("  |  "), {
    x: PX, y: cy, size: 9, font: R, color: rgb(0.76, 0.78, 0.82),
  });
  cy -= 42;

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

  // ── ECKDATEN ─────────────────────────────────────────
  const c2 = doc.addPage([W, H]);
  pageHeader(c2, B);
  let y = H - 55;
  y = sectionHeader(c2, y, "Eckdaten", B);

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

  const gCols = 3, gGap = 8, gW = (CONTENT_W - (gCols - 1) * gGap) / gCols;
  grid.forEach(([l, v], i) => {
    const col = i % gCols, row = Math.floor(i / gCols);
    factCard(c2, PX + col * (gW + gGap), y - row * 60, gW, l, v, R, B);
  });
  y -= Math.ceil(grid.length / gCols) * 60 + 30;

  if (p.energyCert) {
    y = sectionHeader(c2, y, "Energieausweis", B);
    const ePairs: [string, string][] = [
      ["Typ", p.energyCert.type === "VERBRAUCH" ? "Verbrauch" : "Bedarf"],
      ["Klasse", p.energyCert.energyClass],
      ["Kennwert", p.energyCert.energyValue + " kWh/(m²a)"],
      ["Quelle", p.energyCert.primarySource],
    ];
    const eCols = ePairs.length, eW = (CONTENT_W - (eCols - 1) * gGap) / eCols;
    ePairs.forEach(([l, v], i) => factCard(c2, PX + i * (eW + gGap), y, eW, l, v, R, B));
    y -= 80;
  }

  const attrs = p.attributes as string[] | null;
  if (attrs && attrs.length > 0) {
    y = sectionHeader(c2, y, "Ausstattung", B);
    const aCols = 2, aW = CONTENT_W / aCols;
    attrs.forEach((a, i) => {
      const col = i % aCols, row = Math.floor(i / aCols);
      c2.drawRectangle({ x: PX + col * aW, y: y - row * 24 + 2, width: 5, height: 5, color: C.accent });
      c2.drawText(a, { x: PX + col * aW + 14, y: y - row * 24, size: 9.5, font: R, color: C.body });
    });
  }

  // ── HIGHLIGHTS ───────────────────────────────────────
  const highlights = listing.highlights as string[] | null;
  if (highlights && highlights.length > 0) {
    const hp = doc.addPage([W, H]);
    pageHeader(hp, B);
    let hy = H - 55;
    hy = sectionHeader(hp, hy, "Highlights", B);

    for (const hl of highlights) {
      if (hy < 80) break;
      hp.drawRectangle({ x: PX + 4, y: hy + 2, width: 6, height: 6, color: C.accent });
      for (const ln of wrap(hl, R, 10, CONTENT_W - 30)) {
        hp.drawText(ln, { x: PX + 20, y: hy, size: 10, font: R, color: C.body });
        hy -= 17;
      }
      hy -= 8;
    }

    if (listing.locationDescription && hy > 200) {
      hy -= 10;
      hy = sectionHeader(hp, hy, "Lage", B);
      for (const ln of wrap(listing.locationDescription, R, 10, CONTENT_W - 8)) {
        if (hy < 80) break;
        if (ln === "") { hy -= 12; continue; }
        hp.drawText(ln, { x: PX + 4, y: hy, size: 10, font: R, color: C.body });
        hy -= 17;
      }
    }

    if (listing.buildingDescription && hy > 200) {
      hy -= 10;
      hy = sectionHeader(hp, hy, "Gebaeude", B);
      for (const ln of wrap(listing.buildingDescription, R, 10, CONTENT_W - 8)) {
        if (hy < 80) break;
        if (ln === "") { hy -= 12; continue; }
        hp.drawText(ln, { x: PX + 4, y: hy, size: 10, font: R, color: C.body });
        hy -= 17;
      }
    }
  }

  // ── DESCRIPTION ──────────────────────────────────────
  if (listing.descriptionLong) {
    const c3 = doc.addPage([W, H]);
    pageHeader(c3, B);
    let dy = H - 55;
    dy = sectionHeader(c3, dy, "Beschreibung", B);
    for (const ln of wrap(listing.descriptionLong, R, 10, CONTENT_W - 8)) {
      if (dy < 70) break;
      if (ln === "") { dy -= 12; continue; }
      c3.drawText(ln, { x: PX + 4, y: dy, size: 10, font: R, color: C.body });
      dy -= 17;
    }
  }

  // ── ROOM PROGRAM ─────────────────────────────────────
  const rooms = p.roomProgram as { name: string; area: number }[] | null;
  if (rooms && rooms.length > 0) {
    const rp = doc.addPage([W, H]);
    pageHeader(rp, B);
    let ry = H - 55;
    ry = sectionHeader(rp, ry, "Raumprogramm", B);

    rp.drawRectangle({ x: PX, y: ry - 2, width: CONTENT_W, height: 20, color: C.card });
    rp.drawText("RAUM", { x: PX + 10, y: ry + 2, size: 7, font: B, color: C.label });
    const flLabel = "FLAECHE";
    rp.drawText(flLabel, { x: W - PX - B.widthOfTextAtSize(flLabel, 7) - 10, y: ry + 2, size: 7, font: B, color: C.label });
    ry -= 26;

    let totalArea = 0;
    for (const room of rooms) {
      if (ry < 90) break;
      rp.drawText(room.name, { x: PX + 10, y: ry, size: 9.5, font: R, color: C.body });
      const aStr = room.area.toFixed(2) + " m²";
      rp.drawText(aStr, { x: W - PX - R.widthOfTextAtSize(aStr, 9.5) - 10, y: ry, size: 9.5, font: R, color: C.body });
      totalArea += room.area;
      ry -= 6;
      rp.drawRectangle({ x: PX + 10, y: ry + 2, width: CONTENT_W - 20, height: 0.3, color: C.rule });
      ry -= 18;
    }

    rp.drawRectangle({ x: PX, y: ry + 14, width: CONTENT_W, height: 0.8, color: C.heading });
    ry -= 4;
    rp.drawText("GESAMT", { x: PX + 10, y: ry, size: 9.5, font: B, color: C.heading });
    const tStr = totalArea.toFixed(2) + " m²";
    rp.drawText(tStr, { x: W - PX - B.widthOfTextAtSize(tStr, 9.5) - 10, y: ry, size: 9.5, font: B, color: C.accent });
    console.log(`  Room program: ${rooms.length} rooms, total ${totalArea.toFixed(2)} m²`);
  }

  // ── SPECIFICATIONS ───────────────────────────────────
  const specs = p.specifications as Record<string, Record<string, string>> | null;
  if (specs && Object.keys(specs).length > 0) {
    let sp = doc.addPage([W, H]);
    pageHeader(sp, B);
    let sy = H - 55;
    sy = sectionHeader(sp, sy, "Ausstattung im Detail", B);

    let catCount = 0;
    for (const [cat, entries] of Object.entries(specs)) {
      if (!entries || Object.keys(entries).length === 0) continue;
      catCount++;

      const rowCount = Object.keys(entries).length;
      if (sy - (30 + rowCount * 22) < 80) {
        sp = doc.addPage([W, H]);
        pageHeader(sp, B);
        sy = H - 55;
      }

      sp.drawRectangle({ x: PX, y: sy - 4, width: CONTENT_W, height: 22, color: C.card });
      sp.drawRectangle({ x: PX, y: sy - 4, width: 3, height: 22, color: C.accent });
      sp.drawText(cat.toUpperCase(), { x: PX + 14, y: sy, size: 8, font: B, color: C.heading });
      sy -= 30;

      for (const [key, value] of Object.entries(entries)) {
        if (sy < 80) {
          sp = doc.addPage([W, H]);
          pageHeader(sp, B);
          sy = H - 55;
        }
        sp.drawText(key, { x: PX + 14, y: sy, size: 8.5, font: B, color: C.label });
        const valLines = wrap(value, R, 8.5, CONTENT_W * 0.48);
        for (let vi = 0; vi < valLines.length; vi++) {
          sp.drawText(valLines[vi], { x: PX + CONTENT_W * 0.44, y: sy - vi * 14, size: 8.5, font: R, color: C.body });
        }
        sy -= Math.max(valLines.length, 1) * 14 + 8;
      }
      sy -= 12;
    }
    console.log(`  Specifications: ${catCount} categories`);
  }

  // ── BUILDING INFO ────────────────────────────────────
  const bInfo = p.buildingInfo as Record<string, string> | null;
  if (bInfo && Object.keys(bInfo).length > 0) {
    const bp = doc.addPage([W, H]);
    pageHeader(bp, B);
    let by = H - 55;
    by = sectionHeader(bp, by, "Gebaeude-Informationen", B);

    const biEntries = Object.entries(bInfo);
    const biCols = 2;
    const biColW = (CONTENT_W - 20) / biCols;

    biEntries.forEach(([k, v], i) => {
      const col = i % biCols;
      const row = Math.floor(i / biCols);
      const bx = PX + col * (biColW + 20);
      const bey = by - row * 46;

      bp.drawText(k.toUpperCase(), { x: bx, y: bey + 12, size: 7, font: B, color: C.label });
      const vLines = wrap(String(v), R, 9.5, biColW - 4);
      vLines.forEach((ln, li) => {
        bp.drawText(ln, { x: bx, y: bey - li * 14, size: 9.5, font: R, color: C.body });
      });
    });
    console.log(`  Building info: ${biEntries.length} entries`);
  }

  // ── BACK COVER ───────────────────────────────────────
  const bc = doc.addPage([W, H]);
  bc.drawRectangle({ x: 0, y: 0, width: W, height: H, color: C.dark });
  center(bc, "DIREKTA.", H / 2 + 30, 40, B, C.white);
  bc.drawRectangle({ x: (W - 45) / 2, y: H / 2 + 20, width: 45, height: 2.5, color: C.accent });
  center(bc, "Immobilie verkaufen. Direkt.", H / 2 - 6, 11, R, C.faint);
  center(bc, "www.direkta.de", H / 2 - 32, 9, R, C.label);
  center(bc, "Alle Angaben ohne Gewaehr. Preisempfehlungen sind unverbindlich.", 50, 6.5, R, rgb(0.3, 0.35, 0.45));

  // Footers
  const all = doc.getPages();
  const contentCount = all.length - 2;
  all.forEach((pg, i) => { if (i > 0 && i < all.length - 1) pageFooter(pg, R, i, contentCount); });

  const bytes = await doc.save();
  const outPath = path.join(process.cwd(), "test_expose.pdf");
  await writeFile(outPath, bytes);
  console.log(`\nPDF saved: ${outPath} (${all.length} pages, ${(bytes.length / 1024).toFixed(0)} KB)`);
}

main()
  .catch((e) => { console.error("FAILED:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
