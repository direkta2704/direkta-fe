import { NextResponse } from "next/server";
import { calculatePricing } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { type, city, postcode, livingArea, plotArea, yearBuilt, rooms, bathrooms, floor, condition } = body;

    if (!type || !city || !livingArea || !condition) {
      return NextResponse.json({ error: "Pflichtfelder fehlen" }, { status: 400 });
    }

    const result = calculatePricing({
      type,
      city,
      postcode: postcode || "",
      livingArea: parseFloat(livingArea),
      plotArea: plotArea ? parseFloat(plotArea) : null,
      yearBuilt: yearBuilt ? parseInt(yearBuilt) : null,
      rooms: rooms ? parseFloat(rooms) : null,
      bathrooms: bathrooms ? parseInt(bathrooms) : null,
      floor: floor != null ? parseInt(floor) : null,
      condition,
      attributes: null,
      energyCert: null,
    });

    return NextResponse.json({
      low: result.low,
      median: result.median,
      high: result.high,
      strategyQuick: result.strategyQuick,
      strategyReal: result.strategyReal,
      strategyMax: result.strategyMax,
      pricePerSqm: result.pricePerSqm,
      confidence: result.confidence,
      comparableCount: result.comparables.length,
    });
  } catch (err) {
    console.error("Valuation error:", err);
    return NextResponse.json({ error: "Bewertung fehlgeschlagen" }, { status: 500 });
  }
}
