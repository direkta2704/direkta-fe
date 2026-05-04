import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { readFile } from "fs/promises";
import path from "path";
import type { Prisma } from "@prisma/client";
import sharp from "sharp";
import { getFromS3 } from "@/lib/s3";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ROOM_TYPES = [
  "exterior", "floorplan", "living", "kitchen", "bathroom", "bedroom",
  "office", "hallway", "balcony", "garden", "garage", "basement", "other",
];

async function loadImageBytes(storageKey: string): Promise<Buffer | null> {
  try {
    if (storageKey.startsWith("/uploads/")) {
      const local = path.join(process.cwd(), "public", storageKey.replace(/^\/+/, ""));
      return await readFile(local);
    }
    const key = storageKey.replace(/^https?:\/\/[^/]+\//, "").replace(/^\/+/, "");
    const obj = await getFromS3(key);
    if (!obj) return null;
    const reader = obj.body.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const merged = Buffer.alloc(total);
    let off = 0;
    for (const c of chunks) { merged.set(c, off); off += c.length; }
    return merged;
  } catch {
    return null;
  }
}

interface Classification {
  roomType: string;
  qualityFlags: string[];
  qualityScore: number;
  features: string[];
  caption: string;
  description: string;
  lighting: string | null;
  estimatedArea: number | null;
  suggestion: string | null;
}

async function analyzePhoto(imageBuffer: Buffer): Promise<Classification | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const thumb = await sharp(imageBuffer)
    .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 70 })
    .toBuffer();
  const dataUrl = `data:image/jpeg;base64,${thumb.toString("base64")}`;

  const sysPrompt = `Du bist ein Experte für Immobilienfotografie und analysierst Fotos für deutsche Immobilienexposés. Antworte als JSON, ohne Markdown:
{
  "roomType": einer aus [${ROOM_TYPES.join(", ")}],
  "qualityFlags": Array aus möglichen Mängeln (nur zutreffende): blur, dark, overexposed, saturated, oversharp, tilted, cluttered, watermark, low_resolution, noisy, reflection, finger, poor_composition,
  "qualityScore": 0-100,
  "features": Array erkannter Merkmale z.B. ["einbaukueche", "parkettboden", "balkon", "dachschraege"],
  "caption": präziser Raumname für das Exposé, z.B. "Wohn-/Essbereich mit Küchenanschlüssen", "Schlafzimmer mit Blick zur Ankleide", "Bad mit bodengleicher Dusche", "Fassade Straßenseite",
  "description": 2-3 Sätze für ein hochwertiges Immobilienexposé. Beschreibe sachlich was im Foto sichtbar ist: Materialien, Oberflächen, Raumgefühl, Lichtverhältnisse, besondere Merkmale. Stil: professionell, wertschätzend, konkret.,
  "lighting": Lichtverhältnisse, z.B. "Weiches Vormittagslicht", "Neutrales Tageslicht", "Späte Nachmittagssonne",
  "estimatedArea": geschätzte Raumfläche in m² (Türgröße ~2m als Referenz). Nur bei Innenräumen, null bei Außenaufnahmen.,
  "suggestion": kurzer Verbesserungshinweis (nur wenn qualityScore < 70, sonst null)
}
Regeln:
- "floorplan" NUR wenn das Bild ein technischer Grundriss ist.
- "exterior" für Außenansichten des Gebäudes.
- "caption" soll spezifisch sein — nicht generisch wie "Zimmer", sondern beschreibend.
- "description" soll NUR beschreiben was sichtbar ist. Keine Vermutungen.`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://direkta.de",
        "X-Title": "Direkta Photo Analyser",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        messages: [
          { role: "system", content: sysPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Analysiere dieses Immobilienfoto für ein professionelles Exposé." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 500,
        temperature: 0,
      }),
    });

    if (!res.ok) return null;
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    return {
      roomType: ROOM_TYPES.includes(parsed.roomType) ? parsed.roomType : "other",
      qualityFlags: Array.isArray(parsed.qualityFlags) ? parsed.qualityFlags : [],
      qualityScore: typeof parsed.qualityScore === "number" ? parsed.qualityScore : 50,
      features: Array.isArray(parsed.features) ? parsed.features : [],
      caption: typeof parsed.caption === "string" ? parsed.caption : "",
      description: typeof parsed.description === "string" ? parsed.description : "",
      lighting: typeof parsed.lighting === "string" ? parsed.lighting : null,
      estimatedArea: typeof parsed.estimatedArea === "number" ? parsed.estimatedArea : null,
      suggestion: typeof parsed.suggestion === "string" ? parsed.suggestion : null,
    };
  } catch {
    return null;
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;
    void req;

    const property = await prisma.property.findFirst({
      where: { id, userId: user.id },
      include: { media: { where: { kind: "PHOTO" }, orderBy: { ordering: "asc" } } },
    });
    if (!property) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    const results: { id: string; caption: string; description: string; roomType: string }[] = [];

    for (const media of property.media) {
      const buf = await loadImageBytes(media.storageKey);
      if (!buf) continue;

      const classification = await analyzePhoto(buf);
      if (!classification) continue;

      await prisma.mediaAsset.update({
        where: { id: media.id },
        data: { classification: JSON.parse(JSON.stringify(classification)) as Prisma.InputJsonValue },
      });

      results.push({
        id: media.id,
        caption: classification.caption,
        description: classification.description,
        roomType: classification.roomType,
      });
    }

    return NextResponse.json({ ok: true, analyzed: results.length, results });
  } catch (err) {
    console.error("Analyze photos error:", err);
    return NextResponse.json({ error: "Analyse fehlgeschlagen" }, { status: 500 });
  }
}
