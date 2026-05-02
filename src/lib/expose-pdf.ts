import { PDFDocument, PDFPage, PDFFont, rgb, StandardFonts } from "pdf-lib";

// ── Design tokens from Expose_Reference_Source.html ─────────────────
const W = 595.28;
const H = 841.89;
const M = 51;
const CW = W - 2 * M;

const INK = rgb(15 / 255, 27 / 255, 46 / 255);
const INK_SOFT = rgb(72 / 255, 84 / 255, 104 / 255);
const INK_FAINT = rgb(138 / 255, 146 / 255, 160 / 255);
const ACCENT = rgb(184 / 255, 84 / 255, 50 / 255);
const LINE = rgb(217 / 255, 208 / 255, 190 / 255);
const LINE_SOFT = rgb(231 / 255, 223 / 255, 205 / 255);
const PAPER = rgb(247 / 255, 243 / 255, 234 / 255);
const PAPER_PURE = rgb(251 / 255, 248 / 255, 241 / 255);
const MUTED = rgb(234 / 255, 226 / 255, 206 / 255);
const WHITE = rgb(1, 1, 1);

const FOOTER_Y = 23;
const HEADER_BASE = H - M;
const HEADER_LINE = HEADER_BASE - 16;
const CONTENT_TOP = HEADER_LINE - 22;
const CONTENT_BOTTOM = FOOTER_Y + 20;

type C = ReturnType<typeof rgb>;
interface F { sans: PDFFont; sansBold: PDFFont; serif: PDFFont; serifIt: PDFFont; serifBold: PDFFont }

function wrap(t: string, font: PDFFont, sz: number, maxW: number): string[] {
  const r: string[] = [];
  for (const p of t.split("\n")) {
    if (!p.trim()) { r.push(""); continue; }
    let l = "";
    for (const w of p.split(" ")) {
      const x = l ? `${l} ${w}` : w;
      if (font.widthOfTextAtSize(x, sz) > maxW && l) { r.push(l); l = w; } else l = x;
    }
    if (l) r.push(l);
  }
  return r;
}

function drawBrand(pg: PDFPage, f: F, x: number, y: number, sz: number, clr: C) {
  pg.drawText("DIREKTA", { x, y, size: sz, font: f.sansBold, color: clr });
  pg.drawText(".", { x: x + f.sansBold.widthOfTextAtSize("DIREKTA", sz), y, size: sz, font: f.sansBold, color: ACCENT });
}

function drawPageHeader(pg: PDFPage, f: F, addr: string) {
  drawBrand(pg, f, M, HEADER_BASE, 9, INK);
  const aw = f.sans.widthOfTextAtSize(addr, 7);
  pg.drawText(addr, { x: W - M - aw, y: HEADER_BASE, size: 7, font: f.sans, color: INK_FAINT });
  pg.drawLine({ start: { x: M, y: HEADER_LINE }, end: { x: W - M, y: HEADER_LINE }, thickness: 0.5, color: LINE });
}

