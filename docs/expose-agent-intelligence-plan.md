# Expose Agent Intelligence Upgrade — Implementation Plan

## Context

The Add Property flow in the UI collects data across 13 sections on the property detail page. The expose agent currently handles 9 of these. This plan closes the remaining gaps and makes the agent truly mirror the full flow.

---

## Current State (what works)

| # | Feature | Agent Status |
|---|---------|-------------|
| 1 | Property basics (type, address, area, rooms, condition) | Works |
| 2 | Energy certificate (type, class, value, source, validUntil, PDF) | Works |
| 3 | Photo uploads (building + per-unit) | Works |
| 4 | Photo AI analysis (roomType, quality, features, caption) | Works |
| 5 | Room program (room names + areas) | Works |
| 6 | MFH unit details (label, area, rooms, baths, floor) | Works |
| 7 | Selling mode (INDIVIDUAL / BUNDLE / BOTH) | Works |
| 8 | Pricing pipeline (pricing → draft → review) | Works |
| 9 | Handoff (creates Property + units + listings + PDF) | Works |

---

## Gaps to Close (ordered by impact)

### GAP 1: Extras with Pricing (Critical)

**What the UI does:** Each property has an `extras` JSON field storing items the seller offers alongside the property — parking spaces, storage units, garages — each with a name, quantity, individual price, and optional description.

**Prisma field:** `Property.extras: Json?`

**Data structure:**
```typescript
interface PropertyExtra {
  name: string;           // "TG-Stellplatz", "Außenstellplatz", "Kellerabteil"
  quantity: number;       // 2
  pricePerUnit: number;   // 15000
  description?: string;   // "Tiefgarage Ebene -1"
}
```

**Changes needed:**

1. **WorkingMemory** — Replace `outdoorParking: number | null` and `undergroundParking: number | null` with:
   ```typescript
   extras: PropertyExtra[];
   ```

2. **INITIAL_MEMORY** — Set `extras: []`

3. **FIELD_PRIORITY** — Add `extras` field in `details` group (optional, high infoValue for MFH):
   ```typescript
   {
     field: "extras",
     group: "mfh_structure",
     blocksPricing: false,
     blocksPublish: false,
     infoValue: 0.7,
     optional: true,
     isFilled: wm => wm.extras.length > 0 || wm.type !== "MFH",
     prompt: "Hat die Immobilie Extras wie Stellplätze oder Kellerabteile? Wenn ja: Name, Anzahl und Preis pro Stück."
   }
   ```

4. **normalizeUserPatch** — Parse extras from extraction:
   ```typescript
   if (Array.isArray(data.extras)) {
     patch.extras = data.extras.map((e: Record<string, unknown>) => ({
       name: String(e.name || ""),
       quantity: typeof e.quantity === "number" ? e.quantity : 1,
       pricePerUnit: typeof e.pricePerUnit === "number" ? e.pricePerUnit : 0,
       description: typeof e.description === "string" ? e.description : undefined,
     })).filter(e => e.name);
   }
   ```

5. **applyPatch** — Add merge logic (append, deduplicate by name):
   ```typescript
   } else if (k === "extras" && Array.isArray(v)) {
     const incoming = v as PropertyExtra[];
     const existing = new Map(next.extras.map(e => [e.name, e]));
     for (const e of incoming) existing.set(e.name, e);
     next.extras = Array.from(existing.values());
   }
   ```

6. **Extraction prompt** — Add to allowed fields:
   ```
   - extras: Array von { name, quantity, pricePerUnit, description } — Extras wie Stellplätze, Kellerabteile mit Stückpreis
   ```

7. **buildMemoryContext** — Show extras in memory context:
   ```
   Extras: ${m.extras.length > 0 ? m.extras.map(e => `${e.name} ×${e.quantity} à ${e.pricePerUnit}€`).join(", ") : "—"}
   ```

8. **System prompt** — Add section after MFH phases:
   ```
   ═══ EXTRAS & STELLPLÄTZE ═══
   Nach den Wohnungen, frage:
   "Hat die Immobilie Extras wie Stellplätze, Kellerabteile oder Garagen, die separat bepreist werden?"
   Erfasse: Name (z.B. TG-Stellplatz), Anzahl, Preis pro Stück.
   Beispiel: "6 TG-Stellplätze à 15.000€, 10 Außenstellplätze à 8.000€"
   Speichere als extras: [{ name: "TG-Stellplatz", quantity: 6, pricePerUnit: 15000 }, ...]
   ```

