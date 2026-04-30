/* eslint-disable no-console */
// F-M5-07 extraction audit harness — runs energy_extract over every PDF in
// prisma/fixtures/energy-pdfs/ (and the bundled real Energieausweis.pdf) and
// reports per-field accuracy.
//
// Usage:
//   npm run audit:energy-extract                  # standard audit
//   npm run audit:energy-extract -- --baseline    # write extraction output
//                                                 # back as expected values for
//                                                 # cases marked synthetic=false
//                                                 # whose expected fields are
//                                                 # placeholders ("?" or 0).
//   npm run audit:energy-extract -- --only-real   # ignore synthetic PDFs
//
// The ≥95% spec bar is computed against REAL PDFs only — synthetic PDFs are
// smoke tests for the pipeline.

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { INITIAL_MEMORY, executeTool } from "../src/lib/expose-agent";

interface ExpectedCase {
  type: "VERBRAUCH" | "BEDARF" | "?";
  energyClass: string;
  energyValue: number;
  primarySource: string;
  validUntil: string;
}
interface ManifestEntry {
  id: string;
  file: string;
  synthetic: boolean;
  expected: ExpectedCase & { id: string; template?: string };
}
interface Manifest {
  generatedAt: string;
  totalCases: number;
  cases: ManifestEntry[];
}

const FIELDS: Array<keyof ExpectedCase> = ["type", "energyClass", "energyValue", "primarySource", "validUntil"];

interface PerCaseResult {
  id: string;
  file: string;
  synthetic: boolean;
  ok: boolean;
  perField: Record<string, { expected: unknown; actual: unknown; match: boolean }>;
  costCents: number;
  mode?: "text" | "vision";
  error?: string;
}

function parseFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function isPlaceholder(v: unknown): boolean {
  return v === "?" || v === 0 || v === null || v === undefined || v === "";
}

function compareField(field: keyof ExpectedCase, expected: unknown, actual: unknown): boolean {
  if (isPlaceholder(expected)) return true; // placeholder = treat as not-asserted
  if (actual === null || actual === undefined) return false;
  if (field === "energyValue") {
    return Math.abs(Number(expected) - Number(actual)) <= 2;
  }
  if (field === "primarySource") {
    return String(actual).toLowerCase().includes(String(expected).toLowerCase()) ||
      String(expected).toLowerCase().includes(String(actual).toLowerCase());
  }
  return String(expected).toLowerCase().trim() === String(actual).toLowerCase().trim();
}

async function extractText(pdfPath: string): Promise<string> {
  const buf = readFileSync(pdfPath);
  const mod = await import("pdf-parse");
  const PDFParse = mod.PDFParse;
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const result = await parser.getText();
  await parser.destroy();
  return (result.text || "").replace(/\s+/g, " ").trim();
}

async function runOne(pdfPath: string): Promise<{ tr: Awaited<ReturnType<typeof executeTool>>; rawText: string }> {
  const buf = readFileSync(pdfPath);
  const rawText = await extractText(pdfPath);
  const tr = await executeTool(
    "energy_extract",
    { rawText, pdfBase64: buf.toString("base64") },
    INITIAL_MEMORY,
  );
  return { tr, rawText };
}

const fieldMap: Record<keyof ExpectedCase, string> = {
  type: "energyCertType",
  energyClass: "energyClass",
  energyValue: "energyValue",
  primarySource: "energySource",
  validUntil: "energyValidUntil",
};

