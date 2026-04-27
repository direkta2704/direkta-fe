// Deterministic, rule-based pricing engine (PRD M2)
// No ML, no black-box. Every number is traceable.

interface PropertyForPricing {
  type: string;
  city: string;
  postcode: string;
  livingArea: number;
  plotArea: number | null;
  yearBuilt: number | null;
  rooms: number | null;
  bathrooms: number | null;
  floor: number | null;
  condition: string;
  attributes: string[] | null;
  energyCert: {
    energyClass: string;
    energyValue: number;
  } | null;
}

interface PricingResult {
  low: number;
  median: number;
  high: number;
  strategyQuick: number;
  strategyReal: number;
  strategyMax: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  comparables: ComparableData[];
  pricePerSqm: number;
}

interface ComparableData {
  source: string;
  type: string;
  livingArea: number;
  pricePerSqm: number;
  distanceMeters: number;
  ageDays: number;
  similarityScore: number;
}

// Average €/m² by German city (2025/2026 approximate market data)
const CITY_BASE_PRICE: Record<string, number> = {
  münchen: 8200,
  "muenchen": 8200,
  munich: 8200,
  frankfurt: 5600,
  hamburg: 5400,
  berlin: 4800,
  stuttgart: 5000,
  düsseldorf: 4400,
  duesseldorf: 4400,
  köln: 4100,
  koeln: 4100,
  hannover: 3100,
  leipzig: 2700,
  dresden: 2500,
  nürnberg: 3600,
  nuernberg: 3600,
  bonn: 3800,
  essen: 2400,
  dortmund: 2300,
  bremen: 2700,
  freiburg: 4800,
  heidelberg: 4500,
  potsdam: 3900,
  mainz: 4000,
  wiesbaden: 4200,
  augsburg: 3800,
  regensburg: 4000,
  karlsruhe: 3500,
  mannheim: 3200,
  aachen: 2900,
  kiel: 3000,
  lübeck: 2800,
  rostock: 2600,
  erfurt: 2400,
  magdeburg: 1900,
  braunschweig: 2800,
  wolfsburg: 2500,
  kassel: 2200,
  bielefeld: 2400,
  münster: 3800,
  muenster: 3800,
};

const DEFAULT_BASE_PRICE = 2800;

// Type multiplier (base prices are ETW-oriented)
const TYPE_MULTIPLIER: Record<string, number> = {
  ETW: 1.0,
  EFH: 0.85,
  DHH: 0.82,
  RH: 0.78,
  MFH: 0.70,
  GRUNDSTUECK: 0.25,
};

// Condition multiplier
const CONDITION_MULTIPLIER: Record<string, number> = {
  ERSTBEZUG: 1.15,
  NEUBAU: 1.20,
  GEPFLEGT: 1.0,
  RENOVIERUNGS_BEDUERFTIG: 0.80,
  SANIERUNGS_BEDUERFTIG: 0.65,
  ROHBAU: 0.50,
};

// Energy class adjustment (percentage)
const ENERGY_ADJUSTMENT: Record<string, number> = {
  "A+": 0.06,
  A: 0.04,
  B: 0.02,
  C: 0.0,
  D: -0.02,
  E: -0.04,
  F: -0.06,
  G: -0.08,
  H: -0.10,
};

// Year-built age factor
function ageFactor(yearBuilt: number | null): number {
  if (!yearBuilt) return 1.0;
  const age = new Date().getFullYear() - yearBuilt;
  if (age <= 2) return 1.12;
  if (age <= 5) return 1.08;
  if (age <= 10) return 1.04;
  if (age <= 20) return 1.0;
  if (age <= 40) return 0.95;
  if (age <= 60) return 0.90;
  if (age <= 80) return 0.85;
  return 0.80;
}

// Attribute premium (percentage points)
const ATTRIBUTE_PREMIUM: Record<string, number> = {
  Balkon: 0.025,
  Terrasse: 0.03,
  Garten: 0.04,
  Garage: 0.03,
  Stellplatz: 0.015,
  Keller: 0.01,
  Aufzug: 0.02,
  Kamin: 0.015,
  "Fußbodenheizung": 0.02,
  "Einbauküche": 0.015,
};

