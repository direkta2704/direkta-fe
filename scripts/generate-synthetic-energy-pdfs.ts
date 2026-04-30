/* eslint-disable no-console */
// Generates N synthetic Energieausweis PDFs with deterministic, known field
// values for the F-M5-07 extraction harness. These are NOT representative of
// real DENA layouts — they cover the values our extractor needs to read but
// the layout is simplified. Replace with real PDFs to tune the prompt to ≥95%.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface SyntheticEnergyCase {
  id: string;
  type: "VERBRAUCH" | "BEDARF" | "?";
  energyClass: string;
  energyValue: number;
  primarySource: string;
  validUntil: string;
  // Layout style — distinct templates so our prompt isn't tuned to one only
  template: "label-value" | "table" | "narrative";
}

const CASES: SyntheticEnergyCase[] = [
  { id: "syn-01", type: "VERBRAUCH", energyClass: "C", energyValue: 110, primarySource: "Erdgas", validUntil: "2030-04-12", template: "label-value" },
  { id: "syn-02", type: "BEDARF", energyClass: "A", energyValue: 48, primarySource: "Wärmepumpe", validUntil: "2032-09-01", template: "table" },
  { id: "syn-03", type: "VERBRAUCH", energyClass: "E", energyValue: 168, primarySource: "Heizöl", validUntil: "2029-11-23", template: "narrative" },
  { id: "syn-04", type: "BEDARF", energyClass: "B", energyValue: 72, primarySource: "Fernwärme", validUntil: "2031-02-15", template: "label-value" },
  { id: "syn-05", type: "VERBRAUCH", energyClass: "F", energyValue: 198, primarySource: "Erdgas", validUntil: "2028-07-30", template: "table" },
  { id: "syn-06", type: "BEDARF", energyClass: "A+", energyValue: 30, primarySource: "Wärmepumpe", validUntil: "2033-05-10", template: "narrative" },
  { id: "syn-07", type: "VERBRAUCH", energyClass: "D", energyValue: 138, primarySource: "Erdgas", validUntil: "2030-08-22", template: "label-value" },
  { id: "syn-08", type: "BEDARF", energyClass: "C", energyValue: 95, primarySource: "Erdgas", validUntil: "2031-12-04", template: "table" },
  { id: "syn-09", type: "VERBRAUCH", energyClass: "G", energyValue: 235, primarySource: "Heizöl", validUntil: "2027-03-18", template: "narrative" },
  { id: "syn-10", type: "BEDARF", energyClass: "B", energyValue: 78, primarySource: "Pellets", validUntil: "2032-01-20", template: "label-value" },
  { id: "syn-11", type: "VERBRAUCH", energyClass: "C", energyValue: 102, primarySource: "Fernwärme", validUntil: "2030-10-09", template: "table" },
  { id: "syn-12", type: "BEDARF", energyClass: "A", energyValue: 52, primarySource: "Wärmepumpe", validUntil: "2033-06-25", template: "narrative" },
  { id: "syn-13", type: "VERBRAUCH", energyClass: "D", energyValue: 145, primarySource: "Erdgas", validUntil: "2029-04-14", template: "label-value" },
  { id: "syn-14", type: "BEDARF", energyClass: "C", energyValue: 108, primarySource: "Erdgas", validUntil: "2031-09-30", template: "table" },
  { id: "syn-15", type: "VERBRAUCH", energyClass: "E", energyValue: 175, primarySource: "Heizöl", validUntil: "2028-12-17", template: "narrative" },
  { id: "syn-16", type: "BEDARF", energyClass: "B", energyValue: 70, primarySource: "Erdgas", validUntil: "2032-08-08", template: "label-value" },
  { id: "syn-17", type: "VERBRAUCH", energyClass: "F", energyValue: 205, primarySource: "Heizöl", validUntil: "2027-11-26", template: "table" },
  { id: "syn-18", type: "BEDARF", energyClass: "A+", energyValue: 32, primarySource: "Wärmepumpe", validUntil: "2033-03-12", template: "narrative" },
  { id: "syn-19", type: "VERBRAUCH", energyClass: "C", energyValue: 115, primarySource: "Fernwärme", validUntil: "2030-06-05", template: "label-value" },
  { id: "syn-20", type: "BEDARF", energyClass: "B", energyValue: 80, primarySource: "Erdgas", validUntil: "2031-10-19", template: "table" },
  { id: "syn-21", type: "VERBRAUCH", energyClass: "D", energyValue: 132, primarySource: "Erdgas", validUntil: "2029-08-02", template: "narrative" },
  { id: "syn-22", type: "BEDARF", energyClass: "A", energyValue: 50, primarySource: "Wärmepumpe", validUntil: "2032-12-13", template: "label-value" },
  { id: "syn-23", type: "VERBRAUCH", energyClass: "F", energyValue: 192, primarySource: "Erdgas", validUntil: "2028-05-29", template: "table" },
  { id: "syn-24", type: "BEDARF", energyClass: "B", energyValue: 75, primarySource: "Fernwärme", validUntil: "2031-04-07", template: "narrative" },
  { id: "syn-25", type: "VERBRAUCH", energyClass: "E", energyValue: 178, primarySource: "Erdgas", validUntil: "2028-09-21", template: "label-value" },
  { id: "syn-26", type: "BEDARF", energyClass: "C", energyValue: 92, primarySource: "Erdgas", validUntil: "2031-07-14", template: "table" },
  { id: "syn-27", type: "VERBRAUCH", energyClass: "G", energyValue: 245, primarySource: "Heizöl", validUntil: "2027-01-11", template: "narrative" },
  { id: "syn-28", type: "BEDARF", energyClass: "A", energyValue: 45, primarySource: "Wärmepumpe", validUntil: "2033-02-28", template: "label-value" },
  { id: "syn-29", type: "VERBRAUCH", energyClass: "D", energyValue: 142, primarySource: "Heizöl", validUntil: "2029-12-06", template: "table" },
];

