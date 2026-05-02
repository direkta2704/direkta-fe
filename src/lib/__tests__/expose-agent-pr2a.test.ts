import { describe, it, expect } from "vitest";
import { rebuildMemory } from "../expose-agent";

interface PersistedTurn {
  role: string;
  content: string;
  toolName?: string | null;
  toolOutput?: unknown;
}

describe("PR2a: FieldBelief persistence", () => {
  it("beliefs from user/ocr/photo all survive rebuildMemory round-trip", () => {
    const turns: PersistedTurn[] = [
      {
        role: "TOOL", content: "memory_extract", toolName: "memory_extract",
        toolOutput: {
          memoryPatch: {
            type: "ETW", livingArea: 75,
            beliefs: {
              type: { value: "ETW", confidence: 0.95, source: "user", lastConfirmedTurn: 1 },
              livingArea: { value: 75, confidence: 0.9, source: "user", lastConfirmedTurn: 1 },
            },
          },
        },
      },
      {
        role: "TOOL", content: "energy_extract", toolName: "energy_extract",
        toolOutput: {
          memoryPatch: {
            hasEnergyCert: true, energyClass: "B", energyValue: 70.2,
            beliefs: {
              energyClass: { value: "B", confidence: 0.85, source: "ocr", lastConfirmedTurn: 3 },
              energyValue: { value: 70.2, confidence: 0.85, source: "ocr", lastConfirmedTurn: 3 },
            },
          },
        },
      },
      {
        role: "TOOL", content: "photo_analyse", toolName: "photo_analyse",
        toolOutput: {
          memoryPatch: {
            beliefs: {
              attributes: { value: ["Kamin"], confidence: 0.7, source: "photo", lastConfirmedTurn: 5 },
            },
          },
        },
      },
    ];
    const wm = rebuildMemory(turns);
    expect(wm.type).toBe("ETW");
    expect(wm.livingArea).toBe(75);
    expect(wm.energyClass).toBe("B");
    expect(wm.energyValue).toBe(70.2);
    expect(wm.beliefs.type?.value).toBe("ETW");
    expect(wm.beliefs.type?.source).toBe("user");
    expect(wm.beliefs.livingArea?.value).toBe(75);
    expect(wm.beliefs.livingArea?.source).toBe("user");
    expect(wm.beliefs.energyClass?.value).toBe("B");
    expect(wm.beliefs.energyClass?.source).toBe("ocr");
    expect(wm.beliefs.energyValue?.value).toBe(70.2);
    expect(wm.beliefs.energyValue?.source).toBe("ocr");
    expect(wm.beliefs.attributes?.value).toEqual(["Kamin"]);
    expect(wm.beliefs.attributes?.source).toBe("photo");
    expect(wm.beliefs.attributes?.confidence).toBe(0.7);
  });

  it("same field from user then OCR with different value → conflict accumulated", () => {
    const turns: PersistedTurn[] = [
      {
        role: "TOOL", content: "memory_extract", toolName: "memory_extract",
        toolOutput: {
          memoryPatch: {
            yearBuilt: 1990,
            beliefs: {
              yearBuilt: { value: 1990, confidence: 0.9, source: "user", lastConfirmedTurn: 3 },
            },
          },
        },
      },
      {
        role: "TOOL", content: "energy_extract", toolName: "energy_extract",
        toolOutput: {
          memoryPatch: {
            yearBuilt: 1987,
            beliefs: {
              yearBuilt: { value: 1987, confidence: 0.85, source: "ocr", lastConfirmedTurn: 7 },
            },
          },
        },
      },
    ];
    const wm = rebuildMemory(turns);
    expect(wm.yearBuilt).toBe(1987);
    expect(wm.beliefs.yearBuilt?.value).toBe(1987);
    expect(wm.beliefs.yearBuilt?.source).toBe("ocr");
    expect(wm.beliefs.yearBuilt?.lastConfirmedTurn).toBe(7);
    expect(wm.beliefs.yearBuilt?.conflictsWith).toHaveLength(1);
    expect(wm.beliefs.yearBuilt?.conflictsWith?.[0]).toEqual(
      { source: "user", value: 1990, turn: 3 },
    );
  });

  it("same field from user then OCR with same value → confidence bumped, no conflict", () => {
    const turns: PersistedTurn[] = [
      {
        role: "TOOL", content: "memory_extract", toolName: "memory_extract",
        toolOutput: {
          memoryPatch: {
            energyClass: "B",
            beliefs: {
              energyClass: { value: "B", confidence: 0.9, source: "user", lastConfirmedTurn: 3 },
            },
          },
        },
      },
      {
        role: "TOOL", content: "energy_extract", toolName: "energy_extract",
        toolOutput: {
          memoryPatch: {
            energyClass: "B",
            beliefs: {
              energyClass: { value: "B", confidence: 0.85, source: "ocr", lastConfirmedTurn: 7 },
            },
          },
        },
      },
    ];
    const wm = rebuildMemory(turns);
    expect(wm.energyClass).toBe("B");
    expect(wm.beliefs.energyClass?.value).toBe("B");
    expect(wm.beliefs.energyClass?.source).toBe("ocr");
    expect(wm.beliefs.energyClass?.confidence).toBe(0.95);
    expect(wm.beliefs.energyClass?.conflictsWith).toBeUndefined();
  });

  // ─── Test 4: lastConfirmedTurn is threaded, not defaulted to zero ───
  it("lastConfirmedTurn reflects the turn number, not a silent default", () => {
    // Convention: 0-based index of user turns. Turn N writes lastConfirmedTurn=N.
    // This test uses turn 4 — if threading broke and defaulted to 0, it would fail.
    const turns: PersistedTurn[] = [
      {
        role: "TOOL", content: "memory_extract", toolName: "memory_extract",
        toolOutput: {
          memoryPatch: {
            livingArea: 120,
            beliefs: {
              livingArea: { value: 120, confidence: 0.9, source: "user", lastConfirmedTurn: 4 },
            },
          },
        },
      },
    ];
    const wm = rebuildMemory(turns);
    expect(wm.beliefs.livingArea?.lastConfirmedTurn).toBe(4);
    expect(wm.beliefs.livingArea?.lastConfirmedTurn).not.toBe(0);
  });
});