9. **Handoff route** — Write extras to property:
   ```typescript
   extras: memory.extras.length > 0 ? memory.extras : undefined,
   ```

10. **Draft prompt** — Include extras in property summary so the AI description mentions them:
    ```
    Extras: ${m.extras.map(e => `${e.quantity}× ${e.name} (${e.pricePerUnit}€/Stk)`).join(", ")}
    ```

11. **Remove** `outdoorParking` and `undergroundParking` — these are now subsumed by extras. Parking is just an extra with a name like "Außenstellplatz".

---

### GAP 2: Specifications (Moderate)

**What the UI does:** 7 categories of construction/material specifications, stored as nested key-value pairs.

**Prisma field:** `Property.specifications: Json?`

**Data structure:**
```typescript
type Specifications = Record<string, Record<string, string>>;
// Example:
// {
//   "Boden": { "Wohnbereich": "Eichenparkett, geölt", "Bad": "Fliesen" },
//   "Heizung & Warmwasser": { "Typ": "Fußbodenheizung", "Quelle": "Gas-Brennwert" }
// }
```

**Categories:**
1. Boden
2. Waende & Decke
3. Sanitaer
4. Heizung & Warmwasser
5. Elektro & Smart Home
6. Kueche
7. Tueren & Fenster

**Changes needed:**

1. **WorkingMemory** — Add:
   ```typescript
   specifications: Record<string, Record<string, string>>;
   ```

2. **INITIAL_MEMORY** — Set `specifications: {}`

3. **FIELD_PRIORITY** — Add as optional field in `details` group:
   ```typescript
   {
     field: "specifications",
     group: "details",
     blocksPricing: false,
     blocksPublish: false,
     infoValue: 0.5,
     optional: true,
     isFilled: wm => Object.keys(wm.specifications).length > 0,
     prompt: "Welche Ausstattungsdetails können Sie nennen? Z.B. Bodenbelag (Parkett, Fliesen), Heizungsart, Küche, Fenster?"
   }
   ```

4. **normalizeUserPatch** — Parse specifications:
   ```typescript
   if (data.specifications && typeof data.specifications === "object") {
     patch.specifications = data.specifications as Record<string, Record<string, string>>;
   }
   ```

5. **Extraction prompt** — Add:
   ```
   - specifications: Verschachtelte Ausstattungsdetails { "Boden": { "Wohnbereich": "Parkett" }, "Heizung & Warmwasser": { "Typ": "Fußbodenheizung" } }
     Kategorien: Boden, Waende & Decke, Sanitaer, Heizung & Warmwasser, Elektro & Smart Home, Kueche, Tueren & Fenster
   ```

6. **System prompt** — Add after attributes question:
   ```
   AUSSTATTUNGSDETAILS (optional):
   Wenn der Verkäufer Details zu Materialien nennt ("Parkett", "Fliesen im Bad", "Kunststofffenster"),
   ordne sie der richtigen Kategorie zu:
   - "Parkett" / "Laminat" / "Fliesen" → Boden
   - "Fußbodenheizung" / "Gas-Brennwert" → Heizung & Warmwasser
   - "Einbauküche" / "Granitarbeitsplatte" → Kueche
   Frage NICHT aktiv nach jeder Kategorie — extrahiere was der Verkäufer von sich aus sagt.
   ```

7. **Handoff route** — Write specifications:
   ```typescript
   specifications: Object.keys(memory.specifications).length > 0 ? memory.specifications : undefined,
   ```

8. **Draft prompt** — Include specs in property summary for better expose text.

---

### GAP 3: Tagline (Minor)

**What the UI does:** Optional one-line tagline like "Drei Wohnungen. Ein Standard."

**Prisma field:** `Property.tagline: String?`

**Changes needed:**

