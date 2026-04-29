import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { isS3Enabled, uploadToS3 } from "@/lib/s3";

export const dynamic = "force-dynamic";

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

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const kind = (formData.get("kind") as string) || "PHOTO";

    if (!file) {
      return NextResponse.json(
        { error: "Keine Datei hochgeladen" },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: "Datei zu groß (max. 25 MB)" },
        { status: 400 }
      );
    }

    if (kind === "PHOTO") {
      const photoCount = await prisma.mediaAsset.count({
        where: { propertyId: id, kind: "PHOTO" },
      });
      if (photoCount >= 30) {
        return NextResponse.json(
          { error: "Maximal 30 Fotos erlaubt" },
          { status: 400 }
        );
      }
    }

    const rawBuffer = Buffer.from(await file.arrayBuffer());
    const isImage = file.type.startsWith("image/");

    let finalBuffer: Buffer;
    let finalExt: string;
    let finalMime: string;
    let width: number | undefined;
    let height: number | undefined;

    if (isImage) {
      const image = sharp(rawBuffer);
      const meta = await image.metadata();
      const maxDim = kind === "FLOORPLAN" ? 2400 : 1920;
      const needsResize = (meta.width && meta.width > maxDim) || (meta.height && meta.height > maxDim);

      let pipeline = needsResize
        ? image.resize({ width: maxDim, height: maxDim, fit: "inside", withoutEnlargement: true })
        : image;

      if (meta.format === "png" && kind === "FLOORPLAN") {
        finalBuffer = await pipeline.png({ quality: 85, compressionLevel: 9 }).toBuffer();
        finalExt = "png";
        finalMime = "image/png";
      } else {
        finalBuffer = await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
        finalExt = "jpg";
        finalMime = "image/jpeg";
      }

      const outMeta = await sharp(finalBuffer).metadata();
      width = outMeta.width;
      height = outMeta.height;
    } else {
      finalBuffer = rawBuffer;
      finalExt = file.name.split(".").pop() || "pdf";
      finalMime = file.type;
    }

    const fileName = `${randomUUID()}.${finalExt}`;
    let storageKey: string;

    if (isS3Enabled()) {
      const s3Key = `properties/${id}/${fileName}`;
      storageKey = await uploadToS3(s3Key, finalBuffer, finalMime);
    } else {
      const uploadDir = path.join(process.cwd(), "public", "uploads", id);
      await mkdir(uploadDir, { recursive: true });
      await writeFile(path.join(uploadDir, fileName), finalBuffer);
      storageKey = `/uploads/${id}/${fileName}`;
    }

    const existing = kind === "PHOTO" ? await prisma.mediaAsset.count({ where: { propertyId: id, kind: "PHOTO" } }) : 0;

    const asset = await prisma.mediaAsset.create({
      data: {
        propertyId: id,
        kind: kind as "PHOTO" | "FLOORPLAN" | "DOCUMENT" | "ENERGY_PDF",
        storageKey,
        fileName: file.name,
        mimeType: finalMime,
        sizeBytes: finalBuffer.length,
        width: width || null,
        height: height || null,
        ordering: existing,
      },
    });

    return NextResponse.json(asset, { status: 201 });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "Upload fehlgeschlagen" },
      { status: 500 }
    );
  }
}
