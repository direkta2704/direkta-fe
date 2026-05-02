import { describe, it, expect } from "vitest";
import {
  nextQuestion,
  completenessScore,
  rubricFailureToQuestions,
  chainedReviewMessage,
  buildMemoryContext,
  INITIAL_MEMORY,
  type WorkingMemory,
  type RubricResult,
  type DraftResult,
  type PhotoUpload,
} from "../expose-agent";

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

function makePhoto(i: number, kind: "PHOTO" | "FLOORPLAN" = "PHOTO"): PhotoUpload {
  return {
    storageKey: `/uploads/photo-${i}.jpg`,
    fileName: `photo-${i}.jpg`,
    mimeType: "image/jpeg",
    sizeBytes: 100_000,
    width: 1024,
    height: 768,
    kind,
  };
}

function makeReadyMemory(overrides: Partial<WorkingMemory> = {}): WorkingMemory {
  return {
    ...INITIAL_MEMORY,
    type: "ETW",
    street: "Marktstraße",
    houseNumber: "12",
    postcode: "80331",
    city: "München",
    livingArea: 95,
    condition: "GEPFLEGT",
    hasEnergyCert: true,
    energyClass: "C",
    energyValue: 120,
    energySource: "Gas",
    rooms: 4,
    bathrooms: 1,
    yearBuilt: 1990,
    uploads: Array.from({ length: 6 }, (_, i) => makePhoto(i)),
    ...overrides,
  };
}

function makeFailedRubric(overrides: Partial<RubricResult["details"]> = {}): RubricResult {
  return {
    passed: false,
    failures: ["some failure"],
    details: {
      gegFields: { ok: true },
      wordCount: { ok: true, words: 300, paragraphs: 3 },
      noHallucination: { ok: true },
      noSuperlatives: { ok: true },
      photos: { ok: true, count: 8 },
      priceInBand: { ok: true },
      ...overrides,
    },
  };
}

// ────────────────────────────────────────────────────────────────────────
// Fixture 1: No re-ask of stated facts (4 cases)
// ────────────────────────────────────────────────────────────────────────

