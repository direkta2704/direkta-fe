import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// F-M6-14: Reconfirm credentials (resets the 90-day timer)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;
    const body = await req.json();

    const credential = await prisma.portalCredential.findFirst({
      where: { id, userId: user.id },
    });

    if (!credential) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    if (!body.consent) {
      return NextResponse.json({ error: "Zustimmung ist erforderlich" }, { status: 400 });
    }

    const updated = await prisma.portalCredential.update({
      where: { id },
      data: {
        reconfirmedAt: new Date(),
        lastVerifiedAt: new Date(),
        status: "ACTIVE",
      },
    });

    // Reactivate paused syndication targets if credential was expired
    if (credential.status === "EXPIRED") {
      await prisma.syndicationTarget.updateMany({
        where: {
          portal: credential.portal,
          listing: { property: { userId: user.id } },
          status: "PAUSED",
        },
        data: { status: "LIVE" },
      });
    }

    return NextResponse.json({
      id: updated.id,
      portal: updated.portal,
      status: updated.status,
      reconfirmedAt: updated.reconfirmedAt,
    });
  } catch (err) {
    console.error("Reconfirm error:", err);
    return NextResponse.json({ error: "Bestätigung fehlgeschlagen" }, { status: 500 });
  }
}

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
