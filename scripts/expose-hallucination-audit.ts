/* eslint-disable no-console */
// F-M5-04 hallucination audit harness.
//
// Runs listing_draft + the rubric's LLM-judge over property records and
// reports pass/fail counts for "zero unverifiable claims".
//
// Usage:
//   npm run audit:hallucination                       # 50 fixture records
//   npm run audit:hallucination -- --source=db        # real Property records from DB
//   npm run audit:hallucination -- --source=db --userId=<id>
//   npm run audit:hallucination -- --limit=10 --start=20
//
// Requires OPENROUTER_API_KEY in env. Full 50-fixture run ≈ €0.80.

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { INITIAL_MEMORY, executeTool, runRubric, type WorkingMemory } from "../src/lib/expose-agent";
import { prisma } from "../src/lib/prisma";

interface Fixture {
  id: string;
  type: string;
  street: string;
  houseNumber: string;
  postcode: string;
  city: string;
  livingArea: number;
  plotArea?: number;
  yearBuilt?: number;
  rooms?: number;
  bathrooms?: number;
  floor?: number;
  condition: string;
  attributes: string[];
  energy: {
    type: "VERBRAUCH" | "BEDARF";
    energyClass: string;
    energyValue: number;
    primarySource: string;
  } | null;
}

function fixtureToMemory(f: Fixture): WorkingMemory {
  return {
    ...INITIAL_MEMORY,
    type: f.type,
    street: f.street,
    houseNumber: f.houseNumber,
    postcode: f.postcode,
    city: f.city,
    livingArea: f.livingArea,
    plotArea: f.plotArea ?? null,
    yearBuilt: f.yearBuilt ?? null,
    rooms: f.rooms ?? null,
    bathrooms: f.bathrooms ?? null,
    floor: f.floor ?? null,
    condition: f.condition,
    attributes: f.attributes,
    hasEnergyCert: f.energy !== null,
    energyCertType: f.energy?.type ?? null,
    energyClass: f.energy?.energyClass ?? null,
    energyValue: f.energy?.energyValue ?? null,
    energySource: f.energy?.primarySource ?? null,
    addressValidated: true,
    uploads: Array.from({ length: 6 }, (_, i) => ({
      storageKey: `mock://photo-${i}`,
      fileName: `photo-${i}.jpg`,
      mimeType: "image/jpeg",
      sizeBytes: 100000,
      width: 1600,
      height: 1200,
      kind: "PHOTO" as const,
      classification: i === 0
        ? { roomType: "exterior" as const, qualityFlags: [], qualityScore: 80 }
        : { roomType: "living" as const, qualityFlags: [], qualityScore: 80 },
    })),
  };
}

function parseArg(name: string, fallback?: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return fallback;
  return arg.split("=")[1];
}

interface PerFixtureResult {
  id: string;
  city: string;
  type: string;
  draftOk: boolean;
  rubricPassed: boolean;
  hallucinationOk: boolean;
  hallucinationFlagged: string[];
  wordCountOk: boolean;
  superlativesOk: boolean;
  costCents: number;
  error?: string;
}

async function loadFixtures(source: string, userId?: string): Promise<Fixture[]> {
  if (source === "db") {
    const where = userId ? { userId } : {};
    const props = await prisma.property.findMany({
      where, include: { energyCert: true }, orderBy: { createdAt: "desc" }, take: 200,
    });
    if (props.length === 0) {
      throw new Error("Keine Property-Records in der DB gefunden.");
    }
    return props.map((p): Fixture => ({
      id: p.id,
      type: p.type,
      street: p.street,
      houseNumber: p.houseNumber,
      postcode: p.postcode,
      city: p.city,
      livingArea: Number(p.livingArea),
      plotArea: p.plotArea ? Number(p.plotArea) : undefined,
      yearBuilt: p.yearBuilt ?? undefined,
      rooms: p.rooms ? Number(p.rooms) : undefined,
      bathrooms: p.bathrooms ?? undefined,
      floor: p.floor ?? undefined,
      condition: p.condition,
      attributes: Array.isArray(p.attributes) ? (p.attributes as unknown[]).map(String) : [],
      energy: p.energyCert ? {
        type: p.energyCert.type,
        energyClass: p.energyCert.energyClass,
        energyValue: Number(p.energyCert.energyValue),
        primarySource: p.energyCert.primarySource,
      } : null,
    }));
  }
  const fixturesPath = resolve(process.cwd(), "prisma/fixtures/properties-50.json");
  return JSON.parse(readFileSync(fixturesPath, "utf-8"));
}