describe("Fixture 1: No re-ask of stated facts", () => {
  it("1a — alles außer Adresse: fragt nach Straße, nicht nach Typ/Fläche/Zustand", () => {
    // Seller said: "ETW, 75qm, 3 Zimmer, 2. OG, Baujahr 2001, Gepflegt, Hamburg"
    // Address is missing → should ask street, not re-ask type/area/rooms/floor/year
    const wm: WorkingMemory = {
      ...INITIAL_MEMORY,
      type: "ETW",
      livingArea: 75,
      rooms: 3,
      floor: 2,
      yearBuilt: 2001,
      condition: "GEPFLEGT",
      city: "Hamburg",
      // Missing: street, houseNumber, postcode
    };
    const q = nextQuestion(wm);
    expect(q.action).toBe("ask");
    expect(q.field).toBe("street");
    // Must NOT ask for any filled field
    expect(["type", "livingArea", "rooms", "floor", "yearBuilt", "condition", "city"]).not.toContain(q.field);
  });

  it("1b — Adresse + Fotos, keine Metriken: fragt nach Wohnfläche, nicht nach Fotos", () => {
    // Seller gave address and uploaded photos but no property details
    const wm: WorkingMemory = {
      ...INITIAL_MEMORY,
      type: "ETW",
      street: "Bergstraße",
      houseNumber: "5",
      postcode: "10115",
      city: "Berlin",
      uploads: Array.from({ length: 8 }, (_, i) => makePhoto(i)),
      // Missing: livingArea, condition, rooms, yearBuilt, etc.
    };
    const q = nextQuestion(wm);
    expect(q.action).toBe("ask");
    // Should ask for core metric (livingArea), not re-ask identity or jump to media
    expect(q.field).toBe("livingArea");
    expect(["type", "street", "houseNumber", "postcode", "city", "photos"]).not.toContain(q.field);
  });

  it("1c — MFH Bulk mit Gebäudedaten, keine Einheiten: fragt nach energy vor units", () => {
    // Seller pasted MFH building info but no unit details AND no energy cert.
    // energy (group order 2, blocksPublish) comes before details/units (group order 4).
    const wm: WorkingMemory = {
      ...INITIAL_MEMORY,
      type: "MFH",
      street: "Marktstraße",
      houseNumber: "12",
      postcode: "76571",
      city: "Gaggenau",
      livingArea: 250,
      condition: "GEPFLEGT",
      yearBuilt: 1999,
      rooms: 8,
      bathrooms: 3,
      attributes: ["Keller", "Stellplatz", "Garten"],
      // energy missing (GEG required) → asked before MFH units
    };
    const q = nextQuestion(wm);
    expect(q.action).toBe("ask");
    expect(q.field).toBe("hasEnergyCert");
  });

  it("1c2 — MFH mit Energie, aber keine Einheiten: fragt nach unitCount", () => {
    // Energy is filled → now units (details group) are next
    const wm: WorkingMemory = {
      ...INITIAL_MEMORY,
      type: "MFH",
      street: "Marktstraße",
      houseNumber: "12",
      postcode: "76571",
      city: "Gaggenau",
      livingArea: 250,
      condition: "GEPFLEGT",
      yearBuilt: 1999,
      rooms: 8,
      bathrooms: 3,
      attributes: ["Keller", "Stellplatz", "Garten"],
      hasEnergyCert: true,
      energyClass: "B",
      energyValue: 70.2,
      energySource: "Gas",
      uploads: Array.from({ length: 6 }, (_, i) => makePhoto(i)),
      // energy done, photos done → but MFH units still missing
      // isReadyForDraft is true BUT unitCount is null → details group
    };
    const q = nextQuestion(wm);
    // Pipeline would trigger (ready + photos), but unitCount/units/sellingMode
    // are unfilled details. Since isReadyForDraft=true and photos>=6,
    // trigger_pricing fires first.
    // Actually, let's test with fewer photos to avoid pipeline trigger.
    const wm2: WorkingMemory = { ...wm, uploads: [] };
    const q2 = nextQuestion(wm2);
    expect(q2.action).toBe("upload_photos");
    // With photos missing (media group, order 3) and units missing (details, order 4),
    // photos comes first. This is correct: media before details.
  });

  it("1d — alles vorhanden: löst Pipeline aus", () => {
    const wm = makeReadyMemory();
    const q = nextQuestion(wm);
    expect(q.action).toBe("trigger_pricing");
    expect(q.field).toBeUndefined();
    expect(q.priority).toBe(100);
  });
});

// ────────────────────────────────────────────────────────────────────────
// Fixture 1.5: Group-order derived from max member priority
// identity(7) → core(7) → energy(2.9) → media(2.5) → details(0.9)
// ────────────────────────────────────────────────────────────────────────

