/* eslint-disable no-console */
// One-shot inspector — extracts text from the bundled real Energieausweis.pdf
// and prints the raw text so we can pin real expected values in the harness.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

async function main() {
  const pdfPath = resolve(process.cwd(), "Energieausweis.pdf");
  const buf = readFileSync(pdfPath);
  const mod = await import("pdf-parse");
  const PDFParse = mod.PDFParse;
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const text = (await parser.getText()).text || "";
  await parser.destroy();

  console.log("─── Roh-Text (gesamt) ───");
  console.log(text);
  console.log("\n─── Auf Energieausweis-Felder gefiltert ───");
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/(verbrauchs|bedarfs|energieklasse|kWh|primärenerg|gültig|wesentlich|energieträger|effizienz|endenergie|A\+|^[ABCDEFGH]\b)/i.test(line)) {
      console.log(`L${i.toString().padStart(4, "0")}: ${line}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