async function buildPdf(c: SyntheticEnergyCase): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0, 0, 0);
  const grey = rgb(0.4, 0.4, 0.4);

  page.drawText("ENERGIEAUSWEIS für Wohngebäude", { x: 56, y: 770, size: 16, font: bold, color: ink });
  page.drawText("gemäß Gebäudeenergiegesetz (GEG)", { x: 56, y: 750, size: 10, font: helv, color: grey });
  page.drawLine({ start: { x: 56, y: 740 }, end: { x: 540, y: 740 }, thickness: 1, color: ink });

  const typeLong = c.type === "VERBRAUCH" ? "Verbrauchsausweis" : "Bedarfsausweis";

  if (c.template === "label-value") {
    let y = 700;
    const rows = [
      ["Ausweistyp", typeLong],
      ["Energieeffizienzklasse", c.energyClass],
      ["Endenergiebedarf bzw. -verbrauch", `${c.energyValue} kWh/(m²·a)`],
      ["Wesentlicher Energieträger der Heizung", c.primarySource],
      ["Gültig bis", c.validUntil],
    ];
    for (const [label, value] of rows) {
      page.drawText(label, { x: 56, y, size: 10, font: bold, color: ink });
      page.drawText(value, { x: 280, y, size: 10, font: helv, color: ink });
      y -= 24;
    }
  } else if (c.template === "table") {
    const tableY = 680;
    page.drawRectangle({ x: 56, y: tableY - 130, width: 484, height: 130, borderColor: ink, borderWidth: 1, color: rgb(1, 1, 1) });
    let y = tableY - 20;
    const rows = [
      ["Art des Ausweises", typeLong],
      ["Klasse (A+ bis H)", c.energyClass],
      ["Kennwert (kWh/m²·a)", String(c.energyValue)],
      ["Energieträger", c.primarySource],
      ["Gültig bis (TT.MM.JJJJ)", c.validUntil],
    ];
    for (const [label, value] of rows) {
      page.drawText(label, { x: 70, y, size: 10, font: helv, color: ink });
      page.drawLine({ start: { x: 280, y: y - 2 }, end: { x: 530, y: y - 2 }, thickness: 0.5, color: grey });
      page.drawText(value, { x: 290, y, size: 10, font: bold, color: ink });
      y -= 22;
    }
  } else {
    // Narrative
    const text = `Hiermit wird bestätigt, dass für das Gebäude ein ${typeLong} gemäß GEG ausgestellt wurde. Die Energieeffizienzklasse beträgt ${c.energyClass}, der Endenergiekennwert liegt bei ${c.energyValue} kWh pro Quadratmeter Wohnfläche und Jahr. Als wesentlicher Energieträger der Heizung kommt ${c.primarySource} zum Einsatz. Dieser Ausweis ist gültig bis zum ${c.validUntil} und wurde durch einen qualifizierten Aussteller erstellt.`;
    let y = 700;
    const wrap = (s: string, width: number) => {
      const words = s.split(" ");
      const lines: string[] = [];
      let line = "";
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (helv.widthOfTextAtSize(test, 11) > width && line) { lines.push(line); line = w; }
        else line = test;
      }
      if (line) lines.push(line);
      return lines;
    };
    for (const ln of wrap(text, 484)) {
      page.drawText(ln, { x: 56, y, size: 11, font: helv, color: ink });
      y -= 16;
    }
  }

  // Footer
  page.drawText("Dieser Ausweis dient ausschließlich der Information.", { x: 56, y: 80, size: 8, font: helv, color: grey });

  return Buffer.from(await doc.save());
}

async function main() {
  const outDir = resolve(process.cwd(), "prisma/fixtures/energy-pdfs");
  mkdirSync(outDir, { recursive: true });

  const manifestEntries: Array<{ id: string; file: string; expected: SyntheticEnergyCase; synthetic: boolean }> = [];

  for (const c of CASES) {
    const pdf = await buildPdf(c);
    const file = `${c.id}.pdf`;
    writeFileSync(resolve(outDir, file), pdf);
    manifestEntries.push({ id: c.id, file, expected: c, synthetic: true });
    console.log(`generated ${file}  ${c.type} ${c.energyClass} ${c.energyValue} kWh ${c.primarySource}`);
  }

  // Real PDF slot — copied in by the audit script from repo root if present.
  // First run with `--baseline` will populate the placeholders below from
  // the actual extraction output.
  manifestEntries.push({
    id: "real-01",
    file: "real-01.pdf",
    synthetic: false,
    expected: {
      id: "real-01", template: "label-value",
      type: "?", energyClass: "?", energyValue: 0, primarySource: "?", validUntil: "?",
    },
  });

  const manifest = { generatedAt: new Date().toISOString(), totalCases: manifestEntries.length, cases: manifestEntries };
  writeFileSync(resolve(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`✓ manifest.json with ${manifestEntries.length} cases`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