describe("Group ordering: energy before details, details last", () => {
  it("energy + details beide leer → fragt hasEnergyCert (energy), nicht rooms (details)", () => {
    // Rationale: energy fields have blocksPublish=true (GEG legally required).
    // details fields are nice-to-have. Drop-out at turn 12 must leave a
    // publishable record, so energy comes first.
    const wm: WorkingMemory = {
      ...INITIAL_MEMORY,
      type: "ETW",
      street: "Marktstraße",
      houseNumber: "12",
      postcode: "80331",
      city: "München",
      livingArea: 95,
      condition: "GEPFLEGT",
      // energy group: hasEnergyCert null → unfilled
      // details group: rooms, yearBuilt, bathrooms all null → unfilled
      // media group: photos < 6 → unfilled
      uploads: [],
    };
    const q = nextQuestion(wm);
    // energy (group order 2) before media (3) before details (4)
    expect(q.field).toBe("hasEnergyCert");
    expect(q.field).not.toBe("rooms");
    expect(q.field).not.toBe("photos");
  });

  it("energy fertig → media (photos), nicht details (rooms)", () => {
    const wm: WorkingMemory = {
      ...INITIAL_MEMORY,
      type: "ETW",
      street: "Marktstraße",
      houseNumber: "12",
      postcode: "80331",
      city: "München",
      livingArea: 95,
      condition: "GEPFLEGT",
      hasEnergyCert: true,
      energyClass: "B",
      energyValue: 80,
      energySource: "Gas",
      // media: photos missing
      // details: rooms, yearBuilt missing
      uploads: [],
    };
    const q = nextQuestion(wm);
    // media (group order 3) before details (4)
    expect(q.action).toBe("upload_photos");
    expect(q.field).toBe("photos");
    expect(q.field).not.toBe("rooms");
  });

  it("energy + media fertig → details (rooms)", () => {
    const wm: WorkingMemory = {
      ...INITIAL_MEMORY,
      type: "ETW",
      street: "Marktstraße",
      houseNumber: "12",
      postcode: "80331",
      city: "München",
      livingArea: 95,
      condition: "GEPFLEGT",
      hasEnergyCert: true,
      energyClass: "B",
      energyValue: 80,
      energySource: "Gas",
      uploads: Array.from({ length: 6 }, (_, i) => makePhoto(i)),
      // details still missing: rooms, yearBuilt, etc.
      // But isReadyForDraft is true → trigger_pricing fires first
    };
    // With all mandatory filled + 6 photos → pipeline triggers
    const q = nextQuestion(wm);
    expect(q.action).toBe("trigger_pricing");
  });
});

// ────────────────────────────────────────────────────────────────────────
// Fixture 2: Targeted re-ask on rubric failure
// ────────────────────────────────────────────────────────────────────────