async function main() {
  const source = parseArg("source", "fixtures") || "fixtures";
  const userId = parseArg("userId");
  const all = await loadFixtures(source, userId);
  const start = Number(parseArg("start", "0"));
  const limit = Number(parseArg("limit", String(all.length)));
  const fixtures = all.slice(start, start + limit);

  console.log(`▶ Hallucination audit over ${fixtures.length} ${source === "db" ? "DB properties" : "fixtures"} (start=${start})…`);

  const results: PerFixtureResult[] = [];
  let totalCost = 0;
  let failCount = 0;

  for (let i = 0; i < fixtures.length; i++) {
    const f = fixtures[i];
    const memBefore = fixtureToMemory(f);
    const label = `[${i + 1}/${fixtures.length}] ${f.id} ${f.type} ${f.city}`;

    try {
      const draftRes = await executeTool("listing_draft", {}, memBefore);
      const memAfterDraft = draftRes.memoryPatch?.draft
        ? { ...memBefore, draft: draftRes.memoryPatch.draft }
        : memBefore;
      const rubric = await runRubric(memAfterDraft);
      const cost = (draftRes.costCents || 0) + rubric.costCents;
      totalCost += cost;

      const ok = draftRes.ok && rubric.result.passed;
      if (!ok) failCount++;

      const r: PerFixtureResult = {
        id: f.id,
        city: f.city,
        type: f.type,
        draftOk: draftRes.ok,
        rubricPassed: rubric.result.passed,
        hallucinationOk: rubric.result.details.noHallucination.ok,
        hallucinationFlagged: rubric.result.details.noHallucination.flagged ?? [],
        wordCountOk: rubric.result.details.wordCount.ok,
        superlativesOk: rubric.result.details.noSuperlatives.ok,
        costCents: cost,
      };
      results.push(r);

      const status = ok ? "✓" : "✗";
      console.log(`${status} ${label}  hall=${r.hallucinationOk ? "ok" : "✗"} wc=${r.wordCountOk ? "ok" : "✗"} sup=${r.superlativesOk ? "ok" : "✗"}  ${cost}¢`);
      if (!r.hallucinationOk) console.log(`    flagged: ${r.hallucinationFlagged.slice(0, 3).join(" | ")}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        id: f.id, city: f.city, type: f.type,
        draftOk: false, rubricPassed: false, hallucinationOk: false, hallucinationFlagged: [],
        wordCountOk: false, superlativesOk: false, costCents: 0, error: msg,
      });
      failCount++;
      console.log(`✗ ${label}  ERROR: ${msg.slice(0, 100)}`);
    }
  }

  const summary = {
    runAt: new Date().toISOString(),
    fixtures: fixtures.length,
    passed: fixtures.length - failCount,
    failed: failCount,
    passRatePct: fixtures.length === 0 ? 0 : Math.round(((fixtures.length - failCount) / fixtures.length) * 1000) / 10,
    hallucinationFails: results.filter((r) => !r.hallucinationOk).length,
    wordCountFails: results.filter((r) => !r.wordCountOk).length,
    superlativeFails: results.filter((r) => !r.superlativesOk).length,
    totalCostCents: totalCost,
    avgCostCents: results.length === 0 ? 0 : Math.round(totalCost / results.length),
  };

  const outDir = resolve(process.cwd(), "audit-reports");
  mkdirSync(outDir, { recursive: true });
  const outFile = resolve(outDir, `hallucination-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(outFile, JSON.stringify({ summary, results }, null, 2));

  console.log("");
  console.log("─── Zusammenfassung ───");
  console.log(`Bestanden: ${summary.passed} / ${summary.fixtures} (${summary.passRatePct}%)`);
  console.log(`Halluzinations-Fails: ${summary.hallucinationFails}`);
  console.log(`Wortzahl-Fails: ${summary.wordCountFails}`);
  console.log(`Superlativ-Fails: ${summary.superlativeFails}`);
  console.log(`Kosten gesamt: ${(summary.totalCostCents / 100).toFixed(2)} € · Ø ${summary.avgCostCents}¢`);
  console.log(`Bericht: ${outFile}`);

  // Spec acceptance: "zero unverifiable claims" — exit non-zero on any hallucination fail
  process.exit(summary.hallucinationFails === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
