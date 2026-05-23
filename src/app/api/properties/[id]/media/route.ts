import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { isS3Enabled, uploadToS3, createPresignedUploadUrl, getS3Buffer, deleteFromS3 } from "@/lib/s3";
import { detectImageRotation } from "@/lib/image-rotation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;

    const property = await prisma.property.findFirst({
      where: { id, userId: user.id },
    });
    if (!property) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    const media = await prisma.mediaAsset.findMany({
      where: { propertyId: id },
      orderBy: { ordering: "asc" },
    });

    return NextResponse.json(media);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}

async function processAndStore(
  rawBuffer: Buffer,
  propertyId: string,
  fileType: string,
  fileName: string,
  kind: string,
): Promise<{ storageKey: string; finalMime: string; width?: number; height?: number; sizeBytes: number }> {
  const isImage = fileType.startsWith("image/");

  let finalBuffer: Buffer;
  let finalExt: string;
  let finalMime: string;
  let width: number | undefined;
  let height: number | undefined;

  if (isImage) {
    const image = sharp(rawBuffer).rotate().withIccProfile("srgb");
    const meta = await image.metadata();
    const maxDim = kind === "FLOORPLAN" ? 2400 : 1920;
    const needsResize = (meta.width && meta.width > maxDim) || (meta.height && meta.height > maxDim);

    const pipeline = needsResize
      ? image.resize({ width: maxDim, height: maxDim, fit: "inside", withoutEnlargement: true })
      : image;

    if (meta.format === "png" && kind === "FLOORPLAN") {
      finalBuffer = await pipeline.png({ quality: 85, compressionLevel: 9 }).toBuffer();
      finalExt = "png";
      finalMime = "image/png";
    } else {
      finalBuffer = await pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
      finalExt = "jpg";
      finalMime = "image/jpeg";
    }

    if (kind === "PHOTO") {
      const rotation = await detectImageRotation(finalBuffer);
      if (rotation !== 0) {
        finalBuffer = await sharp(finalBuffer).rotate(rotation).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
      }
    }

    const outMeta = await sharp(finalBuffer).metadata();
    width = outMeta.width;
    height = outMeta.height;
  } else {
    finalBuffer = rawBuffer;
    finalExt = fileName.split(".").pop() || "pdf";
    finalMime = fileType;
  }

  const outName = `${randomUUID()}.${finalExt}`;
  let storageKey: string;

  if (isS3Enabled()) {
    const s3Key = `properties/${propertyId}/${outName}`;
    storageKey = await uploadToS3(s3Key, finalBuffer, finalMime);
  } else {
    const uploadDir = path.join(process.cwd(), "public", "uploads", propertyId);
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, outName), finalBuffer);
    storageKey = `/uploads/${propertyId}/${outName}`;
  }

  return { storageKey, finalMime, width, height, sizeBytes: finalBuffer.length };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;

    const property = await prisma.property.findFirst({
      where: { id, userId: user.id },
    });
    if (!property) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    const contentType = req.headers.get("content-type") || "";

    // ── Presigned URL flow: client asks for a direct-to-S3 upload URL ──
    if (contentType.includes("application/json")) {
      const body = await req.json();

      // Step 1: Request a presigned upload URL
      if (body.presign) {
        if (!isS3Enabled()) {
          return NextResponse.json({ error: "S3 nicht konfiguriert" }, { status: 400 });
        }
        const kind = body.kind || "PHOTO";
        const ext = (body.fileName || "file").split(".").pop() || "jpg";
        const tempKey = `tmp/${id}/${randomUUID()}.${ext}`;
        const url = await createPresignedUploadUrl(tempKey, body.contentType || "image/jpeg");
        return NextResponse.json({ uploadUrl: url, s3Key: tempKey });
      }

      // Step 2: Confirm upload — process the S3 object and create MediaAsset
      if (body.s3Key) {
        if (!isS3Enabled()) {
          return NextResponse.json({ error: "S3 nicht konfiguriert" }, { status: 400 });
        }
        const kind = body.kind || "PHOTO";

        if (kind === "PHOTO") {
          const photoCount = await prisma.mediaAsset.count({ where: { propertyId: id, kind: "PHOTO" } });
          if (photoCount >= 30) {
            return NextResponse.json({ error: "Maximal 30 Fotos erlaubt" }, { status: 400 });
          }
        }

        const rawBuffer = await getS3Buffer(body.s3Key);
        const fileType = body.contentType || "image/jpeg";
        const fileName = body.fileName || "upload.jpg";

        const result = await processAndStore(rawBuffer, id, fileType, fileName, kind);

        // Clean up temp object
        try { await deleteFromS3(body.s3Key); } catch {}

        const existing = kind === "PHOTO" ? await prisma.mediaAsset.count({ where: { propertyId: id, kind: "PHOTO" } }) : 0;
        const asset = await prisma.mediaAsset.create({
          data: {
            propertyId: id,
            kind: kind as "PHOTO" | "FLOORPLAN" | "DOCUMENT" | "ENERGY_PDF",
            storageKey: result.storageKey,
            fileName,
            mimeType: result.finalMime,
            sizeBytes: result.sizeBytes,
            width: result.width || null,
            height: result.height || null,
            ordering: existing,
          },
        });

        return NextResponse.json(asset, { status: 201 });
      }

      return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
    }

    // ── Legacy FormData flow: file uploaded through the serverless function ──
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const kind = (formData.get("kind") as string) || "PHOTO";

    if (!file) {
      return NextResponse.json({ error: "Keine Datei hochgeladen" }, { status: 400 });
    }

    const pdfKinds = ["FLOORPLAN", "ENERGY_PDF", "DOCUMENT"];
    const allowedTypes = pdfKinds.includes(kind)
      ? ["image/jpeg", "image/png", "image/webp", "application/pdf"]
      : ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: pdfKinds.includes(kind) ? "Erlaubt: JPG, PNG, PDF" : "Nur Bilddateien erlaubt" },
        { status: 400 }
      );
    }

    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "Datei zu groß (max. 25 MB)" }, { status: 400 });
    }

    if (kind === "PHOTO") {
      const photoCount = await prisma.mediaAsset.count({ where: { propertyId: id, kind: "PHOTO" } });
      if (photoCount >= 30) {
        return NextResponse.json({ error: "Maximal 30 Fotos erlaubt" }, { status: 400 });
      }
    }

    const rawBuffer = Buffer.from(await file.arrayBuffer());
    const result = await processAndStore(rawBuffer, id, file.type, file.name, kind);

    const existing = kind === "PHOTO" ? await prisma.mediaAsset.count({ where: { propertyId: id, kind: "PHOTO" } }) : 0;
    const asset = await prisma.mediaAsset.create({
      data: {
        propertyId: id,
        kind: kind as "PHOTO" | "FLOORPLAN" | "DOCUMENT" | "ENERGY_PDF",
        storageKey: result.storageKey,
        fileName: file.name,
        mimeType: result.finalMime,
        sizeBytes: result.sizeBytes,
        width: result.width || null,
        height: result.height || null,
        ordering: existing,
      },
    });

    return NextResponse.json(asset, { status: 201 });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload fehlgeschlagen" }, { status: 500 });
  }
}
