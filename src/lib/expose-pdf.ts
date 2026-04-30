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

export interface ExposeKeyFact {
  label: string;
  value: string;
}

export interface ExposePhoto {
  bytes: Uint8Array;
  mimeType: string;
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
  generatedAt: string;
}

// Designed Exposé PDF (F-M5-09): cover, photos, description, key facts, GEG fields.
// Branded layout matching the reservation PDF palette.
export async function generateExposePdf(data: ExposeData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const R = await doc.embedFont(StandardFonts.Helvetica);
  const B = await doc.embedFont(StandardFonts.HelveticaBold);

  // ─── Cover page ────────────────────────────────────────────────────────
  const cover = doc.addPage([W, H]);
  cover.drawRectangle({ x: 0, y: 0, width: W, height: H, color: BG });
  cover.drawRectangle({ x: 0, y: H - 8, width: W, height: 8, color: ACCENT });

  cover.drawText("DIREKTA", { x: PX, y: H - 80, size: 14, font: B, color: INK });
  cover.drawText("Exposé", { x: PX, y: H - 100, size: 11, font: R, color: SOFT });

  const titleLines = wrap(data.titleShort, B, 32, CW);
  let yCover = H / 2 + 60;
  for (const line of titleLines.slice(0, 3)) {
    cover.drawText(line, { x: PX, y: yCover, size: 32, font: B, color: INK });
    yCover -= 40;
  }

  cover.drawLine({ start: { x: PX, y: yCover - 10 }, end: { x: PX + 80, y: yCover - 10 }, thickness: 2, color: ACCENT });
  yCover -= 40;
  cover.drawText(data.address, { x: PX, y: yCover, size: 14, font: R, color: SOFT });
  yCover -= 20;
  cover.drawText(data.city, { x: PX, y: yCover, size: 14, font: B, color: INK });

  // Quick facts on cover
  const facts: ExposeKeyFact[] = [
    { label: "Typ", value: data.propertyType },
    { label: "Wohnfläche", value: `${data.livingArea} m²` },
  ];
  if (data.rooms) facts.push({ label: "Zimmer", value: String(data.rooms) });
  if (data.yearBuilt) facts.push({ label: "Baujahr", value: String(data.yearBuilt) });
  if (data.askingPrice) facts.push({ label: "Preis", value: `${data.askingPrice.toLocaleString("de-DE")} €` });
  if (data.energy) facts.push({ label: "Energie", value: `${data.energy.class} (${data.energy.value} kWh)` });

  let yFacts = 220;
  for (let i = 0; i < facts.length; i += 2) {
    const left = facts[i];
    const right = facts[i + 1];
    if (left) {
      cover.drawText(left.label.toUpperCase(), { x: PX, y: yFacts, size: 8, font: B, color: FAINT });
      cover.drawText(left.value, { x: PX, y: yFacts - 14, size: 14, font: B, color: INK });
    }
    if (right) {
      cover.drawText(right.label.toUpperCase(), { x: PX + CW / 2, y: yFacts, size: 8, font: B, color: FAINT });
      cover.drawText(right.value, { x: PX + CW / 2, y: yFacts - 14, size: 14, font: B, color: INK });
    }
    yFacts -= 50;
  }

  cover.drawText(`Erstellt am ${data.generatedAt}`, { x: PX, y: 60, size: 9, font: R, color: FAINT });

  // ─── Photos page (up to 6 photos in a 2x3 grid) ────────────────────────
  if (data.photos.length > 0) {
    const photoPage = doc.addPage([W, H]);
    photoPage.drawText("Eindrücke", { x: PX, y: H - 80, size: 22, font: B, color: INK });
    photoPage.drawLine({ start: { x: PX, y: H - 95 }, end: { x: PX + 60, y: H - 95 }, thickness: 2, color: ACCENT });

    const cols = 2;
    const rows = 3;
    const gap = 12;
    const cellW = (CW - gap) / cols;
    const cellH = (H - 200 - 2 * gap) / rows;

    for (let i = 0; i < Math.min(6, data.photos.length); i++) {
      const photo = data.photos[i];
      let img;
      try {
        img = photo.mimeType.includes("png") ? await doc.embedPng(photo.bytes) : await doc.embedJpg(photo.bytes);
      } catch {
        continue;
      }
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = PX + col * (cellW + gap);
      const y = H - 130 - (row + 1) * cellH - row * gap;
      const scale = Math.min(cellW / img.width, cellH / img.height);
      const dW = img.width * scale;
      const dH = img.height * scale;
      photoPage.drawImage(img, {
        x: x + (cellW - dW) / 2,
        y: y + (cellH - dH) / 2,
        width: dW,
        height: dH,
      });
    }
  }

  // ─── Description page ─────────────────────────────────────────────────
  const descPage = doc.addPage([W, H]);
  descPage.drawText("Beschreibung", { x: PX, y: H - 80, size: 22, font: B, color: INK });
  descPage.drawLine({ start: { x: PX, y: H - 95 }, end: { x: PX + 60, y: H - 95 }, thickness: 2, color: ACCENT });

  const descLines = wrap(data.descriptionLong, R, 11, CW);
  let yDesc = H - 130;
  for (const line of descLines) {
    if (yDesc < 100) {
      // overflow: new page
      const cont = doc.addPage([W, H]);
      cont.drawText("Beschreibung (Fortsetzung)", { x: PX, y: H - 80, size: 18, font: B, color: INK });
      yDesc = H - 110;
    }
    if (line === "") {
      yDesc -= 10;
      continue;
    }
    descPage.drawText(line, { x: PX, y: yDesc, size: 11, font: R, color: INK });
    yDesc -= 16;
  }

  // ─── Key facts + GEG page ─────────────────────────────────────────────
  const factsPage = doc.addPage([W, H]);
  factsPage.drawText("Daten & Fakten", { x: PX, y: H - 80, size: 22, font: B, color: INK });
  factsPage.drawLine({ start: { x: PX, y: H - 95 }, end: { x: PX + 60, y: H - 95 }, thickness: 2, color: ACCENT });

  const allFacts: ExposeKeyFact[] = [
    { label: "Adresse", value: `${data.address}, ${data.city}` },
    { label: "Typ", value: data.propertyType },
    { label: "Wohnfläche", value: `${data.livingArea} m²` },
  ];
  if (data.rooms) allFacts.push({ label: "Zimmer", value: String(data.rooms) });
  if (data.yearBuilt) allFacts.push({ label: "Baujahr", value: String(data.yearBuilt) });
  if (data.condition) allFacts.push({ label: "Zustand", value: data.condition });
  if (data.attributes.length > 0) allFacts.push({ label: "Ausstattung", value: data.attributes.join(", ") });
  if (data.askingPrice) allFacts.push({ label: "Kaufpreis", value: `${data.askingPrice.toLocaleString("de-DE")} €` });
  if (data.priceBand) allFacts.push({ label: "Preisband", value: `${data.priceBand.low.toLocaleString("de-DE")} – ${data.priceBand.high.toLocaleString("de-DE")} € (${data.priceBand.confidence})` });

  let yFact = H - 130;
  for (const f of allFacts) {
    factsPage.drawText(f.label.toUpperCase(), { x: PX, y: yFact, size: 8, font: B, color: FAINT });
    const valueLines = wrap(f.value, R, 11, CW - 140);
    for (let i = 0; i < valueLines.length; i++) {
      factsPage.drawText(valueLines[i], { x: PX + 140, y: yFact - i * 14, size: 11, font: R, color: INK });
    }
    yFact -= Math.max(20, 14 * valueLines.length + 8);
    factsPage.drawLine({ start: { x: PX, y: yFact + 4 }, end: { x: W - PX, y: yFact + 4 }, thickness: 0.5, color: LINE });
  }

  // GEG section
  if (data.energy) {
    yFact -= 30;
    factsPage.drawRectangle({ x: PX, y: yFact - 100, width: CW, height: 100, color: WHITE, borderColor: LINE, borderWidth: 1 });
    factsPage.drawText("Pflichtangaben Energieausweis (GEG)", { x: PX + 16, y: yFact - 24, size: 11, font: B, color: INK });
    const energyFacts = [
      `Typ: ${data.energy.type === "BEDARF" ? "Bedarfsausweis" : "Verbrauchsausweis"}`,
      `Energieklasse: ${data.energy.class}`,
      `Energiekennwert: ${data.energy.value} kWh/(m²·a)`,
      `Wesentlicher Energieträger: ${data.energy.source}`,
      `Gültig bis: ${data.energy.validUntil}`,
    ];
    let yE = yFact - 42;
    for (const ef of energyFacts) {
      factsPage.drawText(ef, { x: PX + 16, y: yE, size: 10, font: R, color: SOFT });
      yE -= 14;
    }
  }

  // Footer disclaimer
  const disclaimer = "Dieses Exposé wurde von Direkta erstellt. Alle Angaben basieren auf den Informationen des Eigentümers. Es entsteht kein Anspruch auf Vollständigkeit oder Richtigkeit. Es handelt sich um keine rechtsverbindliche Verkaufszusage.";
  const dLines = wrap(disclaimer, R, 8, CW);
  let yD = 80;
  for (const line of dLines) {
    factsPage.drawText(line, { x: PX, y: yD, size: 8, font: R, color: FAINT });
    yD -= 11;
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