1. **WorkingMemory** — Add `tagline: string | null`
2. **listing_draft tool** — Generate tagline in the metadata call (already produces `exposeHeadline` which is similar)
3. **Handoff route** — Write tagline:
   ```typescript
   tagline: memory.draft?.exposeHeadline || null,
   ```
   Use the `exposeHeadline` as the tagline since they serve the same purpose.

---

### GAP 4: Handoff Uses Listing API Logic (Moderate)

**Current state:** The handoff route duplicates listing creation logic (slug generation, pricing, draft). The UI uses `POST /api/listings` which auto-generates title, description, pricing, and expose content.

**Problem:** Two code paths that can drift apart.

**Solution:** After creating the property in the handoff, call the listing API's generation functions (`generateListingTexts`, `generateExposeContent`) instead of using the agent's own draft. This ensures consistency.

**However:** The agent's draft has already been reviewed by the rubric. The listing API would generate a NEW draft that hasn't been reviewed. So we should keep the agent's draft but supplement it with fields the listing API generates that the agent doesn't (like `highlights` which it already does, `locationDescription`, `buildingDescription`).

**Recommended approach:** Keep current handoff logic but add missing fields:
- Write `tagline` from `exposeHeadline`
- Write `extras` from WorkingMemory
- Write `specifications` from WorkingMemory
- The handoff already writes `locationDescription`, `buildingDescription`, `highlights`, `exposeHeadline`, `exposeSubheadline`

---

### GAP 5: Per-Unit Extras (Low priority)

**What the UI does:** Each unit (child Property) can have its own `extras` field.

**Current challenge:** The agent collects unit data as `UnitData[]` which only has label, area, rooms, baths, floor, features, askingPrice. No per-unit extras.

**Recommendation:** Defer. Building-level extras cover 90% of cases. Per-unit extras (e.g., "WE1 gets TG-Stellplatz 3 and 4") are edge cases that the seller can assign manually after handoff on the property detail page.

---

## Implementation Order

| Phase | What | Files Changed | Effort |
|-------|------|---------------|--------|
| **Phase 1** | Extras with pricing | expose-agent.ts, handoff/route.ts | Medium |
| **Phase 2** | Specifications | expose-agent.ts, handoff/route.ts | Small |
| **Phase 3** | Tagline | expose-agent.ts, handoff/route.ts | Tiny |
| **Phase 4** | Clean up outdoorParking/undergroundParking → extras migration | expose-agent.ts, handoff/route.ts, properties/new/page.tsx | Small |
| **Phase 5** | Draft prompt enrichment (use specs + extras for better text) | expose-agent.ts | Small |

---

## Phase 1 Detail: Extras Implementation

### Step 1.1 — Define PropertyExtra type and add to WorkingMemory

In `expose-agent.ts`, add after UnitData interface:
```typescript
export interface PropertyExtra {
  name: string;
  quantity: number;
  pricePerUnit: number;
  description?: string;
}
```

Replace `outdoorParking`/`undergroundParking` in WorkingMemory with:
```typescript
extras: PropertyExtra[];
```

### Step 1.2 — Update INITIAL_MEMORY

Replace parking fields with:
```typescript
extras: [],
```

### Step 1.3 — Update FIELD_PRIORITY

Add extras field in `mfh_structure` group (after sellingMode):
```typescript
{
  field: "extras",
  group: "mfh_structure",
  blocksPricing: false,
  blocksPublish: false,
  infoValue: 0.7,
  optional: true,
  isFilled: wm => wm.extras.length > 0 || (wm.type !== "MFH" && wm.type !== "EFH"),
  prompt: "Hat die Immobilie Extras wie Stellplätze oder Kellerabteile? Wenn ja: Name, Anzahl und Preis."
}
```

### Step 1.4 — Update normalizeUserPatch

Add extras parsing. Also handle backward-compat: if `outdoorParking`/`undergroundParking` are received, convert to extras format.

### Step 1.5 — Update applyPatch

Add extras merge logic with deduplication by name.

### Step 1.6 — Update extraction prompt

Add extras as allowed field with example.

### Step 1.7 — Update buildMemoryContext

Show extras in memory context.

### Step 1.8 — Update system prompt

Add EXTRAS section in MFH flow and general flow.

### Step 1.9 — Update summarizeProperty

Include extras so the draft LLM knows about them.