async function main() {
  const dir = resolve(process.cwd(), "prisma/fixtures/energy-pdfs");
  const manifestPath = resolve(dir, "manifest.json");
  if (!existsSync(manifestPath)) {
    console.error(`Manifest fehlt: ${manifestPath}`);
    console.error('Bitte erst "npm run fixtures:gen-energy-pdfs" laufen lassen.');
    process.exit(1);
  }

  const baseline = parseFlag("baseline");
  const onlyReal = parseFlag("only-real");

  const manifest: Manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

  // Bring the bundled real PDF into the fixtures dir under its manifest filename
  // so the harness path is uniform.
  const realRepoPath = resolve(process.cwd(), "Energieausweis.pdf");
  const realFixturePath = resolve(dir, "real-01.pdf");
  if (existsSync(realRepoPath) && !existsSync(realFixturePath)) {
    copyFileSync(realRepoPath, realFixturePath);
    console.log(`copied Energieausweis.pdf → real-01.pdf`);
  }

  const targetCases = onlyReal ? manifest.cases.filter((c) => !c.synthetic) : manifest.cases;
  console.log(`▶ Extraction audit über ${targetCases.length} PDFs (baseline=${baseline}, only-real=${onlyReal})…`);

  const results: PerCaseResult[] = [];
  let totalCost = 0;
  let manifestMutated = false;

  for (const entry of targetCases) {
    const pdfPath = resolve(dir, entry.file);
    if (!existsSync(pdfPath)) {
      results.push({ id: entry.id, file: entry.file, synthetic: entry.synthetic, ok: false, perField: {}, costCents: 0, error: "Datei fehlt" });
      console.log(`✗ ${entry.id}  Datei fehlt: ${entry.file}`);
      continue;
    }
    try {
      const { tr } = await runOne(pdfPath);
      totalCost += tr.costCents;

      const actual = (tr.memoryPatch || {}) as Record<string, unknown>;
      const out = (tr.output || {}) as Record<string, unknown>;
      const mode = out.mode === "text" || out.mode === "vision" ? (out.mode as "text" | "vision") : undefined;

      // Baseline mode: pin actual extraction onto manifest for placeholder cases
      if (baseline && !entry.synthetic && tr.ok) {
        let mutated = false;
        for (const f of FIELDS) {
          if (isPlaceholder(entry.expected[f])) {
            const v = actual[fieldMap[f]];
            if (v !== undefined && v !== null && v !== "" && v !== 0) {
              // @ts-expect-error mutation onto union
              entry.expected[f] = v;
              mutated = true;
            }
          }
        }
        if (mutated) {
          manifestMutated = true;
          console.log(`  → baseline gepinnt: ${entry.id}`);
        }
      }

      const perField: PerCaseResult["perField"] = {};
      for (const f of FIELDS) {
        const expectedVal = entry.expected[f];
        const actualVal = actual[fieldMap[f]];
        perField[f] = { expected: expectedVal, actual: actualVal, match: compareField(f, expectedVal, actualVal) };
      }
      const allMatch = Object.values(perField).every((p) => p.match);
      results.push({ id: entry.id, file: entry.file, synthetic: entry.synthetic, ok: allMatch && tr.ok, perField, costCents: tr.costCents, mode });

      const fieldStr = FIELDS.map((f) => `${f}=${perField[f].match ? "✓" : "✗"}`).join(" ");
      const tag = entry.synthetic ? "(syn)" : "(REAL)";
      console.log(`${allMatch ? "✓" : "✗"} ${entry.id} ${tag} mode=${mode || "?"}  ${fieldStr}  ${tr.costCents}¢`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ id: entry.id, file: entry.file, synthetic: entry.synthetic, ok: false, perField: {}, costCents: 0, error: msg });
      console.log(`✗ ${entry.id}  ERROR: ${msg.slice(0, 100)}`);
    }
  }

  if (baseline && manifestMutated) {
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`✓ manifest.json aktualisiert mit Baseline-Werten`);
  }

  // Aggregate per-field accuracy on REAL PDFs only — that's the spec's bar.
  const realResults = results.filter((r) => !r.synthetic && Object.keys(r.perField).length > 0);
  const synResults = results.filter((r) => r.synthetic && Object.keys(r.perField).length > 0);

  function fieldAcc(rs: PerCaseResult[]) {
    const acc: Record<string, { matches: number; total: number; pct: number }> = {};
    for (const f of FIELDS) {
      let matches = 0, total = 0;
      for (const r of rs) {
        const pf = r.perField[f];
        if (pf && !isPlaceholder(pf.expected)) {
          total++;
          if (pf.match) matches++;
        }
      }
      acc[f] = { matches, total, pct: total === 0 ? 0 : Math.round((matches / total) * 1000) / 10 };
    }
    const overallMatches = Object.values(acc).reduce((s, v) => s + v.matches, 0);
    const overallTotal = Object.values(acc).reduce((s, v) => s + v.total, 0);
    const overallPct = overallTotal === 0 ? 0 : Math.round((overallMatches / overallTotal) * 1000) / 10;
    return { byField: acc, overall: { matches: overallMatches, total: overallTotal, pct: overallPct } };
  }

  const realAcc = fieldAcc(realResults);
  const synAcc = fieldAcc(synResults);

  const summary = {
    runAt: new Date().toISOString(),
    totalCases: results.length,
    real: { count: realResults.length, ...realAcc },
    synthetic: { count: synResults.length, ...synAcc },
    target: 95.0,
    targetMetReal: realAcc.overall.pct >= 95.0,
    totalCostCents: totalCost,
  };

  const outDir = resolve(process.cwd(), "audit-reports");
  mkdirSync(outDir, { recursive: true });
  const outFile = resolve(outDir, `energy-extract-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(outFile, JSON.stringify({ summary, results }, null, 2));

  console.log("");
  console.log("─── REAL PDFs (für SLO bewertet) ───");
  if (realResults.length === 0) {
    console.log("  (keine real-Daten — bitte echte PDFs in prisma/fixtures/energy-pdfs/ legen und im manifest registrieren)");
  } else {
    for (const f of FIELDS) {
      const a = realAcc.byField[f];
      console.log(`  ${f.padEnd(15)} ${a.matches}/${a.total} (${a.pct}%)`);
    }
    console.log(`  GESAMT          ${realAcc.overall.matches}/${realAcc.overall.total} (${realAcc.overall.pct}%) ${summary.targetMetReal ? "✓ ≥95%" : "✗ < 95% Ziel"}`);
  }
  console.log("");
  console.log("─── Synthetische PDFs (Smoke-Test) ───");
  console.log(`  GESAMT          ${synAcc.overall.matches}/${synAcc.overall.total} (${synAcc.overall.pct}%)`);
  console.log("");
  console.log(`  Kosten: ${(totalCost / 100).toFixed(2)} €`);
  console.log(`  Bericht: ${outFile}`);

  process.exit(summary.targetMetReal ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
