export interface TrendPoint {
  month: string;
  pricePerSqm: number;
}

export function getMarketTrend(postcode: string, propertyType: string): TrendPoint[] {
  // MVP: synthetic trend based on postcode and type
  // Post-MVP: real data from Gutachterausschuss or transaction history
  const prefix = postcode.slice(0, 2);
  const basePrice = getBasePrice(prefix, propertyType);

  const points: TrendPoint[] = [];
  const now = new Date();

  for (let i = 23; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);
    const month = date.toLocaleDateString("de-DE", { month: "short", year: "2-digit" });

    // Simulate realistic German market trend (slight growth with seasonal variation)
    const seasonFactor = 1 + 0.02 * Math.sin((date.getMonth() / 12) * 2 * Math.PI);
    const growthFactor = 1 + (0.03 * (24 - i) / 24); // ~3% annual growth
    const noise = 1 + (Math.sin(i * 7 + parseInt(prefix)) * 0.015);

    points.push({
      month,
      pricePerSqm: Math.round(basePrice * seasonFactor * growthFactor * noise),
    });
  }

  return points;
}

function getBasePrice(postcodePrefix: string, type: string): number {
  const cityPrices: Record<string, number> = {
    "10": 5200, "12": 4800, "13": 4500, // Berlin
    "20": 5500, "22": 5000, // Hamburg
    "80": 7500, "81": 7000, // München
    "50": 3800, "51": 3500, // Köln
    "60": 4500, "61": 4000, // Frankfurt
    "70": 4200, "71": 3800, // Stuttgart
    "40": 3600, "41": 3400, // Düsseldorf
    "30": 3200, "31": 2800, // Hannover
    "76": 2600, "77": 2400, // Baden (Gaggenau area)
    "01": 2800, "04": 2500, // Leipzig/Dresden
  };

  const base = cityPrices[postcodePrefix] || 2500;
  const typeMultiplier = type === "ETW" ? 1.0 : type === "EFH" ? 0.85 : type === "MFH" ? 0.7 : 0.8;
  return Math.round(base * typeMultiplier);
}