### Step 1.10 — Update handoff route

- Write `extras` to parent property
- Remove separate parking logic from buildingInfo
- Include extras pricing in total property value context

### Step 1.11 — Update bulk extraction example

Add extras to the example JSON.

### Step 1.12 — Update readAgentPrefill (properties/new/page.tsx)

Remove outdoorParking/undergroundParking mapping, not needed since extras go directly to the property.

---

## Phase 2 Detail: Specifications Implementation

### Step 2.1 — Add to WorkingMemory

```typescript
specifications: Record<string, Record<string, string>>;
```

### Step 2.2 — Update INITIAL_MEMORY

```typescript
specifications: {},
```

### Step 2.3 — Add to FIELD_PRIORITY

Optional field in `details` group. Low priority — extracted passively from what the seller says rather than actively asked.

### Step 2.4 — Update normalizeUserPatch

Parse nested specification object.

### Step 2.5 — Update extraction prompt

Add specifications with category names as example.

### Step 2.6 — Update system prompt

Passive extraction instructions — detect when seller mentions materials/finishes.

### Step 2.7 — Update summarizeProperty

Include specifications for better draft quality.

### Step 2.8 — Update handoff route

Write `specifications` to property.

---

## Phase 3 Detail: Tagline

### Step 3.1 — Map exposeHeadline to tagline in handoff

Already generated by `listing_draft` tool. Just write it to `property.tagline` in the handoff.

---

## Phase 4 Detail: Cleanup

### Step 4.1 — Remove outdoorParking/undergroundParking

These are now represented as extras entries.

### Step 4.2 — Migration in normalizeUserPatch

If extraction returns `outdoorParking: 10`, convert to:
```typescript
extras: [{ name: "Außenstellplatz", quantity: 10, pricePerUnit: 0 }]
```

### Step 4.3 — Update buildMemoryContext

Remove parking lines, show extras instead.

### Step 4.4 — Update readAgentPrefill

Remove parking mapping.

---

## Phase 5 Detail: Draft Enrichment

### Step 5.1 — Update DRAFT_DESCRIPTION_PROMPT

Add instruction to use specifications data:
```
Wenn Ausstattungsdetails vorhanden (Boden, Heizung, etc.), erwähne diese konkret:
"Eichenparkett in den Wohnräumen, Fliesen in den Bädern" statt "hochwertiger Bodenbelag".
```

### Step 5.2 — Update summarizeProperty

Include extras and specifications in the summary sent to the draft LLM.

---

## Expected Results After All Phases

A seller conversation like:
```
"MFH, Marktstraße 12, 76571 Gaggenau, 250qm, BJ 99, gepflegt.
 Parkett in allen Wohnungen, Fliesen im Bad, Fußbodenheizung.
 3 Wohnungen: WE1 95qm 3Zi OG, WE2 95qm 3Zi EG, WE3 55qm 2Zi EG.
 6 TG-Stellplätze à 15.000€, 10 Außenstellplätze à 8.000€, 3 Kellerabteile à 5.000€.
 Verkauf: beides. Preis: 525.000€.
 Energie: Verbrauch B 70kWh Gas bis 2034-03."
```

Would produce a property with:
- All basics filled
- `extras: [{ name: "TG-Stellplatz", quantity: 6, pricePerUnit: 15000 }, { name: "Außenstellplatz", quantity: 10, pricePerUnit: 8000 }, { name: "Kellerabteil", quantity: 3, pricePerUnit: 5000 }]`
- `specifications: { "Boden": { "Wohnräume": "Parkett", "Bad": "Fliesen" }, "Heizung & Warmwasser": { "Typ": "Fußbodenheizung" } }`
- `tagline: "Vielfalt unter einem Dach"` (from exposeHeadline)
- Total value context: 525.000€ + 6×15.000€ + 10×8.000€ + 3×5.000€ = 525.000€ + 185.000€ = 710.000€

The AI draft would include: "Die Wohnräume sind mit Parkett ausgestattet, die Bäder gefliest. Eine Fußbodenheizung sorgt für angenehme Wärme. Zum Angebot gehören zusätzlich 6 Tiefgaragenstellplätze, 10 Außenstellplätze und 3 Kellerabteile."