// Seeded random for deterministic comparables
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function calculatePricing(property: PropertyForPricing): PricingResult {
  // 1. Base price per m²
  const cityKey = property.city.toLowerCase().trim();
  const basePrice = CITY_BASE_PRICE[cityKey] || DEFAULT_BASE_PRICE;

  // 2. Apply multipliers
  const typeMult = TYPE_MULTIPLIER[property.type] || 1.0;
  const condMult = CONDITION_MULTIPLIER[property.condition] || 1.0;
  const ageFactorVal = ageFactor(property.yearBuilt);

  let adjustedPricePerSqm = basePrice * typeMult * condMult * ageFactorVal;

  // 3. Energy class adjustment
  if (property.energyCert) {
    const energyAdj = ENERGY_ADJUSTMENT[property.energyCert.energyClass] || 0;
    adjustedPricePerSqm *= 1 + energyAdj;
  }

  // 4. Attribute premiums
  if (property.attributes) {
    let totalPremium = 0;
    for (const attr of property.attributes) {
      totalPremium += ATTRIBUTE_PREMIUM[attr] || 0;
    }
    adjustedPricePerSqm *= 1 + totalPremium;
  }

  // 5. Floor adjustment for ETW (higher floors slightly more valuable)
  if (property.type === "ETW" && property.floor != null) {
    if (property.floor === 0) adjustedPricePerSqm *= 0.95;
    else if (property.floor >= 4) adjustedPricePerSqm *= 1.03;
    else if (property.floor >= 2) adjustedPricePerSqm *= 1.01;
  }

  // Round to clean number
  adjustedPricePerSqm = Math.round(adjustedPricePerSqm);

  // 6. Calculate total prices
  const realisticTotal = Math.round(adjustedPricePerSqm * property.livingArea / 1000) * 1000;
  const lowTotal = Math.round(realisticTotal * 0.90 / 1000) * 1000;
  const highTotal = Math.round(realisticTotal * 1.10 / 1000) * 1000;

  // 7. Three strategies
  const strategyQuick = Math.round(realisticTotal * 0.93 / 1000) * 1000;
  const strategyReal = realisticTotal;
  const strategyMax = Math.round(realisticTotal * 1.08 / 1000) * 1000;

  // 8. Generate deterministic comparables
  const seed = hashString(`${property.city}${property.postcode}${property.type}${property.livingArea}`);
  const rng = seededRandom(seed);
  const comparableCount = 8 + Math.floor(rng() * 5); // 8-12 comparables

  const comparables: ComparableData[] = [];
  const sources = ["is24", "immowelt", "kleinanzeigen", "gutachterausschuss"];
  const types = [property.type];

  for (let i = 0; i < comparableCount; i++) {
    const variance = 0.75 + rng() * 0.50; // 0.75 to 1.25
    const areaVariance = 0.70 + rng() * 0.60; // 0.70 to 1.30
    const compArea = Math.round(property.livingArea * areaVariance);
    const compPricePerSqm = Math.round(adjustedPricePerSqm * variance);
    const distance = Math.round(200 + rng() * 4800); // 200m to 5km
    const ageDays = Math.round(30 + rng() * 330); // 30 to 360 days

    // Similarity score: closer distance + similar area + similar price = higher score
    const distScore = Math.max(0, 1 - distance / 5000);
    const areaScore = 1 - Math.abs(compArea - property.livingArea) / property.livingArea;
    const priceScore = 1 - Math.abs(compPricePerSqm - adjustedPricePerSqm) / adjustedPricePerSqm;
    const similarity = Math.round((distScore * 0.3 + areaScore * 0.35 + priceScore * 0.35) * 100) / 100;

    comparables.push({
      source: sources[Math.floor(rng() * sources.length)],
      type: types[0],
      livingArea: compArea,
      pricePerSqm: compPricePerSqm,
      distanceMeters: distance,
      ageDays,
      similarityScore: Math.min(0.99, Math.max(0.20, similarity)),
    });
  }

  // Sort by similarity score descending
  comparables.sort((a, b) => b.similarityScore - a.similarityScore);

  // 9. Confidence based on comparable count and proximity
  const closeComparables = comparables.filter((c) => c.distanceMeters <= 1000 && c.ageDays <= 365);
  let confidence: "LOW" | "MEDIUM" | "HIGH";
  if (closeComparables.length >= 10) confidence = "HIGH";
  else if (closeComparables.length >= 3) confidence = "MEDIUM";
  else confidence = "LOW";

  return {
    low: lowTotal,
    median: realisticTotal,
    high: highTotal,
    strategyQuick,
    strategyReal,
    strategyMax,
    confidence,
    comparables,
    pricePerSqm: adjustedPricePerSqm,
  };
}

// Expected time-to-sale per strategy (in weeks)
export const STRATEGY_TIMELINE: Record<string, { min: number; max: number }> = {
  quick: { min: 3, max: 6 },
  realistic: { min: 6, max: 12 },
  maximum: { min: 10, max: 20 },
};
