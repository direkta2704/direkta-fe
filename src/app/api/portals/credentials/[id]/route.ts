import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;
    void req;

    const credential = await prisma.portalCredential.findFirst({
      where: { id, userId: user.id },
    });

    if (!credential) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    // Revoke and pause all related syndication
    await prisma.portalCredential.update({
      where: { id },
      data: { status: "REVOKED" },
    });

    await prisma.syndicationTarget.updateMany({
      where: {
        portal: credential.portal,
        listing: { property: { userId: user.id } },
        status: { in: ["LIVE", "QUEUED"] },
      },
      data: { status: "PAUSED" },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Löschen fehlgeschlagen" }, { status: 500 });
  }
}
