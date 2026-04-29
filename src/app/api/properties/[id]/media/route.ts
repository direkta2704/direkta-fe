import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

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
      const existing = await prisma.mediaAsset.count({
        where: { propertyId: id, kind: "PHOTO" },
      });
      if (existing >= 30) {
        return NextResponse.json(
          { error: "Maximal 30 Fotos erlaubt" },
          { status: 400 }
        );
      }
    }

    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${randomUUID()}.${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", id);
    await mkdir(uploadDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadDir, fileName), buffer);

    const storageKey = `/uploads/${id}/${fileName}`;

    const existing = kind === "PHOTO" ? await prisma.mediaAsset.count({ where: { propertyId: id, kind: "PHOTO" } }) : 0;

    const asset = await prisma.mediaAsset.create({
      data: {
        propertyId: id,
        kind: kind as "PHOTO" | "FLOORPLAN" | "DOCUMENT" | "ENERGY_PDF",
        storageKey,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
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
