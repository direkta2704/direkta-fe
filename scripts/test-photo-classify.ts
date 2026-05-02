import { config } from "dotenv";
config({ path: ".env.local" });
import { INITIAL_MEMORY, executeTool } from "../src/lib/expose-agent.js";
import path from "path";
import fs from "fs";
import sharp from "sharp";

const photoDir = "public/uploads/cmojjb6jj0027j0iw38kjgdtl";
const jpgs = fs.readdirSync(photoDir).filter((f) => f.toLowerCase().endsWith(".jpg")).slice(5, 10);

async function main() {
  const uploads = [];
  for (const jpg of jpgs) {
    const filePath = path.join(photoDir, jpg);
    const storageKey = "/uploads/cmojjb6jj0027j0iw38kjgdtl/" + jpg;
    const buf = fs.readFileSync(filePath);
    const meta = await sharp(buf).metadata();
    uploads.push({
      storageKey,
      fileName: jpg,
      mimeType: "image/jpeg",
      sizeBytes: buf.length,
      width: meta.width || null,
      height: meta.height || null,
      kind: "PHOTO" as const,
    });
  }

  const wm = { ...INITIAL_MEMORY, uploads };

  console.log("Running photo_analyse on " + uploads.length + " photos...\n");

  for (let i = 0; i < uploads.length; i++) {
    console.log("Photo " + (i + 1) + ": " + jpgs[i]);
    const tr = await executeTool("photo_analyse", { photoIndex: i }, wm);
    if (tr.ok && tr.memoryPatch?.__uploadClassifications) {
      const cls = (tr.memoryPatch.__uploadClassifications as Record<number, { roomType: string; qualityScore: number; qualityFlags: string[] }>)[i];
      console.log("  roomType: " + cls.roomType);
      console.log("  qualityScore: " + cls.qualityScore);
      console.log("  qualityFlags: " + JSON.stringify(cls.qualityFlags));
    } else {
      console.log("  FAILED: " + JSON.stringify(tr.output).slice(0, 200));
    }
    console.log("  cost: " + tr.costCents + "c");
    console.log("");
  }
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
