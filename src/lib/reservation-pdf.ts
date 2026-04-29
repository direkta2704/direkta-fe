import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const W = 595.28;
const H = 841.89;
const PX = 56;
const CW = W - 2 * PX;

const INK = rgb(15 / 255, 27 / 255, 46 / 255);
const SOFT = rgb(72 / 255, 84 / 255, 104 / 255);
const ACCENT = rgb(184 / 255, 84 / 255, 50 / 255);
const FAINT = rgb(138 / 255, 146 / 255, 160 / 255);
const LINE = rgb(217 / 255, 208 / 255, 190 / 255);
const BG = rgb(247 / 255, 243 / 255, 234 / 255);
const WHITE = rgb(1, 1, 1);

function wrap(t: string, f: { widthOfTextAtSize: (t: string, s: number) => number }, s: number, w: number): string[] {
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

interface ReservationData {
  transactionId: string;
  date: string;
  sellerName: string;
  sellerEmail: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  propertyAddress: string;
  propertyType: string;
  propertyArea: number;
  propertyRooms?: number;
  purchasePrice: string;
  purchasePriceNum: number;
  conditions?: string;
  desiredClosingDate?: string;
}

export async function generateReservationPdf(data: ReservationData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const R = await doc.embedFont(StandardFonts.Helvetica);
  const B = await doc.embedFont(StandardFonts.HelveticaBold);

  const TYPES: Record<string, string> = {
    ETW: "Eigentumswohnung", EFH: "Einfamilienhaus", MFH: "Mehrfamilienhaus",
    DHH: "Doppelhaushaelfte", RH: "Reihenhaus", GRUNDSTUECK: "Grundstueck",
  };

  // ═══════════════════════════════════════════
  //  PAGE 1 — Header + Parties + Property
  // ═══════════════════════════════════════════
  let pg = doc.addPage([W, H]);
  let y = H - 50;

  // Top accent bar
  pg.drawRectangle({ x: 0, y: H - 4, width: W, height: 4, color: ACCENT });

  // Logo
  pg.drawText("DIREKTA.", { x: PX, y, size: 8, font: B, color: INK });
  const refText = `Ref: ${data.transactionId.slice(0, 12).toUpperCase()}`;
  pg.drawText(refText, { x: W - PX - R.widthOfTextAtSize(refText, 7), y: y + 1, size: 7, font: R, color: FAINT });
  y -= 8;
  pg.drawRectangle({ x: PX, y, width: CW, height: 0.5, color: LINE });
  y -= 40;

  // Title
  pg.drawText("Reservierungsvereinbarung", { x: PX, y, size: 22, font: B, color: INK });
  y -= 18;
  pg.drawRectangle({ x: PX, y: y + 2, width: 40, height: 2, color: ACCENT });
  y -= 14;
  pg.drawText("Unverbindliche Kaufabsichtserklaerung", { x: PX, y, size: 10, font: R, color: SOFT });
  y -= 10;
  pg.drawText(`Datum: ${data.date}`, { x: PX, y, size: 9, font: R, color: FAINT });
  y -= 35;

  // ── Section: Vertragsparteien ──
  pg.drawRectangle({ x: PX, y: y + 1, width: 3, height: 14, color: ACCENT });
  pg.drawText("VERTRAGSPARTEIEN", { x: PX + 12, y: y + 2, size: 10, font: B, color: INK });
  y -= 30;

  // Seller box
  const boxH = 60;
  const halfW = (CW - 16) / 2;
  pg.drawRectangle({ x: PX, y: y - boxH, width: halfW, height: boxH, color: BG });
  pg.drawText("VERKAEUFER", { x: PX + 12, y: y - 16, size: 7, font: B, color: FAINT });
  pg.drawText(data.sellerName, { x: PX + 12, y: y - 32, size: 10, font: B, color: INK });
  pg.drawText(data.sellerEmail, { x: PX + 12, y: y - 46, size: 8, font: R, color: SOFT });

  // Buyer box
  const bx = PX + halfW + 16;
  pg.drawRectangle({ x: bx, y: y - boxH, width: halfW, height: boxH, color: BG });
  pg.drawText("KAEUFER", { x: bx + 12, y: y - 16, size: 7, font: B, color: FAINT });
  pg.drawText(data.buyerName, { x: bx + 12, y: y - 32, size: 10, font: B, color: INK });
  pg.drawText(data.buyerEmail, { x: bx + 12, y: y - 46, size: 8, font: R, color: SOFT });
  y -= boxH + 30;

  // ── Section: Kaufobjekt ──
  pg.drawRectangle({ x: PX, y: y + 1, width: 3, height: 14, color: ACCENT });
  pg.drawText("KAUFOBJEKT", { x: PX + 12, y: y + 2, size: 10, font: B, color: INK });
  y -= 28;

  const propRows: [string, string][] = [
    ["Adresse", data.propertyAddress],
    ["Immobilientyp", TYPES[data.propertyType] || data.propertyType],
    ["Wohnflaeche", `${data.propertyArea} m²`],
  ];
  if (data.propertyRooms) propRows.push(["Zimmer", String(data.propertyRooms)]);

  for (const [label, value] of propRows) {
    pg.drawText(label.toUpperCase(), { x: PX + 4, y, size: 7, font: B, color: FAINT });
    pg.drawText(value, { x: PX + 140, y, size: 9, font: R, color: INK });
    y -= 6;
    pg.drawRectangle({ x: PX + 4, y: y + 2, width: CW - 8, height: 0.3, color: LINE });
    y -= 16;
  }
  y -= 10;

  // ── Section: Kaufpreis ──
  pg.drawRectangle({ x: PX, y: y + 1, width: 3, height: 14, color: ACCENT });
  pg.drawText("KAUFPREIS", { x: PX + 12, y: y + 2, size: 10, font: B, color: INK });
  y -= 30;

  pg.drawRectangle({ x: PX, y: y - 36, width: CW, height: 48, color: BG });
  pg.drawText("VEREINBARTER KAUFPREIS", { x: PX + 16, y: y - 12, size: 7, font: B, color: FAINT });
  pg.drawText(`EUR ${data.purchasePrice}`, { x: PX + 16, y: y - 30, size: 18, font: B, color: ACCENT });
  y -= 56;

  if (data.conditions) {
    pg.drawText("BEDINGUNGEN", { x: PX + 4, y, size: 7, font: B, color: FAINT });
    y -= 14;
    for (const line of wrap(data.conditions, R, 9, CW - 16)) {
      pg.drawText(line, { x: PX + 4, y, size: 9, font: R, color: SOFT });
      y -= 14;
    }
    y -= 8;
  }

  if (data.desiredClosingDate) {
    pg.drawText("GEWUENSCHTER NOTARTERMIN", { x: PX + 4, y, size: 7, font: B, color: FAINT });
    y -= 14;
    pg.drawText(data.desiredClosingDate, { x: PX + 4, y, size: 9, font: R, color: INK });
    y -= 24;
  }

  // ── Section: Reservierungsbedingungen ──
  y -= 10;
  pg.drawRectangle({ x: PX, y: y + 1, width: 3, height: 14, color: ACCENT });
  pg.drawText("RESERVIERUNGSBEDINGUNGEN", { x: PX + 12, y: y + 2, size: 10, font: B, color: INK });
  y -= 28;

  const clauses = [
    "Der Verkaeufer verpflichtet sich, die Immobilie fuer einen Zeitraum von 14 Tagen ab Datum dieser Vereinbarung fuer den Kaeufer zu reservieren und in dieser Zeit keinem Dritten zu verkaufen.",
    "Der Kaeufer verpflichtet sich, innerhalb der Reservierungsfrist einen Notartermin zu vereinbaren und die fuer den Kaufvertrag erforderlichen Unterlagen bereitzustellen.",
    "Diese Reservierungsvereinbarung ist keine rechtsverbindliche Kaufzusage. Der Kaufvertrag kommt erst durch notarielle Beurkundung zustande.",
    "Beide Parteien koennen von dieser Vereinbarung jederzeit ohne Angabe von Gruenden zuruecktreten. Ein Schadensersatzanspruch entsteht daraus nicht.",
  ];

  clauses.forEach((clause, i) => {
    if (y < 80) {
      pg = doc.addPage([W, H]);
      pg.drawRectangle({ x: 0, y: H - 4, width: W, height: 4, color: ACCENT });
      pg.drawText("DIREKTA.", { x: PX, y: H - 30, size: 8, font: B, color: INK });
      pg.drawRectangle({ x: PX, y: H - 36, width: CW, height: 0.5, color: LINE });
      y = H - 70;
    }
    pg.drawText(`${i + 1}.`, { x: PX + 4, y, size: 9, font: B, color: ACCENT });
    for (const line of wrap(clause, R, 9, CW - 30)) {
      pg.drawText(line, { x: PX + 20, y, size: 9, font: R, color: SOFT });
      y -= 14;
    }
    y -= 8;
  });

  // ═══════════════════════════════════════════
  //  PAGE 2 — Notary Checklist + Signatures
  // ═══════════════════════════════════════════
  pg = doc.addPage([W, H]);
  pg.drawRectangle({ x: 0, y: H - 4, width: W, height: 4, color: ACCENT });
  pg.drawText("DIREKTA.", { x: PX, y: H - 30, size: 8, font: B, color: INK });
  pg.drawRectangle({ x: PX, y: H - 36, width: CW, height: 0.5, color: LINE });
  y = H - 70;

  // ── Section: Notar-Checkliste ──
  pg.drawRectangle({ x: PX, y: y + 1, width: 3, height: 14, color: ACCENT });
  pg.drawText("NOTAR-CHECKLISTE", { x: PX + 12, y: y + 2, size: 10, font: B, color: INK });
  y -= 8;
  pg.drawText("Erforderliche Unterlagen fuer den Notartermin", { x: PX + 12, y, size: 8, font: R, color: FAINT });
  y -= 24;

  const checklist = [
    "Grundbuchauszug (aktuell, nicht aelter als 3 Monate)",
    "Flurkarte / Lageplan",
    "Teilungserklaerung (bei Wohnungseigentum)",
    "Energieausweis (gueltig)",
    "Wohnflaechenberechnung",
    "Nebenkostenabrechnungen (letzte 3 Jahre)",
    "Protokolle der Eigentuemer&shy;versammlungen (letzte 3 Jahre, bei WEG)",
    "Personalausweis oder Reisepass (Verkaeufer + Kaeufer)",
    "Finanzierungsbestaetigung des Kaeufers",
    "Ggf. Vollmacht (bei Vertretung)",
  ];

  checklist.forEach((item) => {
    pg.drawRectangle({ x: PX + 8, y: y - 1, width: 10, height: 10, color: WHITE });
    pg.drawRectangle({ x: PX + 8, y: y - 1, width: 10, height: 10, borderColor: LINE, borderWidth: 0.8, color: rgb(0, 0, 0), opacity: 0 });
    const lines = wrap(item.replace("&shy;", ""), R, 9, CW - 40);
    lines.forEach((line, li) => {
      pg.drawText(line, { x: PX + 26, y: y - li * 13, size: 9, font: R, color: SOFT });
    });
    y -= Math.max(lines.length, 1) * 13 + 8;
  });

  y -= 30;

  // ── Section: Unterschriften ──
  pg.drawRectangle({ x: PX, y: y + 1, width: 3, height: 14, color: ACCENT });
  pg.drawText("UNTERSCHRIFTEN", { x: PX + 12, y: y + 2, size: 10, font: B, color: INK });
  y -= 50;

  // Seller signature
  pg.drawRectangle({ x: PX, y, width: halfW, height: 0.8, color: INK });
  pg.drawText("Ort, Datum", { x: PX, y: y - 14, size: 7, font: R, color: FAINT });
  pg.drawText(data.sellerName, { x: PX, y: y - 26, size: 8, font: B, color: INK });
  pg.drawText("Verkaeufer", { x: PX, y: y - 38, size: 7, font: R, color: FAINT });

  // Buyer signature
  pg.drawRectangle({ x: bx, y, width: halfW, height: 0.8, color: INK });
  pg.drawText("Ort, Datum", { x: bx, y: y - 14, size: 7, font: R, color: FAINT });
  pg.drawText(data.buyerName, { x: bx, y: y - 26, size: 8, font: B, color: INK });
  pg.drawText("Kaeufer", { x: bx, y: y - 38, size: 7, font: R, color: FAINT });

  y -= 70;

  // Legal notice
  pg.drawRectangle({ x: PX, y: y - 40, width: CW, height: 50, color: BG });
  pg.drawText("RECHTLICHER HINWEIS", { x: PX + 12, y: y - 8, size: 7, font: B, color: FAINT });
  const legalText = "Diese Reservierungsvereinbarung ist kein rechtsverbindlicher Kaufvertrag. Der Eigentuemerwechsel erfolgt ausschliesslich durch notarielle Beurkundung gemaess § 311b BGB. Alle Angaben ohne Gewaehr.";
  let ly = y - 22;
  for (const line of wrap(legalText, R, 7.5, CW - 24)) {
    pg.drawText(line, { x: PX + 12, y: ly, size: 7.5, font: R, color: FAINT });
    ly -= 11;
  }

  // Footer
  pg.drawRectangle({ x: PX, y: 46, width: CW, height: 0.4, color: LINE });
  pg.drawText("DIREKTA.  |  www.direkta.de  |  Reservierungsvereinbarung", { x: PX, y: 34, size: 6.5, font: R, color: FAINT });

  // First page footer too
  const pages = doc.getPages();
  pages[0].drawRectangle({ x: PX, y: 46, width: CW, height: 0.4, color: LINE });
  pages[0].drawText("DIREKTA.  |  www.direkta.de  |  Reservierungsvereinbarung", { x: PX, y: 34, size: 6.5, font: R, color: FAINT });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