function drawPageFooter(pg: PDFPage, f: F, sec: string, num: number, total: number) {
  drawBrand(pg, f, M, FOOTER_Y, 7, INK);
  const sw = f.sans.widthOfTextAtSize(sec, 7);
  pg.drawText(sec, { x: (W - sw) / 2, y: FOOTER_Y, size: 7, font: f.sans, color: INK_FAINT });
  const pn = `${String(num).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
  const pw = f.sans.widthOfTextAtSize(pn, 7);
  pg.drawText(pn, { x: W - M - pw, y: FOOTER_Y, size: 7, font: f.sans, color: INK_FAINT });
}

function drawSectionHead(pg: PDFPage, f: F, num: string, eyebrow: string, title: string, y: number): number {
  pg.drawText(num, { x: M, y, size: 10, font: f.serifIt, color: ACCENT });
  const ey = eyebrow.toUpperCase();
  pg.drawText(ey, { x: W - M - f.sans.widthOfTextAtSize(ey, 7), y: y + 1, size: 7, font: f.sans, color: INK_FAINT });
  y -= 28;
  for (const l of wrap(title, f.serif, 26, CW)) {
    pg.drawText(l, { x: M, y, size: 26, font: f.serif, color: INK });
    y -= 28;
  }
  y -= 4;
  pg.drawLine({ start: { x: M, y }, end: { x: M + 113, y }, thickness: 2, color: ACCENT });
  return y - 18;
}

function energyBadgeColor(cls: string): C {
  const m: Record<string, [number, number, number]> = {
    "A+": [0, 128, 0], A: [79, 168, 79], B: [139, 195, 74], C: [205, 220, 57],
    D: [255, 235, 59], E: [255, 152, 0], F: [255, 87, 34], G: [211, 47, 47], H: [183, 28, 28],
  };
  const c = m[cls] || [128, 128, 128];
  return rgb(c[0] / 255, c[1] / 255, c[2] / 255);
}

function grunderwerbsteuer(postcode: string): { land: string; rate: number } {
  const p = parseInt(postcode.slice(0, 2)) || 0;
  if (p <= 4) return { land: "Sachsen", rate: 5.5 };
  if (p <= 6) return { land: "Sachsen-Anhalt", rate: 5.0 };
  if (p <= 9) return { land: "Thüringen", rate: 5.0 };
  if (p <= 12) return { land: "Berlin", rate: 6.0 };
  if (p <= 16) return { land: "Brandenburg", rate: 6.5 };
  if (p <= 19) return { land: "Mecklenburg-Vorpommern", rate: 6.0 };
  if (p <= 21) return { land: "Hamburg", rate: 5.5 };
  if (p <= 25) return { land: "Schleswig-Holstein", rate: 6.5 };
  if (p <= 27) return { land: "Niedersachsen", rate: 5.0 };
  if (p <= 29) return { land: "Bremen", rate: 5.0 };
  if (p <= 31) return { land: "Niedersachsen", rate: 5.0 };
  if (p <= 33) return { land: "Nordrhein-Westfalen", rate: 6.5 };
  if (p <= 36) return { land: "Hessen", rate: 6.0 };
  if (p <= 38) return { land: "Niedersachsen", rate: 5.0 };
  if (p <= 39) return { land: "Sachsen-Anhalt", rate: 5.0 };
  if (p <= 53) return { land: "Nordrhein-Westfalen", rate: 6.5 };
  if (p <= 56) return { land: "Rheinland-Pfalz", rate: 5.0 };
  if (p <= 59) return { land: "Nordrhein-Westfalen", rate: 6.5 };
  if (p <= 65) return { land: "Hessen", rate: 6.0 };
  if (p <= 66) return { land: "Saarland", rate: 6.5 };
  if (p <= 69) return { land: "Rheinland-Pfalz", rate: 5.0 };
  if (p <= 79) return { land: "Baden-Württemberg", rate: 5.0 };
  if (p <= 87) return { land: "Bayern", rate: 3.5 };
  if (p <= 89) return { land: "Baden-Württemberg", rate: 5.0 };
  if (p <= 97) return { land: "Bayern", rate: 3.5 };
  return { land: "Thüringen", rate: 5.0 };
}

export interface ExposePhoto { bytes: Uint8Array; mimeType: string }

export interface ExposeUnit {
  label: string;
  livingArea: number;
  rooms: number | null;
  bathrooms?: number;
  floor?: number;
  askingPrice?: number;
  titleShort?: string;
  roomProgram?: { name: string; area: number }[];
  photos: ExposePhoto[];
  floorPlans: ExposePhoto[];
}

export interface ExposeData {
  titleShort: string;
  descriptionLong: string;
  address: string;
  city: string;
  propertyType: string;
  livingArea: number;
  rooms: number | null;
  yearBuilt: number | null;
  condition: string;
  askingPrice: number | null;
  priceBand: { low: number; median: number; high: number; confidence: string } | null;
  energy: { class: string; value: number; source: string; type: string; validUntil: string } | null;
  attributes: string[];
  photos: ExposePhoto[];
  floorPlans?: ExposePhoto[];
  generatedAt: string;
  postcode?: string;
  contact?: { name?: string; email?: string; phone?: string };
  locationDescription?: string;
  bathrooms?: number;
  floor?: number;
  plotArea?: number;
  roomProgram?: { name: string; area: number }[];
  highlights?: string[];
  exposeHeadline?: string;
  exposeSubheadline?: string;
  units?: ExposeUnit[];
}

export async function generateExposePdf(data: ExposeData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const f: F = {
    sans: await doc.embedFont(StandardFonts.Helvetica),
    sansBold: await doc.embedFont(StandardFonts.HelveticaBold),
    serif: await doc.embedFont(StandardFonts.TimesRoman),
    serifIt: await doc.embedFont(StandardFonts.TimesRomanItalic),
    serifBold: await doc.embedFont(StandardFonts.TimesRomanBold),
  };

  const shortAddr = data.address.split(",")[0].trim() + " · " + data.city;
  const pages: { pg: PDFPage; sec: string; custom?: boolean }[] = [];
  let secIdx = 0;

  // ════════════════════════════════════════════════════════════ COVER
  {
    const pg = doc.addPage([W, H]);
    pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });
    pages.push({ pg, sec: "", custom: true });

    const heroH = H * 0.6;
    const heroY = H - heroH;

    let heroDrawn = false;
    if (data.photos.length > 0) {
      try {
        const p0 = data.photos[0];
        const img = p0.mimeType.includes("png") ? await doc.embedPng(p0.bytes) : await doc.embedJpg(p0.bytes);
        const s = Math.max(W / img.width, heroH / img.height);
        pg.drawImage(img, {
          x: (W - img.width * s) / 2,
          y: heroY + (heroH - img.height * s) / 2,
          width: img.width * s,
          height: img.height * s,
        });
        heroDrawn = true;
      } catch { /* placeholder fallback */ }
    }
    if (!heroDrawn) {
      pg.drawRectangle({ x: 0, y: heroY, width: W, height: heroH, color: MUTED });
    }

    pg.drawRectangle({ x: 0, y: 0, width: W, height: heroY, color: PAPER });
    pg.drawRectangle({ x: 0, y: H - 42, width: W, height: 42, color: INK, opacity: 0.4 });
    drawBrand(pg, f, 40, H - 28, 11, WHITE);

    const bdg = "EXPOSÉ · VERKAUF";
    const bdgW = f.sans.widthOfTextAtSize(bdg, 7);
    const bdgPx = 11, bdgPy = 5;
    const bdgX = W - 40 - bdgW - 2 * bdgPx;
    const bdgY = H - 28 - bdgPy;
    pg.drawRectangle({ x: bdgX, y: bdgY, width: bdgW + 2 * bdgPx, height: 7 + 2 * bdgPy, borderColor: WHITE, borderWidth: 0.5 });
    pg.drawText(bdg, { x: bdgX + bdgPx, y: bdgY + bdgPy, size: 7, font: f.sans, color: WHITE });

    const cx = 40;
    let cy = heroY - 34;

    pg.drawText(data.propertyType.toUpperCase(), { x: cx, y: cy, size: 8, font: f.sans, color: ACCENT });
    cy -= 24;

    const coverTitle = data.exposeHeadline || data.titleShort;
    for (const l of wrap(coverTitle, f.serif, 30, W - 2 * cx).slice(0, 3)) {
      pg.drawText(l, { x: cx, y: cy, size: 30, font: f.serif, color: INK });
      cy -= 33;
    }
    cy -= 2;

    if (data.exposeSubheadline) {
      pg.drawText(data.exposeSubheadline, { x: cx, y: cy, size: 11, font: f.serifIt, color: INK_SOFT });
      cy -= 18;
    }
    pg.drawText(data.address, { x: cx, y: cy, size: 11, font: f.sansBold, color: INK });
    cy -= 16;
    pg.drawText(data.city, { x: cx, y: cy, size: 11, font: f.sans, color: INK_SOFT });

    const stripTop = 100;
    pg.drawLine({ start: { x: cx, y: stripTop + 22 }, end: { x: W - cx, y: stripTop + 22 }, thickness: 0.5, color: LINE });

    const isBundle = data.units && data.units.length > 0;
    const coverArea = isBundle ? data.units!.reduce((s, u) => s + u.livingArea, 0) : data.livingArea;
    const kf: { l: string; v: string; u?: string }[] = [
      { l: "WOHNFLÄCHE", v: String(Math.round(coverArea * 100) / 100), u: " m²" },
    ];
    if (isBundle) {
      kf.push({ l: "EINHEITEN", v: String(data.units!.length), u: " WE" });
    } else if (data.rooms) {
      kf.push({ l: "ZIMMER", v: String(data.rooms) });
    }
    if (data.yearBuilt) kf.push({ l: "BAUJAHR", v: String(data.yearBuilt) });
    if (data.energy) kf.push({ l: "ENERGIEKLASSE", v: data.energy.class });
    if (kf.length < 4 && data.askingPrice) kf.push({ l: "KAUFPREIS", v: data.askingPrice.toLocaleString("de-DE"), u: " €" });

    const colW = (W - 2 * cx) / Math.max(kf.length, 1);
    for (let i = 0; i < kf.length; i++) {
      const x = cx + i * colW;
      pg.drawText(kf[i].l, { x, y: stripTop + 8, size: 6.5, font: f.sans, color: INK_FAINT });
      pg.drawText(kf[i].v, { x, y: stripTop - 8, size: 14, font: f.serifBold, color: INK });
      if (kf[i].u) {
        const vw = f.serifBold.widthOfTextAtSize(kf[i].v, 14);
        pg.drawText(kf[i].u!, { x: x + vw, y: stripTop - 6, size: 7, font: f.sans, color: INK_SOFT });
      }
      if (i < kf.length - 1) {
        pg.drawLine({ start: { x: x + colW - 6, y: stripTop + 10 }, end: { x: x + colW - 6, y: stripTop - 14 }, thickness: 0.5, color: LINE_SOFT });
      }
    }

    pg.drawText(`Exposé · Stand ${data.generatedAt}`, { x: cx, y: 20, size: 7, font: f.sans, color: INK_FAINT });
    const footR = "www.direkta.de";
    pg.drawText(footR, { x: W - cx - f.sans.widthOfTextAtSize(footR, 7), y: 20, size: 7, font: f.sans, color: INK_FAINT });
  }

  // ════════════════════════════════════════════════════════════ PHOTOS
  const gallery = data.photos.slice(1);
  if (gallery.length > 0) {
    secIdx++;
    const perPage = 6;
    const totalPP = Math.ceil(gallery.length / perPage);
    for (let pi = 0; pi < totalPP; pi++) {
      const pg = doc.addPage([W, H]);
      pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });
      const label = totalPP > 1 ? `Eindrücke (${pi + 1}/${totalPP})` : "Eindrücke";
      pages.push({ pg, sec: label });

      let y: number;
      if (pi === 0) {
        y = drawSectionHead(pg, f, `${String(secIdx).padStart(2, "0")} — Eindrücke`, "Impressionen", "Bilder der Immobilie.", CONTENT_TOP);
      } else {
        y = CONTENT_TOP;
      }

      const cols = 2, rows = 3, gap = 10;
      const cellW = (CW - gap) / cols;
      const avail = y - CONTENT_BOTTOM;
      const cellH = Math.min((avail - (rows - 1) * gap) / rows, 200);
      const startI = pi * perPage;
      const endI = Math.min(startI + perPage, gallery.length);

      for (let i = startI; i < endI; i++) {
        try {
          const photo = gallery[i];
          const img = photo.mimeType.includes("png") ? await doc.embedPng(photo.bytes) : await doc.embedJpg(photo.bytes);
          const pos = i - startI;
          const col = pos % cols;
          const row = Math.floor(pos / cols);
          const cx = M + col * (cellW + gap);
          const cy = y - (row + 1) * cellH - row * gap;
          pg.drawRectangle({ x: cx - 3, y: cy - 3, width: cellW + 6, height: cellH + 6, color: WHITE });
          const s = Math.min(cellW / img.width, cellH / img.height);
          pg.drawImage(img, {
            x: cx + (cellW - img.width * s) / 2,
            y: cy + (cellH - img.height * s) / 2,
            width: img.width * s,
            height: img.height * s,
          });
        } catch { continue; }
      }
    }
  }

  // ════════════════════════════════════════════════════════════ DESCRIPTION + HIGHLIGHTS
  {
    secIdx++;
    let pg = doc.addPage([W, H]);
    pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });
    pages.push({ pg, sec: "Objektbeschreibung" });

    let y = drawSectionHead(pg, f, `${String(secIdx).padStart(2, "0")} — Objektbeschreibung`, "Beschreibung", data.titleShort, CONTENT_TOP);

    // Highlights pull-quote box
    if (data.highlights && data.highlights.length > 0) {
      const items = data.highlights.slice(0, 8);
      const boxH = 28 + items.length * 16;
      pg.drawRectangle({ x: M, y: y - boxH, width: CW, height: boxH, color: PAPER_PURE });
      pg.drawLine({ start: { x: M, y: y - boxH }, end: { x: M, y }, thickness: 3, color: ACCENT });
      pg.drawText("AUF EINEN BLICK", { x: M + 14, y: y - 16, size: 7, font: f.sansBold, color: ACCENT });
      let hy = y - 32;
      for (const h of items) {
        pg.drawLine({ start: { x: M + 14, y: hy + 4 }, end: { x: M + 22, y: hy + 4 }, thickness: 1, color: ACCENT });
        const hLines = wrap(h, f.serif, 9.5, CW - 42);
        for (const hl of hLines) {
          pg.drawText(hl, { x: M + 28, y: hy, size: 9.5, font: f.serif, color: INK });
          hy -= 15;
        }
        hy -= 1;
      }
      y -= boxH + 14;
    }

    const desc = data.descriptionLong.replace(/\r\n/g, "\n");
    const paras = desc.split("\n\n").filter(Boolean);

    if (paras.length > 0) {
      for (const l of wrap(paras[0], f.serif, 12, CW)) {
        if (y < CONTENT_BOTTOM) {
          pg = doc.addPage([W, H]);
          pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });
          pages.push({ pg, sec: "Objektbeschreibung" });
          y = CONTENT_TOP;
        }
        pg.drawText(l, { x: M, y, size: 12, font: f.serif, color: INK });
        y -= 19;
      }
      y -= 8;
    }

    for (let pi = 1; pi < paras.length; pi++) {
      for (const l of wrap(paras[pi], f.sans, 9.5, CW)) {
        if (y < CONTENT_BOTTOM) {
          pg = doc.addPage([W, H]);
          pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });
          pages.push({ pg, sec: "Objektbeschreibung" });
          y = CONTENT_TOP;
        }
        if (l === "") { y -= 8; continue; }
        pg.drawText(l, { x: M, y, size: 9.5, font: f.sans, color: INK });
        y -= 16;
      }
      y -= 8;
    }

    if (data.attributes.length > 0 && y > CONTENT_BOTTOM + 60) {
      y -= 12;
      pg.drawText("AUSSTATTUNG", { x: M, y, size: 7, font: f.sansBold, color: ACCENT });
      y -= 16;
      for (const attr of data.attributes) {
        if (y < CONTENT_BOTTOM) break;
        pg.drawLine({ start: { x: M, y: y + 4 }, end: { x: M + 8.5, y: y + 4 }, thickness: 1, color: ACCENT });
        pg.drawText(attr, { x: M + 17, y, size: 9, font: f.sans, color: INK });
        y -= 16;
        pg.drawLine({ start: { x: M, y: y + 8 }, end: { x: W - M, y: y + 8 }, thickness: 0.3, color: LINE_SOFT });
      }
    }
  }

  // ════════════════════════════════════════════════════════════ LOCATION (conditional)
  if (data.locationDescription) {
    secIdx++;
    let pg = doc.addPage([W, H]);
    pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });
    pages.push({ pg, sec: "Die Lage" });

    let y = drawSectionHead(pg, f, `${String(secIdx).padStart(2, "0")} — Die Lage`, data.city, "Standort und Umgebung.", CONTENT_TOP);

    const locDesc = data.locationDescription.replace(/\r\n/g, "\n");
    const locParas = locDesc.split("\n\n").filter(Boolean);

    if (locParas.length > 0) {
      for (const l of wrap(locParas[0], f.serif, 12, CW)) {
        if (y < CONTENT_BOTTOM) {
          pg = doc.addPage([W, H]);
          pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });
          pages.push({ pg, sec: "Die Lage" });
          y = CONTENT_TOP;
        }
        pg.drawText(l, { x: M, y, size: 12, font: f.serif, color: INK });
        y -= 19;
      }
      y -= 8;
    }

    for (let pi = 1; pi < locParas.length; pi++) {
      for (const l of wrap(locParas[pi], f.sans, 9.5, CW)) {
        if (y < CONTENT_BOTTOM) {
          pg = doc.addPage([W, H]);
          pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });
          pages.push({ pg, sec: "Die Lage" });
          y = CONTENT_TOP;
        }
        if (l === "") { y -= 8; continue; }
        pg.drawText(l, { x: M, y, size: 9.5, font: f.sans, color: INK });
        y -= 16;
      }
      y -= 8;
    }
  }

  // ════════════════════════════════════════════════════════════ MFH: UNIT OVERVIEW + UNIT PAGES + SALES OPTIONS
  if (data.units && data.units.length > 0) {
    // ── Unit comparison table ──
    secIdx++;
    {
      const pg = doc.addPage([W, H]);
      pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });
      pages.push({ pg, sec: "Wohnungsübersicht" });

      let y = drawSectionHead(pg, f, `${String(secIdx).padStart(2, "0")} — Wohnungsübersicht`, "Einheiten", "Die Wohnungen im Überblick.", CONTENT_TOP);

      const cX = [M, M + 100, M + 190, M + 260, M + 350];
      const hdr = ["EINHEIT", "WOHNFLÄCHE", "ZIMMER", "ETAGE", "KAUFPREIS"];
      for (let hi = 0; hi < hdr.length; hi++) pg.drawText(hdr[hi], { x: cX[hi], y, size: 7, font: f.sansBold, color: INK_FAINT });
      y -= 8;
      pg.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: LINE });
      y -= 14;

      let sumArea = 0;
      for (const unit of data.units!) {
        pg.drawText(unit.label, { x: cX[0], y, size: 9.5, font: f.sansBold, color: INK });
        pg.drawText(`${unit.livingArea} m²`, { x: cX[1], y, size: 9, font: f.sans, color: INK });
        pg.drawText(unit.rooms ? String(unit.rooms) : "–", { x: cX[2], y, size: 9, font: f.sans, color: INK });
        const flTxt = unit.floor != null ? (unit.floor === 0 ? "EG" : `${unit.floor}. OG`) : "–";
        pg.drawText(flTxt, { x: cX[3], y, size: 9, font: f.sans, color: INK });
        const prTxt = unit.askingPrice ? `${unit.askingPrice.toLocaleString("de-DE")} €` : "auf Anfrage";
        pg.drawText(prTxt, { x: cX[4], y, size: 9, font: f.serifIt, color: unit.askingPrice ? INK : ACCENT });
        y -= 20;
        pg.drawLine({ start: { x: M, y: y + 8 }, end: { x: W - M, y: y + 8 }, thickness: 0.3, color: LINE_SOFT });
        sumArea += unit.livingArea;
      }

      y -= 4;
      pg.drawLine({ start: { x: M, y: y + 8 }, end: { x: W - M, y: y + 8 }, thickness: 1, color: INK });
      pg.drawRectangle({ x: M, y: y - 10, width: CW, height: 24, color: PAPER_PURE });
      pg.drawText(`Paket · alle ${data.units!.length} WE`, { x: cX[0], y, size: 9.5, font: f.sansBold, color: INK });
      pg.drawText(`${(Math.round(sumArea * 100) / 100)} m²`, { x: cX[1], y, size: 9, font: f.sansBold, color: INK });
      const bpTxt = data.askingPrice ? `${data.askingPrice.toLocaleString("de-DE")} €` : "auf Anfrage";
      pg.drawText(bpTxt, { x: cX[4], y, size: 9.5, font: f.serifBold, color: ACCENT });

      y -= 40;
      pg.drawText("Erwerb einzeln je Einheit oder als Gesamtpaket möglich. Konditionen auf Anfrage.", { x: M, y, size: 8.5, font: f.sans, color: INK_SOFT });
    }

    // ── Individual unit pages ──
    for (let ui = 0; ui < data.units!.length; ui++) {
      const unit = data.units![ui];
      secIdx++;

      // Unit detail page
      {
        const pg = doc.addPage([W, H]);
        pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });
        pages.push({ pg, sec: unit.label });

        let y = drawSectionHead(pg, f,
          `${String(secIdx).padStart(2, "0")} — ${unit.label}`,
          `Einheit ${ui + 1} von ${data.units!.length}`,
          unit.titleShort || `${unit.label} · ${unit.livingArea} m²`,
          CONTENT_TOP,
        );

        // Hero photo
        if (unit.photos.length > 0) {
          try {
            const p0 = unit.photos[0];
            const img = p0.mimeType.includes("png") ? await doc.embedPng(p0.bytes) : await doc.embedJpg(p0.bytes);
            const heroH = 175;
            pg.drawRectangle({ x: M - 2, y: y - heroH - 2, width: CW + 4, height: heroH + 4, color: WHITE });
            const s = Math.min(CW / img.width, heroH / img.height);
            pg.drawImage(img, {
              x: M + (CW - img.width * s) / 2,
              y: y - heroH + (heroH - img.height * s) / 2,
              width: img.width * s,
              height: img.height * s,
            });
            y -= heroH + 12;
          } catch { /* skip */ }
        }

        // Meta strip
        pg.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: LINE });
        const uMeta: { l: string; v: string }[] = [{ l: "WOHNFLÄCHE", v: `${unit.livingArea} m²` }];
        if (unit.rooms) uMeta.push({ l: "ZIMMER", v: String(unit.rooms) });
        if (unit.bathrooms) uMeta.push({ l: "BÄDER", v: String(unit.bathrooms) });
        if (unit.floor != null) uMeta.push({ l: "ETAGE", v: unit.floor === 0 ? "EG" : `${unit.floor}. OG` });
        if (unit.askingPrice) uMeta.push({ l: "PREIS", v: `${unit.askingPrice.toLocaleString("de-DE")} €` });

        const uColW = CW / Math.max(uMeta.length, 1);
        for (let mi = 0; mi < uMeta.length; mi++) {
          const mx = M + mi * uColW;
          pg.drawText(uMeta[mi].l, { x: mx, y: y - 12, size: 6.5, font: f.sans, color: INK_FAINT });
          pg.drawText(uMeta[mi].v, { x: mx, y: y - 26, size: 12, font: f.serifBold, color: INK });
        }
        pg.drawLine({ start: { x: M, y: y - 34 }, end: { x: W - M, y: y - 34 }, thickness: 0.5, color: LINE });
        y -= 52;

        // Two-column: left = description, right = room program
        const halfW = (CW - 16) / 2;
        const rightX = M + halfW + 16;

        if (unit.titleShort) {
          for (const l of wrap(unit.titleShort, f.serif, 10, halfW)) {
            pg.drawText(l, { x: M, y, size: 10, font: f.serif, color: INK });
            y -= 15;
          }
        }

        if (unit.roomProgram && unit.roomProgram.length > 0) {
          let ry = y + (unit.titleShort ? unit.titleShort.length * 0.15 : 0);
          ry = Math.min(ry, y + 15);
          const rpStartY = y + 15;
          pg.drawText("RAUMPROGRAMM", { x: rightX, y: rpStartY, size: 7, font: f.sansBold, color: ACCENT });
          let rpy = rpStartY - 16;
          let uTotal = 0;
          for (const room of unit.roomProgram) {
            pg.drawText(room.name, { x: rightX, y: rpy, size: 8.5, font: f.sans, color: INK_SOFT });
            const aStr = `${room.area.toFixed(2)} m²`;
            const aW = f.serifBold.widthOfTextAtSize(aStr, 9);
            pg.drawText(aStr, { x: W - M - aW, y: rpy, size: 9, font: f.serifBold, color: INK });
            rpy -= 14;
            pg.drawLine({ start: { x: rightX, y: rpy + 5 }, end: { x: W - M, y: rpy + 5 }, thickness: 0.3, color: LINE_SOFT });
            uTotal += room.area;
          }
          rpy -= 2;
          pg.drawLine({ start: { x: rightX, y: rpy + 5 }, end: { x: W - M, y: rpy + 5 }, thickness: 0.8, color: INK });
          rpy -= 2;
          pg.drawText("Gesamt", { x: rightX, y: rpy, size: 8.5, font: f.sansBold, color: INK });
          const tStr = `${uTotal.toFixed(2)} m²`;
          const tW = f.serifBold.widthOfTextAtSize(tStr, 10);
          pg.drawText(tStr, { x: W - M - tW, y: rpy, size: 10, font: f.serifBold, color: INK });
        }
      }

      // Unit floor plans
      for (const fp of unit.floorPlans) {
        const pg = doc.addPage([W, H]);
        pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: WHITE });
        pages.push({ pg, sec: `Grundriss ${unit.label}` });
        let y = CONTENT_TOP;
        pg.drawText(`Grundriss ${unit.label}`, { x: M, y, size: 18, font: f.serifBold, color: INK });
        y -= 30;
        try {
          if (fp.mimeType === "application/pdf") {
            const fpDoc = await PDFDocument.load(fp.bytes);
            const [emb] = await doc.embedPdf(fpDoc, [0]);
            const dims = emb.size();
            const mxW = CW, mxH = y - CONTENT_BOTTOM;
            const s = Math.min(mxW / dims.width, mxH / dims.height, 1);
            pg.drawPage(emb, { x: M + (mxW - dims.width * s) / 2, y: y - dims.height * s, width: dims.width * s, height: dims.height * s });
          } else {
            const img = fp.mimeType.includes("png") ? await doc.embedPng(fp.bytes) : await doc.embedJpg(fp.bytes);
            const mxW = CW, mxH = y - CONTENT_BOTTOM;
            const s = Math.min(mxW / img.width, mxH / img.height, 1);
            pg.drawImage(img, { x: M + (mxW - img.width * s) / 2, y: y - img.height * s, width: img.width * s, height: img.height * s });
          }
        } catch (e) {
          pg.drawText("Grundriss konnte nicht eingebettet werden.", { x: M, y: y - 30, size: 12, font: f.sans, color: INK_SOFT });
          console.error("Unit floor plan embed failed:", e);
        }
      }

      // Unit additional photos
      const unitGallery = unit.photos.slice(1);
      if (unitGallery.length > 0) {
        const perPage = 6;
        const totalPP = Math.ceil(unitGallery.length / perPage);
        for (let pi = 0; pi < totalPP; pi++) {
          const pg = doc.addPage([W, H]);
          pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });
          pages.push({ pg, sec: `${unit.label} Eindrücke` });
          let y = CONTENT_TOP;
          if (pi === 0) { pg.drawText(`${unit.label} — Eindrücke`, { x: M, y, size: 18, font: f.serifBold, color: INK }); y -= 30; }
          const cols = 2, rows = 3, gap = 10;
          const cellW = (CW - gap) / cols;
          const avail = y - CONTENT_BOTTOM;
          const cellH = Math.min((avail - (rows - 1) * gap) / rows, 200);
          const startI = pi * perPage;
          const endI = Math.min(startI + perPage, unitGallery.length);
          for (let i = startI; i < endI; i++) {
            try {
              const photo = unitGallery[i];
              const img = photo.mimeType.includes("png") ? await doc.embedPng(photo.bytes) : await doc.embedJpg(photo.bytes);
              const pos = i - startI;
              const col = pos % cols;
              const row = Math.floor(pos / cols);
              const cx = M + col * (cellW + gap);
              const cy = y - (row + 1) * cellH - row * gap;
              pg.drawRectangle({ x: cx - 3, y: cy - 3, width: cellW + 6, height: cellH + 6, color: WHITE });
              const s = Math.min(cellW / img.width, cellH / img.height);
              pg.drawImage(img, { x: cx + (cellW - img.width * s) / 2, y: cy + (cellH - img.height * s) / 2, width: img.width * s, height: img.height * s });
            } catch { continue; }
          }
        }
      }
    }

    // ── Sales options page ──
    secIdx++;
    {
      const pg = doc.addPage([W, H]);
      pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });
      pages.push({ pg, sec: "Verkaufsoptionen" });

      let y = drawSectionHead(pg, f, `${String(secIdx).padStart(2, "0")} — Verkaufsoptionen`, "Konditionen", "Einzeln oder als Paket.", CONTENT_TOP);

      pg.drawText("Option A — Einzelerwerb", { x: M, y, size: 11, font: f.sansBold, color: INK });
      y -= 18;
      for (const l of wrap("Geeignet für Selbstnutzer, die sich für die Wohnung entscheiden, die zu ihrer Lebenssituation passt. Jeder Einzelerwerber profitiert vom gleichen Standard — keine Abstriche bei Material oder Technik.", f.sans, 9, CW)) {
        pg.drawText(l, { x: M, y, size: 9, font: f.sans, color: INK_SOFT }); y -= 14;
      }
      y -= 12;
      pg.drawText("Option B — Paket-Erwerb", { x: M, y, size: 11, font: f.sansBold, color: INK });
      y -= 18;
      for (const l of wrap("Alle Einheiten als Gesamtpaket. Diversifizierung im selben Objekt, Skalenvorteile bei Verwaltung, Instandhaltung und Vermietung.", f.sans, 9, CW)) {
        pg.drawText(l, { x: M, y, size: 9, font: f.sans, color: INK_SOFT }); y -= 14;
      }
      y -= 16;

      // Price table
      const tX = [M, M + 150];
      pg.drawText("EINHEIT", { x: tX[0], y, size: 7, font: f.sansBold, color: INK_FAINT });
      pg.drawText("WOHNFLÄCHE", { x: tX[1], y, size: 7, font: f.sansBold, color: INK_FAINT });
      const pLbl = "KAUFPREIS";
      pg.drawText(pLbl, { x: W - M - f.sansBold.widthOfTextAtSize(pLbl, 7), y, size: 7, font: f.sansBold, color: INK_FAINT });
      y -= 8;
      pg.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: LINE });
      y -= 16;

      let sumA = 0;
      for (const unit of data.units!) {
        pg.drawText(unit.label, { x: tX[0], y, size: 10, font: f.serifBold, color: INK });
        pg.drawText(`${unit.livingArea} m²`, { x: tX[1], y, size: 9, font: f.sans, color: INK_SOFT });
        const pr = unit.askingPrice ? `${unit.askingPrice.toLocaleString("de-DE")} €` : "auf Anfrage";
        const prW = f.serifIt.widthOfTextAtSize(pr, 10);
        pg.drawText(pr, { x: W - M - prW, y, size: 10, font: f.serifIt, color: ACCENT });
        y -= 22;
        pg.drawLine({ start: { x: M, y: y + 10 }, end: { x: W - M, y: y + 10 }, thickness: 0.3, color: LINE_SOFT });
        sumA += unit.livingArea;
      }

      y -= 4;
      pg.drawLine({ start: { x: M, y: y + 10 }, end: { x: W - M, y: y + 10 }, thickness: 1, color: INK });
      pg.drawRectangle({ x: M, y: y - 8, width: CW, height: 24, color: PAPER_PURE });
      pg.drawText(`Paket · alle ${data.units!.length} WE`, { x: tX[0] + 4, y, size: 10, font: f.serifBold, color: INK });
      pg.drawText(`${(Math.round(sumA * 100) / 100)} m²`, { x: tX[1], y, size: 9, font: f.sansBold, color: INK });
      const bpT = data.askingPrice ? `${data.askingPrice.toLocaleString("de-DE")} €` : "Paketpreis auf Anfrage";
      const bpW = f.serifBold.widthOfTextAtSize(bpT, 10);
      pg.drawText(bpT, { x: W - M - bpW, y, size: 10, font: f.serifBold, color: ACCENT });

      y -= 36;
      if (data.postcode) {
        const ge = grunderwerbsteuer(data.postcode);
        for (const l of wrap(`Käuferprovision, Notar- und Grundbuchkosten, Grunderwerbsteuer (${ge.land}: ${ge.rate.toFixed(1)} %) sind separat zu tragen.`, f.sans, 8.5, CW)) {
          pg.drawText(l, { x: M, y, size: 8.5, font: f.sans, color: INK_SOFT }); y -= 13;
        }
      }
    }
  }

  // ════════════════════════════════════════════════════════════ FACTS + ENERGY + NEBENKOSTEN
  {
    secIdx++;
    const pg = doc.addPage([W, H]);
    pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });
    pages.push({ pg, sec: "Daten & Fakten" });

    let y = drawSectionHead(pg, f, `${String(secIdx).padStart(2, "0")} — Daten & Fakten`, "Eckdaten", "Alle Fakten auf einen Blick.", CONTENT_TOP);

    const isMFH = data.units && data.units.length > 0;
    const factsArea = isMFH ? data.units!.reduce((s, u) => s + u.livingArea, 0) : data.livingArea;
    const factRows: [string, string][] = [
      ["Adresse", `${data.address}, ${data.city}`],
      ["Objekttyp", data.propertyType],
      ["Wohnfläche", `${Math.round(factsArea * 100) / 100} m²`],
    ];
    if (isMFH) {
      factRows.push(["Wohneinheiten", `${data.units!.length}`]);
    }
    if (!isMFH && data.rooms) factRows.push(["Zimmer", String(data.rooms)]);
    if (!isMFH && data.bathrooms) factRows.push(["Badezimmer", String(data.bathrooms)]);
    if (!isMFH && data.floor != null) {
      const ft = data.floor === 0 ? "Erdgeschoss" : data.floor < 0 ? `${Math.abs(data.floor)}. Untergeschoss` : `${data.floor}. Obergeschoss`;
      factRows.push(["Etage", ft]);
    }
    if (data.plotArea) factRows.push(["Grundstücksfläche", `${data.plotArea} m²`]);
    if (data.yearBuilt) factRows.push(["Baujahr", String(data.yearBuilt)]);
    if (data.condition) factRows.push(["Zustand", data.condition]);
    if (data.askingPrice) factRows.push(["Kaufpreis", isMFH ? `${data.askingPrice.toLocaleString("de-DE")} € (Paket)` : `${data.askingPrice.toLocaleString("de-DE")} €`]);
    if (data.priceBand) factRows.push(["Preisempfehlung", `${data.priceBand.low.toLocaleString("de-DE")} – ${data.priceBand.high.toLocaleString("de-DE")} € (${data.priceBand.confidence})`]);

    for (const [label, value] of factRows) {
      pg.drawText(label, { x: M, y, size: 9, font: f.sans, color: INK_SOFT });
      const vLines = wrap(value, f.sansBold, 9, CW - 160);
      for (let vi = 0; vi < vLines.length; vi++) {
        pg.drawText(vLines[vi], { x: M + 160, y: y - vi * 13, size: 9, font: f.sansBold, color: INK });
      }
      y -= Math.max(18, 13 * vLines.length + 6);
      pg.drawLine({ start: { x: M, y: y + 4 }, end: { x: W - M, y: y + 4 }, thickness: 0.3, color: LINE_SOFT });
    }

    // Energy box
    if (data.energy) {
      y -= 24;
      const boxH = 120;
      pg.drawRectangle({ x: M, y: y - boxH, width: CW, height: boxH, color: PAPER_PURE, borderColor: LINE, borderWidth: 0.5 });
      pg.drawText("Pflichtangaben Energieausweis (GEG)", { x: M + 14, y: y - 18, size: 11, font: f.serifBold, color: INK });

      const eRows: [string, string][] = [
        ["Art", data.energy.type === "BEDARF" ? "Bedarfsausweis" : "Verbrauchsausweis"],
        ["Kennwert", `${data.energy.value} kWh/(m²·a)`],
        ["Effizienzklasse", data.energy.class],
        ["Energieträger", data.energy.source],
        ["Gültig bis", data.energy.validUntil],
      ];
      let ey = y - 36;
      for (const [ek, ev] of eRows) {
        pg.drawText(ek, { x: M + 14, y: ey, size: 8.5, font: f.sans, color: INK_SOFT });
        pg.drawText(ev, { x: M + 14 + 120, y: ey, size: 8.5, font: f.sansBold, color: INK });
        ey -= 14;
      }

      const bc = energyBadgeColor(data.energy.class);
      const bx = W - M - 60, by = y - boxH + 14;
      pg.drawRectangle({ x: bx, y: by, width: 46, height: 32, color: bc });
      const cw = f.serifBold.widthOfTextAtSize(data.energy.class, 22);
      pg.drawText(data.energy.class, { x: bx + (46 - cw) / 2, y: by + 8, size: 22, font: f.serifBold, color: WHITE });
      y -= boxH + 10;
    }

    // Nebenkosten box
    if (data.askingPrice && data.postcode) {
      y -= 14;
      const ge = grunderwerbsteuer(data.postcode);
      const notarRate = 2.0;
      const gestAmt = Math.round(data.askingPrice * ge.rate / 100);
      const notarAmt = Math.round(data.askingPrice * notarRate / 100);
      const gesamt = data.askingPrice + gestAmt + notarAmt;

      const nkH = 108;
      pg.drawRectangle({ x: M, y: y - nkH, width: CW, height: nkH, color: PAPER_PURE, borderColor: LINE, borderWidth: 0.5 });
      pg.drawText("Kaufnebenkosten (geschätzt)", { x: M + 14, y: y - 18, size: 11, font: f.serifBold, color: INK });

      const nkRows: [string, string][] = [
        [`Kaufpreis`, `${data.askingPrice.toLocaleString("de-DE")} €`],
        [`Grunderwerbsteuer (${ge.land}, ${ge.rate.toFixed(1)} %)`, `${gestAmt.toLocaleString("de-DE")} €`],
        [`Notar & Grundbuch (ca. ${notarRate.toFixed(1)} %)`, `ca. ${notarAmt.toLocaleString("de-DE")} €`],
      ];
      let ny = y - 36;
      for (const [nk, nv] of nkRows) {
        pg.drawText(nk, { x: M + 14, y: ny, size: 8.5, font: f.sans, color: INK_SOFT });
        const nvW = f.sansBold.widthOfTextAtSize(nv, 8.5);
        pg.drawText(nv, { x: W - M - 14 - nvW, y: ny, size: 8.5, font: f.sansBold, color: INK });
        ny -= 14;
      }
      ny -= 2;
      pg.drawLine({ start: { x: M + 14, y: ny + 8 }, end: { x: W - M - 14, y: ny + 8 }, thickness: 0.5, color: INK });
      const gesamtTxt = `ca. ${gesamt.toLocaleString("de-DE")} €`;
      pg.drawText("Gesamtinvestition", { x: M + 14, y: ny - 4, size: 9, font: f.sansBold, color: INK });
      const gtW = f.serifBold.widthOfTextAtSize(gesamtTxt, 11);
      pg.drawText(gesamtTxt, { x: W - M - 14 - gtW, y: ny - 6, size: 11, font: f.serifBold, color: INK });
      y -= nkH + 10;
    }
  }

  // ════════════════════════════════════════════════════════════ ROOM PROGRAM (conditional)
  if (data.roomProgram && data.roomProgram.length > 0 && !(data.units && data.units.length > 0)) {
    secIdx++;
    const pg = doc.addPage([W, H]);
    pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });
    pages.push({ pg, sec: "Raumprogramm" });

    let y = drawSectionHead(pg, f, `${String(secIdx).padStart(2, "0")} — Raumprogramm`, "Raumaufteilung", "Flächenaufstellung.", CONTENT_TOP);

    let totalArea = 0;
    for (const room of data.roomProgram) {
      pg.drawText(room.name, { x: M, y, size: 9.5, font: f.sans, color: INK_SOFT });
      const areaStr = `${room.area.toFixed(2)} m²`;
      const aW = f.serifBold.widthOfTextAtSize(areaStr, 10);
      pg.drawText(areaStr, { x: W - M - aW, y, size: 10, font: f.serifBold, color: INK });
      y -= 18;
      pg.drawLine({ start: { x: M, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 0.3, color: LINE_SOFT });
      totalArea += room.area;
    }

    y -= 4;
    pg.drawLine({ start: { x: M, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 1, color: INK });
    y -= 2;
    pg.drawText("Wohnfläche gesamt", { x: M, y, size: 9.5, font: f.sansBold, color: INK });
    const totalStr = `${totalArea.toFixed(2)} m²`;
    const tW = f.serifBold.widthOfTextAtSize(totalStr, 12);
    pg.drawText(totalStr, { x: W - M - tW, y, size: 12, font: f.serifBold, color: INK });
  }

  // ════════════════════════════════════════════════════════════ FLOOR PLANS
  if (data.floorPlans && data.floorPlans.length > 0) {
    secIdx++;
    for (let i = 0; i < data.floorPlans.length; i++) {
      const fp = data.floorPlans[i];
      const pg = doc.addPage([W, H]);
      pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: WHITE });
      const label = data.floorPlans.length > 1 ? `Grundriss (${i + 1}/${data.floorPlans.length})` : "Grundriss";
      pages.push({ pg, sec: label });

      let y: number;
      if (i === 0) {
        y = drawSectionHead(pg, f, `${String(secIdx).padStart(2, "0")} — Grundriss`, "Raumaufteilung", "Grundrissdarstellung.", CONTENT_TOP);
      } else {
        y = CONTENT_TOP;
      }

      try {
        if (fp.mimeType === "application/pdf") {
          const fpDoc = await PDFDocument.load(fp.bytes);
          const [emb] = await doc.embedPdf(fpDoc, [0]);
          const dims = emb.size();
          const mxW = CW, mxH = y - CONTENT_BOTTOM;
          const s = Math.min(mxW / dims.width, mxH / dims.height, 1);
          pg.drawPage(emb, { x: M + (mxW - dims.width * s) / 2, y: y - dims.height * s, width: dims.width * s, height: dims.height * s });
        } else {
          const img = fp.mimeType.includes("png") ? await doc.embedPng(fp.bytes) : await doc.embedJpg(fp.bytes);
          const mxW = CW, mxH = y - CONTENT_BOTTOM;
          const s = Math.min(mxW / img.width, mxH / img.height, 1);
          pg.drawImage(img, { x: M + (mxW - img.width * s) / 2, y: y - img.height * s, width: img.width * s, height: img.height * s });
        }
      } catch (e) {
        pg.drawText("Grundriss konnte nicht eingebettet werden.", { x: M, y: y - 30, size: 12, font: f.sans, color: INK_SOFT });
        console.error("Floor plan embed failed:", e);
      }
    }
  }

  // ════════════════════════════════════════════════════════════ CONTACT + LEGAL
  {
    secIdx++;
    const pg = doc.addPage([W, H]);
    pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });
    pages.push({ pg, sec: "Kontakt & Rechtliches" });

    let y = drawSectionHead(pg, f, `${String(secIdx).padStart(2, "0")} — Kontakt`, "Ansprechpartner", "Wir freuen uns auf Ihre Anfrage.", CONTENT_TOP);

    // Dark contact card
    const hasContact = data.contact && (data.contact.name || data.contact.email || data.contact.phone);
    const cardH = 120;
    pg.drawRectangle({ x: M, y: y - cardH, width: CW, height: cardH, color: INK });

    const halfW = CW / 2;
    let cy = y - 20;
    pg.drawText("EIGENTÜMER / VERKAUF", { x: M + 14, y: cy, size: 7, font: f.sans, color: PAPER_PURE, opacity: 0.55 });
    cy -= 22;

    if (hasContact) {
      if (data.contact!.name) {
        pg.drawText(data.contact!.name, { x: M + 14, y: cy, size: 16, font: f.serif, color: PAPER_PURE });
        cy -= 24;
      }
      if (data.contact!.phone) {
        pg.drawText("TELEFON", { x: M + 14, y: cy, size: 7, font: f.sans, color: PAPER_PURE, opacity: 0.5 });
        pg.drawText(data.contact!.phone, { x: M + 14 + 70, y: cy, size: 9, font: f.sans, color: PAPER_PURE, opacity: 0.85 });
        cy -= 16;
      }
      if (data.contact!.email) {
        pg.drawText("E-MAIL", { x: M + 14, y: cy, size: 7, font: f.sans, color: PAPER_PURE, opacity: 0.5 });
        pg.drawText(data.contact!.email, { x: M + 14 + 70, y: cy, size: 9, font: f.sans, color: PAPER_PURE, opacity: 0.85 });
      }
    } else {
      pg.drawText("Kontakt über Direkta", { x: M + 14, y: cy, size: 12, font: f.serif, color: PAPER_PURE });
    }

    // Right side: CTA
    let ry = y - 20;
    pg.drawText("TERMIN VEREINBAREN", { x: M + halfW + 14, y: ry, size: 7, font: f.sans, color: PAPER_PURE, opacity: 0.55 });
    ry -= 22;
    pg.drawText("Besichtigung &", { x: M + halfW + 14, y: ry, size: 16, font: f.serif, color: PAPER_PURE });
    ry -= 20;
    pg.drawText("Konditionen.", { x: M + halfW + 14, y: ry, size: 16, font: f.serif, color: PAPER_PURE });
    ry -= 20;
    const ctaLines = wrap("Für einen Besichtigungstermin oder konkrete Konditionen wenden Sie sich an den genannten Ansprechpartner.", f.sans, 8.5, halfW - 28);
    for (const cl of ctaLines) {
      pg.drawText(cl, { x: M + halfW + 14, y: ry, size: 8.5, font: f.sans, color: PAPER_PURE, opacity: 0.75 });
      ry -= 13;
    }

    y -= cardH + 18;

    // Legal section
    pg.drawText("RECHTLICHE HINWEISE", { x: M, y, size: 7, font: f.sansBold, color: INK });
    y -= 14;

    const legalParagraphs = [
      "Dieses Exposé dient ausschließlich der Information möglicher Kaufinteressenten. Es stellt kein bindendes Angebot dar. Alle Angaben beruhen auf vom Eigentümer bzw. dessen Bevollmächtigten zur Verfügung gestellten Unterlagen. Eine Haftung für Vollständigkeit und Richtigkeit kann nicht übernommen werden. Maßgeblich für einen Erwerb sind ausschließlich die im notariell beurkundeten Kaufvertrag getroffenen Regelungen.",
      "Zwischenverkauf, Irrtum und Änderungen vorbehalten. Die in diesem Exposé verwendeten Abbildungen zeigen den aktuellen oder geplanten Zustand der Immobilie. Tatsächliche Bauausführung kann in Details abweichen.",
      "Gemäß Geldwäschegesetz (GwG) ist der Verkäufer verpflichtet, die Identität des Erwerbers vor Abschluss des Kaufvertrags festzustellen.",
      "Erstellt über die Plattform Direkta. Direkta tritt nicht als Immobilienmakler im Sinne des § 34c GewO auf. Preisempfehlungen sind unverbindliche Schätzungen und stellen keine Bewertungsgutachten dar.",
    ];
    for (const lp of legalParagraphs) {
      for (const l of wrap(lp, f.sans, 7.5, CW)) {
        if (y < CONTENT_BOTTOM) break;
        pg.drawText(l, { x: M, y, size: 7.5, font: f.sans, color: INK_SOFT });
        y -= 11;
      }
      y -= 4;
    }
  }

  // ════════════════════════════════════════════════════════════ BACK COVER
  {
    const pg = doc.addPage([W, H]);
    pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: INK });
    pages.push({ pg, sec: "", custom: true });

    const sz = 22;
    const bw = f.sansBold.widthOfTextAtSize("DIREKTA", sz);
    const dw = f.sansBold.widthOfTextAtSize(".", sz);
    const bx = (W - bw - dw) / 2;
    const by = H / 2 + 20;
    pg.drawText("DIREKTA", { x: bx, y: by, size: sz, font: f.sansBold, color: PAPER_PURE });
    pg.drawText(".", { x: bx + bw, y: by, size: sz, font: f.sansBold, color: ACCENT });

    const rw = 45;
    pg.drawLine({ start: { x: (W - rw) / 2, y: by - 16 }, end: { x: (W + rw) / 2, y: by - 16 }, thickness: 2, color: ACCENT });

    const tag = "Immobilie verkaufen. Direkt.";
    const tw = f.serifIt.widthOfTextAtSize(tag, 11);
    pg.drawText(tag, { x: (W - tw) / 2, y: by - 38, size: 11, font: f.serifIt, color: PAPER_PURE, opacity: 0.7 });

    const btm = `${data.address} · ${data.city} · Exposé · Stand ${data.generatedAt} · www.direkta.de`;
    const btmW = f.sans.widthOfTextAtSize(btm, 7);
    pg.drawText(btm, { x: Math.max((W - btmW) / 2, M), y: 34, size: 7, font: f.sans, color: PAPER_PURE, opacity: 0.4 });
  }

  // ════════════════════════════════════════════════════════════ HEADERS + FOOTERS
  for (let i = 0; i < pages.length; i++) {
    if (pages[i].custom) continue;
    drawPageHeader(pages[i].pg, f, shortAddr);
    drawPageFooter(pages[i].pg, f, pages[i].sec, i + 1, pages.length);
  }

  return Buffer.from(await doc.save());
}
