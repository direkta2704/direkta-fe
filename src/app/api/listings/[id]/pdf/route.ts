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
      include: {
        property: {
          include: {
            energyCert: true,
            media: { orderBy: { ordering: "asc" } },
            units: {
              orderBy: { unitLabel: "asc" },
              include: {
                media: { orderBy: { ordering: "asc" } },
                energyCert: true,
              },
            },
          },
        },
        priceRecommendation: true,
      },
    });
    if (!listing) return new Response("Not found", { status: 404 });

    const p = listing.property;
    const photos = p.media.filter(m => m.kind === "PHOTO");
    const floors = p.media.filter(m => m.kind === "FLOORPLAN");
    const units = p.units || [];
    const isBundle = units.length > 0;
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
    const cf: [string, string][] = isBundle
      ? [
          [String(units.length), "Wohnungen"],
          [p.livingArea + " m²", "Gesamtflaeche"],
          [p.yearBuilt ? String(p.yearBuilt) : "-", "Baujahr"],
          [CONDITIONS[p.condition] || p.condition, "Zustand"],
        ]
      : [
          [p.livingArea + " m²", "Wohnflaeche"],
          [p.rooms ? String(p.rooms) : "-", "Zimmer"],
          [p.yearBuilt ? String(p.yearBuilt) : "-", "Baujahr"],
          [CONDITIONS[p.condition] || p.condition, "Zustand"],
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
    if (isBundle) grid.push(["Wohneinheiten", String(units.length)]);
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

    // Section: Energieausweis (visual scale)
    if (p.energyCert) {
      y = section(c2, y, "Energieausweis", B);

      const eClasses = ["A+", "A", "B", "C", "D", "E", "F", "G", "H"];
      const eColors: [number, number, number][] = [
        [0, 130, 59], [26, 150, 65], [85, 178, 71], [166, 217, 106],
        [217, 239, 139], [254, 224, 139], [253, 174, 97], [244, 109, 67], [215, 48, 39],
      ];
      const barW = (CONTENT_W - (eClasses.length - 1) * 2) / eClasses.length;
      const barH = 22;

      eClasses.forEach((cls, i) => {
        const bx = PX + i * (barW + 2);
        const isActive = cls === p.energyCert!.energyClass;
        const [r, g, b] = eColors[i];
        const h = isActive ? barH + 6 : barH;
        const by = isActive ? y - 3 : y;

        c2.drawRectangle({ x: bx, y: by, width: barW, height: h, color: rgb(r / 255, g / 255, b / 255) });
        const labelW = B.widthOfTextAtSize(cls, isActive ? 9 : 7);
        c2.drawText(cls, {
          x: bx + (barW - labelW) / 2,
          y: by + (h - (isActive ? 9 : 7)) / 2,
          size: isActive ? 9 : 7,
          font: B,
          color: C.white,
        });

        if (isActive) {
          const ax = bx + barW / 2;
          c2.drawRectangle({ x: ax - 3, y: by - 7, width: 6, height: 6, color: C.heading });
        }
      });
      y -= barH + 22;

      // Energy data row
      const eInfo = [
        p.energyCert.type === "VERBRAUCH" ? "Verbrauchsausweis" : "Bedarfsausweis",
        `${p.energyCert.energyValue} kWh/(m²·a)`,
        p.energyCert.primarySource,
        `Bj. ${p.yearBuilt || "k.A."}`,
      ].join("  ·  ");
      c2.drawText(eInfo, { x: PX + 4, y: y, size: 8, font: R, color: C.body });
      y -= 30;
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
    //  HIGHLIGHTS PAGE
    // ====================================================
    const highlights = listing.highlights as string[] | null;
    if (highlights && highlights.length > 0) {
      const hp = doc.addPage([W, H]);
      pageHeader(hp, B);
      let hy = H - 55;

      hy = section(hp, hy, "Highlights", B);

      for (const hl of highlights) {
        if (hy < 80) break;
        hp.drawRectangle({ x: PX + 4, y: hy + 2, width: 6, height: 6, color: C.accent });
        for (const ln of wrap(hl, R, 10, CONTENT_W - 30)) {
          hp.drawText(ln, { x: PX + 20, y: hy, size: 10, font: R, color: C.body });
          hy -= 17;
        }
        hy -= 8;
      }

      // Location description below highlights if space
      if (listing.locationDescription && hy > 200) {
        hy -= 10;
        hy = section(hp, hy, "Lage", B);
        for (const ln of wrap(listing.locationDescription, R, 10, CONTENT_W - 8)) {
          if (hy < 80) break;
          if (ln === "") { hy -= 12; continue; }
          hp.drawText(ln, { x: PX + 4, y: hy, size: 10, font: R, color: C.body });
          hy -= 17;
        }
      }

      // Building description if space
      if (listing.buildingDescription && hy > 200) {
        hy -= 10;
        hy = section(hp, hy, "Gebaeude", B);
        for (const ln of wrap(listing.buildingDescription, R, 10, CONTENT_W - 8)) {
          if (hy < 80) break;
          if (ln === "") { hy -= 12; continue; }
          hp.drawText(ln, { x: PX + 4, y: hy, size: 10, font: R, color: C.body });
          hy -= 17;
        }
      }
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
    //  ROOM PROGRAM PAGE
    // ====================================================
    const rooms = p.roomProgram as { name: string; area: number }[] | null;
    if (rooms && rooms.length > 0) {
      const rp = doc.addPage([W, H]);
      pageHeader(rp, B);
      let ry = H - 55;

      ry = section(rp, ry, "Raumprogramm", B);

      // Table header
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

      // Total row
      rp.drawRectangle({ x: PX, y: ry + 14, width: CONTENT_W, height: 0.8, color: C.heading });
      ry -= 4;
      rp.drawText("GESAMT", { x: PX + 10, y: ry, size: 9.5, font: B, color: C.heading });
      const tStr = totalArea.toFixed(2) + " m²";
      rp.drawText(tStr, { x: W - PX - B.widthOfTextAtSize(tStr, 9.5) - 10, y: ry, size: 9.5, font: B, color: C.accent });
    }

    // ====================================================
    //  SPECIFICATIONS PAGE(S)
    // ====================================================
    const specs = p.specifications as Record<string, Record<string, string>> | null;
    if (specs && Object.keys(specs).length > 0) {
      let sp = doc.addPage([W, H]);
      pageHeader(sp, B);
      let sy = H - 55;
      sy = section(sp, sy, "Ausstattung im Detail", B);

      for (const [cat, entries] of Object.entries(specs)) {
        if (!entries || Object.keys(entries).length === 0) continue;

        const rowCount = Object.keys(entries).length;
        if (sy - (30 + rowCount * 22) < 80) {
          sp = doc.addPage([W, H]);
          pageHeader(sp, B);
          sy = H - 55;
        }

        // Category header bar
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
    }

    // ====================================================
    //  BUILDING INFO PAGE
    // ====================================================
    const bInfo = p.buildingInfo as Record<string, string> | null;
    if (bInfo && Object.keys(bInfo).length > 0) {
      const bp = doc.addPage([W, H]);
      pageHeader(bp, B);
      let by = H - 55;

      by = section(bp, by, "Gebaeude-Informationen", B);

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
    }

    // ====================================================
    //  UNIT OVERVIEW PAGE (bundle only)
    // ====================================================
    if (isBundle) {
      const up = doc.addPage([W, H]);
      pageHeader(up, B);
      let uy = H - 55;

      uy = section(up, uy, "Wohnungsuebersicht", B);

      // Summary text
      const sumText = `${units.length} Wohneinheiten · ${p.livingArea} m² Gesamtwohnflaeche`;
      up.drawText(sumText, { x: PX + 4, y: uy, size: 10, font: R, color: C.body });
      uy -= 30;

      // Table header
      up.drawRectangle({ x: PX, y: uy - 2, width: CONTENT_W, height: 22, color: C.card });
      const cols = [
        { label: "WOHNUNG", x: PX + 10, w: 100 },
        { label: "FLAECHE", x: PX + 130, w: 70 },
        { label: "ZIMMER", x: PX + 220, w: 60 },
        { label: "BAD", x: PX + 290, w: 60 },
        { label: "ETAGE", x: PX + 360, w: 60 },
      ];
      for (const col of cols) {
        up.drawText(col.label, { x: col.x, y: uy + 2, size: 7, font: B, color: C.label });
      }
      uy -= 28;

      for (const unit of units) {
        if (uy < 100) break;
        up.drawText(unit.unitLabel || "Wohnung", { x: cols[0].x, y: uy, size: 9.5, font: B, color: C.heading });
        up.drawText(`${unit.livingArea} m²`, { x: cols[1].x, y: uy, size: 9.5, font: R, color: C.body });
        up.drawText(unit.rooms ? String(unit.rooms) : "-", { x: cols[2].x, y: uy, size: 9.5, font: R, color: C.body });
        up.drawText(unit.bathrooms ? String(unit.bathrooms) : "-", { x: cols[3].x, y: uy, size: 9.5, font: R, color: C.body });
        up.drawText(unit.floor != null ? `${unit.floor}. OG` : "EG", { x: cols[4].x, y: uy, size: 9.5, font: R, color: C.body });
        uy -= 6;
        up.drawRectangle({ x: PX + 10, y: uy + 2, width: CONTENT_W - 20, height: 0.3, color: C.rule });
        uy -= 22;
      }

      // Attributes
      const unitAttrs = p.attributes as string[] | null;
      if (unitAttrs && unitAttrs.length > 0 && uy > 150) {
        uy -= 10;
        up.drawText("GEMEINSAME AUSSTATTUNG", { x: PX + 4, y: uy, size: 7, font: B, color: C.label });
        uy -= 18;
        const attrCols = 3;
        const attrW = CONTENT_W / attrCols;
        unitAttrs.forEach((a, i) => {
          const col = i % attrCols;
          const row = Math.floor(i / attrCols);
          const ax = PX + col * attrW;
          const ay = uy - row * 18;
          up.drawRectangle({ x: ax + 4, y: ay + 2, width: 4, height: 4, color: C.accent });
          up.drawText(a, { x: ax + 14, y: ay, size: 8.5, font: R, color: C.body });
        });
      }
    }

    // ====================================================
    //  PER-UNIT DETAIL PAGES (bundle only)
    //  Each unit: key facts + room program + floor plan on same page
    // ====================================================
    if (isBundle) {
      for (const unit of units) {
        const unitFloors = unit.media.filter((m: { kind: string }) => m.kind === "FLOORPLAN");
        const unitPhotos = unit.media.filter((m: { kind: string }) => m.kind === "PHOTO");
        const unitRooms = unit.roomProgram as { name: string; area: number }[] | null;
        const imageFloor = unitFloors.find((m: { storageKey: string }) => !m.storageKey.toLowerCase().endsWith(".pdf"));
        const pdfFloors = unitFloors.filter((m: { storageKey: string }) => m.storageKey.toLowerCase().endsWith(".pdf"));

        // ── Page 1: Key Facts + Floor Plan ──
        const unitPage = doc.addPage([W, H]);
        pageHeader(unitPage, B);
        let uy = H - 55;

        uy = section(unitPage, uy, unit.unitLabel || "Wohnung", B);

        // Key facts row
        const ufacts: [string, string][] = [
          ["Wohnflaeche", `${unit.livingArea} m²`],
          ["Zimmer", unit.rooms ? String(unit.rooms) : "-"],
          ["Badezimmer", unit.bathrooms ? String(unit.bathrooms) : "-"],
          ["Etage", unit.floor != null ? `${unit.floor}. OG` : "EG"],
          ["Zustand", CONDITIONS[unit.condition] || unit.condition],
        ];
        const ufCols = ufacts.length;
        const ufW = (CONTENT_W - (ufCols - 1) * gGap) / ufCols;
        ufacts.forEach(([l, v], i) => factCard(unitPage, PX + i * (ufW + gGap), uy, ufW, l, v, R, B));
        uy -= 80;

        // Floor plan image embedded on the same page
        if (imageFloor) {
          unitPage.drawText("GRUNDRISS", { x: PX + 4, y: uy, size: 7, font: B, color: C.label });
          uy -= 14;

          const fpImg = await img(doc, imageFloor.storageKey);
          if (fpImg) {
            const mw = CONTENT_W - 20;
            const mh = uy - 70;
            const sc = Math.min(mw / fpImg.width, mh / fpImg.height, 1);
            const iw = fpImg.width * sc;
            const ih = fpImg.height * sc;
            unitPage.drawImage(fpImg, { x: PX + (CONTENT_W - iw) / 2, y: uy - ih, width: iw, height: ih });
            uy -= ih + 20;
          }
        }

        // Room program — fits below floor plan if space, otherwise new page
        if (unitRooms && unitRooms.length > 0) {
          const roomsHeight = unitRooms.length * 21 + 50;
          let rPage = unitPage;
          let ry = uy;

          if (ry - roomsHeight < 70) {
            rPage = doc.addPage([W, H]);
            pageHeader(rPage, B);
            ry = H - 55;
            ry = section(rPage, ry, `${unit.unitLabel || "Wohnung"} — Raumprogramm`, B);
          } else {
            rPage.drawText("RAUMPROGRAMM", { x: PX + 4, y: ry, size: 7, font: B, color: C.label });
            ry -= 18;
          }

          let totalA = 0;
          for (const room of unitRooms) {
            if (ry < 90) break;
            rPage.drawText(room.name, { x: PX + 10, y: ry, size: 9, font: R, color: C.body });
            const aStr = room.area.toFixed(2) + " m²";
            rPage.drawText(aStr, { x: W - PX - R.widthOfTextAtSize(aStr, 9) - 10, y: ry, size: 9, font: R, color: C.body });
            totalA += room.area;
            ry -= 5;
            rPage.drawRectangle({ x: PX + 10, y: ry + 2, width: CONTENT_W - 20, height: 0.3, color: C.rule });
            ry -= 16;
          }
          rPage.drawRectangle({ x: PX + 10, y: ry + 12, width: CONTENT_W - 20, height: 0.6, color: C.heading });
          ry -= 2;
          rPage.drawText("GESAMT", { x: PX + 10, y: ry, size: 9, font: B, color: C.heading });
          const tStr = totalA.toFixed(2) + " m²";
          rPage.drawText(tStr, { x: W - PX - B.widthOfTextAtSize(tStr, 9) - 10, y: ry, size: 9, font: B, color: C.accent });
        }

        // PDF floor plans as embedded pages
        for (const pf of pdfFloors) {
          for (const cp of await pdfPages(doc, pf.storageKey)) doc.addPage(cp);
        }

        // Unit photos (max 4, 2x2 grid)
        if (unitPhotos.length > 0) {
          const pp = doc.addPage([W, H]);
          pageHeader(pp, B);
          let py = H - 55;
          py = section(pp, py, `Impressionen — ${unit.unitLabel || "Wohnung"}`, B);

          const half = (CONTENT_W - 10) / 2;
          for (let j = 0; j < Math.min(unitPhotos.length, 4); j++) {
            const pi = await img(doc, unitPhotos[j].storageKey);
            if (pi) {
              const col = j % 2;
              const row = Math.floor(j / 2);
              const ih = Math.min(half * (pi.height / pi.width), 200);
              pp.drawImage(pi, { x: PX + col * (half + 10), y: py - row * (ih + 12) - ih, width: half, height: ih });
            }
          }
        }
      }
    }

    // ====================================================
    //  FLOOR PLAN PAGE(S) — building level
    // ====================================================
    for (const fp of floors) {
      if (fp.storageKey.toLowerCase().endsWith(".pdf")) {
        for (const cp of await pdfPages(doc, fp.storageKey)) doc.addPage(cp);
      } else {
        const pg = doc.addPage([W, H]);
        pageHeader(pg, B);
        let fy = H - 55;
        fy = section(pg, fy, isBundle ? "Grundriss — Gebaeude" : "Grundriss", B);

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
