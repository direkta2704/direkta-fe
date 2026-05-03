import sharp from "sharp";

/**
 * Detects if an image needs rotation by asking an AI model
 * where the sky/ceiling is positioned in the image.
 * Returns the clockwise rotation in degrees needed to orient correctly.
 */
export async function detectImageRotation(
  imageBuffer: Buffer,
): Promise<0 | 90 | 180 | 270> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return 0;
  try {
    const thumb = await sharp(imageBuffer)
      .resize(512, 512, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 50 })
      .toBuffer();
    const dataUrl = `data:image/jpeg;base64,${thumb.toString("base64")}`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://direkta.de",
        "X-Title": "Direkta Rotation Detector",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an image orientation detector for real estate photos.

Your job: determine if the photo is displayed in the correct upright orientation or if it has been rotated incorrectly.

RULES:
- In a correctly oriented photo: the sky, ceiling, or top of walls should be at the TOP edge. The ground, floor, or bottom of walls should be at the BOTTOM edge. Vertical structures (walls, doors, windows, trees) should appear vertical.
- Look at the PIXEL LAYOUT as it is rendered — do NOT mentally rotate the image.
- Focus on: horizon line, sky position, vertical structures (walls, door frames, trees), gravity cues (hanging objects, furniture placement).

Respond with ONLY this JSON (no markdown):
{"sky":"top"} if the image is already correctly oriented (sky/ceiling at top edge)
{"sky":"left"} if sky/ceiling is along the LEFT edge (image was rotated 90° counter-clockwise)
{"sky":"bottom"} if sky/ceiling is at the BOTTOM edge (image is upside-down)
{"sky":"right"} if sky/ceiling is along the RIGHT edge (image was rotated 90° clockwise)`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this real estate photo. Which edge of the image (top/left/bottom/right) is the sky or ceiling closest to? Remember: report the ACTUAL pixel position, do not auto-correct.",
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 20,
        temperature: 0,
      }),
    });
    if (!res.ok) return 0;
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) return 0;
    const parsed = JSON.parse(content);
    const sky = parsed.sky;
    if (sky === "left") return 90;
    if (sky === "bottom") return 180;
    if (sky === "right") return 270;
    return 0;
  } catch (e) {
    console.error("Rotation detection failed:", e);
    return 0;
  }
}

/**
 * Full rotation correction pipeline:
 * 1. Apply EXIF rotation (handles most smartphone photos)
 * 2. Run AI verification to catch wrong/missing EXIF
 * Returns the corrected buffer.
 */
export async function correctImageRotation(
  rawBuffer: Buffer,
): Promise<Buffer> {
  // Step 1: Apply EXIF rotation
  let buffer = await sharp(rawBuffer)
    .rotate()
    .jpeg({ quality: 90 })
    .toBuffer();

  // Step 2: AI verification — check if the EXIF-rotated result looks correct
  const rotation = await detectImageRotation(buffer);
  if (rotation !== 0) {
    buffer = await sharp(buffer)
      .rotate(rotation)
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
  }

  return buffer;
}