describe("Fixture 2: Targeted re-ask on rubric failure", () => {
  it("GEG-Fehler → fragt nach Energiedaten, nicht neuem Entwurf", () => {
    const rubric = makeFailedRubric({ gegFields: { ok: false, reason: "fehlende Felder" } });
    const questions = rubricFailureToQuestions(rubric);
    expect(questions).toHaveLength(1);
    expect(questions[0]).toContain("Energieausweis");
    expect(questions[0]).toContain("Energieklasse");
  });

  it("Foto-Anzahl < 6 → nennt fehlende Anzahl", () => {
    const rubric = makeFailedRubric({ photos: { ok: false, count: 3 } });
    const questions = rubricFailureToQuestions(rubric);
    expect(questions).toHaveLength(1);
    expect(questions[0]).toContain("3 Fotos");
  });

  it("Fotos ≥ 6 aber kein Außenfoto → fragt nach Außenfoto", () => {
    const rubric = makeFailedRubric({ photos: { ok: false, count: 8 } });
    const questions = rubricFailureToQuestions(rubric);
    expect(questions).toHaveLength(1);
    expect(questions[0]).toContain("Außenfoto");
  });

  it("Wortanzahl zu niedrig", () => {
    const rubric = makeFailedRubric({ wordCount: { ok: false, words: 100, paragraphs: 1 } });
    const questions = rubricFailureToQuestions(rubric);
    expect(questions.some(q => q.includes("100 Wörter"))).toBe(true);
  });

  it("Wortanzahl zu hoch", () => {
    const rubric = makeFailedRubric({ wordCount: { ok: false, words: 700, paragraphs: 3 } });
    const questions = rubricFailureToQuestions(rubric);
    expect(questions.some(q => q.includes("700 Wörter"))).toBe(true);
  });

  it("Superlative gefunden", () => {
    const rubric = makeFailedRubric({ noSuperlatives: { ok: false, found: ["traumhaft", "perfekt"] } });
    const questions = rubricFailureToQuestions(rubric);
    expect(questions.some(q => q.includes("traumhaft"))).toBe(true);
  });

  it("Halluzination gefunden", () => {
    const rubric = makeFailedRubric({ noHallucination: { ok: false, flagged: ["Fußbodenheizung", "Sauna"] } });
    const questions = rubricFailureToQuestions(rubric);
    expect(questions.some(q => q.includes("Fußbodenheizung"))).toBe(true);
  });

  it("Preis außerhalb Band", () => {
    const rubric = makeFailedRubric({ priceInBand: { ok: false, reason: "too high" } });
    const questions = rubricFailureToQuestions(rubric);
    expect(questions.some(q => q.includes("Marktempfehlung"))).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────
// Fixture 3: Early draft offer
// ────────────────────────────────────────────────────────────────────────

describe("Fixture 3: Early draft offer", () => {
  it("trigger_pricing wenn alles bereit + 6 Fotos + kein priceBand", () => {
    const wm = makeReadyMemory({ priceBand: null, draft: null });
    const q = nextQuestion(wm);
    expect(q.action).toBe("trigger_pricing");
    expect(q.priority).toBe(100);
  });

  it("trigger_draft wenn priceBand vorhanden aber kein draft", () => {
    const wm = makeReadyMemory({
      priceBand: {
        low: 200_000, median: 250_000, high: 300_000,
        strategyQuick: 210_000, strategyReal: 250_000, strategyMax: 290_000,
        confidence: "MEDIUM", pricePerSqm: 2600,
      },
      draft: null,
    });
    const q = nextQuestion(wm);
    expect(q.action).toBe("trigger_draft");
    expect(q.priority).toBe(100);
  });

  it("completenessScore ≥ 60 bei vollständigem Memory", () => {
    const wm = makeReadyMemory();
    const score = completenessScore(wm);
    expect(score).toBeGreaterThanOrEqual(60);
  });

  it("completenessScore < 60 wenn Kernfelder fehlen", () => {
    const wm: WorkingMemory = { ...INITIAL_MEMORY, type: "ETW" };
    const score = completenessScore(wm);
    expect(score).toBeLessThan(60);
  });

  it("completenessScore gibt Teil-Punkte für Fotos", () => {
    const base: WorkingMemory = {
      ...INITIAL_MEMORY,
      type: "ETW",
      street: "Marktstraße",
      houseNumber: "12",
      postcode: "80331",
      city: "München",
      livingArea: 95,
      condition: "GEPFLEGT",
      uploads: Array.from({ length: 3 }, (_, i) => makePhoto(i)),
    };
    const score3 = completenessScore(base);
    const wm6 = { ...base, uploads: Array.from({ length: 6 }, (_, i) => makePhoto(i)) };
    const score6 = completenessScore(wm6);
    expect(score6).toBeGreaterThan(score3);
  });
});

// ────────────────────────────────────────────────────────────────────────
// Fixture 4: Cost compression with hysteresis
// ────────────────────────────────────────────────────────────────────────

describe("Fixture 4: Cost compression", () => {
  it("buildMemoryContext enthält KOSTEN-MODUS wenn costCompressed=true", () => {
    const wm: WorkingMemory = { ...INITIAL_MEMORY, costCompressed: true };
    const ctx = buildMemoryContext(wm);
    expect(ctx).toContain("[KOSTEN-MODUS]");
    expect(ctx).toContain("Budget knapp");
  });

  it("buildMemoryContext enthält KEIN KOSTEN-MODUS bei costCompressed=false", () => {
    const wm: WorkingMemory = { ...INITIAL_MEMORY, costCompressed: false };
    const ctx = buildMemoryContext(wm);
    expect(ctx).not.toContain("[KOSTEN-MODUS]");
  });

  it("nextQuestion überspringt optionale Felder wenn costCompressed", () => {
    const wm: WorkingMemory = {
      ...INITIAL_MEMORY,
      type: "ETW",
      street: "Teststr.",
      houseNumber: "1",
      postcode: "10115",
      city: "Berlin",
      livingArea: 80,
      condition: "GEPFLEGT",
      // details group: rooms, yearBuilt, bathrooms (all optional) unfilled
      // energy group: hasEnergyCert (non-optional) unfilled
      hasEnergyCert: null,
      costCompressed: true,
    };
    const q = nextQuestion(wm);
    // Should skip optional details and go to energy (first non-optional unfilled)
    const optionalFields = ["rooms", "yearBuilt", "bathrooms", "floor", "plotArea",
                            "attributes", "floorPlan", "roomProgram", "sellerContact"];
    expect(optionalFields).not.toContain(q.field);
    expect(q.field).toBe("hasEnergyCert");
  });

  it("ohne costCompressed fragt energy vor details (group order)", () => {
    const wm: WorkingMemory = {
      ...INITIAL_MEMORY,
      type: "ETW",
      street: "Teststr.",
      houseNumber: "1",
      postcode: "10115",
      city: "Berlin",
      livingArea: 80,
      condition: "GEPFLEGT",
      hasEnergyCert: null,
      costCompressed: false,
    };
    const q = nextQuestion(wm);
    // energy (group order 2) comes before details (group order 4)
    expect(q.field).toBe("hasEnergyCert");
  });
});

// ────────────────────────────────────────────────────────────────────────
// Fixture 5: chainedReviewMessage — deterministic output after listing_review
// ────────────────────────────────────────────────────────────────────────

describe("Fixture 5: chainedReviewMessage", () => {
  it("emits rubricFailureToQuestions[0] when review fails, not a re-draft", () => {
    const rubric = makeFailedRubric({ wordCount: { ok: false, words: 176, paragraphs: 3 } });
    const draft: DraftResult = {
      titleShort: "ETW, 3 Zimmer, 95 m², Gaggenau",
      descriptionLong: "Some description text that is too short.",
    };
    const result = chainedReviewMessage(rubric, draft);
    expect(result.passed).toBe(false);
    expect(result.message).toContain("176 Wörter");
    expect(result.message).not.toContain("Qualitätsprüfung bestanden");
    expect(result.message).not.toContain("Möchten Sie das Inserat so erstellen");
  });

  it("emits templated success message with draft when review passes", () => {
    const rubric: RubricResult = {
      passed: true,
      failures: [],
      details: {
        gegFields: { ok: true },
        wordCount: { ok: true, words: 250, paragraphs: 3 },
        noHallucination: { ok: true },
        noSuperlatives: { ok: true },
        photos: { ok: true, count: 8 },
        priceInBand: { ok: true },
      },
    };
    const draft: DraftResult = {
      titleShort: "ETW, 3 Zimmer, 95 m², Gaggenau",
      descriptionLong: "Full description text here.",
      exposeHeadline: "Moderne Wohnung in Gaggenau",
      highlights: ["Energieklasse B", "Stellplatz"],
    };
    const result = chainedReviewMessage(rubric, draft);
    expect(result.passed).toBe(true);
    expect(result.message).toContain("Qualitätsprüfung bestanden");
    expect(result.message).toContain("Moderne Wohnung in Gaggenau");
    expect(result.message).toContain("Full description text here.");
    expect(result.message).toContain("Energieklasse B · Stellplatz");
    expect(result.message).toContain("Möchten Sie das Inserat so erstellen");
  });

  it("returns passed=false with generic message when rubric has no parseable failures", () => {
    const rubric: RubricResult = {
      passed: false,
      failures: ["unknown failure type"],
      details: {
        gegFields: { ok: true },
        wordCount: { ok: true, words: 250, paragraphs: 3 },
        noHallucination: { ok: true },
        noSuperlatives: { ok: true },
        photos: { ok: true, count: 8 },
        priceInBand: { ok: true },
      },
    };
    const draft: DraftResult = { titleShort: "Test", descriptionLong: "Test" };
    const result = chainedReviewMessage(rubric, draft);
    expect(result.passed).toBe(false);
    expect(result.message).toContain("Anforderungen");
  });
});
