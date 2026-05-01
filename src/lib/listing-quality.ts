export interface QualityBreakdown {
  score: number;
  items: { label: string; points: number; maxPoints: number; ok: boolean }[];
}

export function calculateListingQuality(data: {
  hasTitle: boolean;
  titleLength: number;
  hasDescription: boolean;
  descriptionWords: number;
  hasPrice: boolean;
  photoCount: number;
  hasEnergyCert: boolean;
  hasFloorPlan: boolean;
  hasPriceRecommendation: boolean;
  hasAttributes: boolean;
  attributeCount: number;
  hasContact: boolean;
}): QualityBreakdown {
  const items: QualityBreakdown["items"] = [];

  // Title (10 pts)
  const titlePts = data.hasTitle ? (data.titleLength >= 40 ? 10 : data.titleLength >= 20 ? 7 : 4) : 0;
  items.push({ label: "Kurzbeschreibung", points: titlePts, maxPoints: 10, ok: titlePts >= 7 });

  // Description (20 pts)
  const descPts = data.hasDescription ? (data.descriptionWords >= 250 ? 20 : data.descriptionWords >= 150 ? 15 : data.descriptionWords >= 50 ? 10 : 5) : 0;
  items.push({ label: "Langbeschreibung", points: descPts, maxPoints: 20, ok: descPts >= 15 });

  // Price (10 pts)
  const pricePts = data.hasPrice ? 10 : 0;
  items.push({ label: "Angebotspreis", points: pricePts, maxPoints: 10, ok: pricePts > 0 });

  // Photos (25 pts)
  const photoPts = Math.min(25, Math.round((data.photoCount / 12) * 25));
  items.push({ label: `Fotos (${data.photoCount})`, points: photoPts, maxPoints: 25, ok: data.photoCount >= 6 });

  // Energy cert (10 pts)
  const energyPts = data.hasEnergyCert ? 10 : 0;
  items.push({ label: "Energieausweis", points: energyPts, maxPoints: 10, ok: energyPts > 0 });

  // Floor plan (5 pts)
  const floorPts = data.hasFloorPlan ? 5 : 0;
  items.push({ label: "Grundriss", points: floorPts, maxPoints: 5, ok: floorPts > 0 });

  // Price recommendation (5 pts)
  const recPts = data.hasPriceRecommendation ? 5 : 0;
  items.push({ label: "Preisempfehlung", points: recPts, maxPoints: 5, ok: recPts > 0 });

  // Attributes (10 pts)
  const attrPts = data.hasAttributes ? Math.min(10, data.attributeCount * 2) : 0;
  items.push({ label: "Ausstattung", points: attrPts, maxPoints: 10, ok: attrPts >= 6 });

  // Contact (5 pts)
  const contactPts = data.hasContact ? 5 : 0;
  items.push({ label: "Kontaktdaten", points: contactPts, maxPoints: 5, ok: contactPts > 0 });

  const score = items.reduce((sum, i) => sum + i.points, 0);
  return { score, items };
}
