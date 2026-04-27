import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { unlink } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;

    const asset = await prisma.mediaAsset.findFirst({
      where: { id },
      include: { property: { select: { userId: true } } },
    });

    if (!asset || asset.property?.userId !== user.id) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    try {
      const filePath = path.join(process.cwd(), "public", asset.storageKey);
      await unlink(filePath);
    } catch {
      // file may not exist on disk
    }

    await prisma.mediaAsset.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete media error:", err);
    return NextResponse.json({ error: "Löschen fehlgeschlagen" }, { status: 500 });
  }
}
