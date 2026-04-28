import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await getRequiredUser();

    // 1. Withdraw all active listings
    await prisma.listing.updateMany({
      where: { property: { userId: user.id }, status: { in: ["ACTIVE", "PAUSED", "DRAFT", "REVIEW"] } },
      data: { status: "WITHDRAWN", closedAt: new Date() },
    });

    // 2. Pause all syndication
    const userListings = await prisma.listing.findMany({
      where: { property: { userId: user.id } },
      select: { id: true },
    });
    const listingIds = userListings.map((l) => l.id);

    if (listingIds.length > 0) {
      await prisma.syndicationTarget.updateMany({
        where: { listingId: { in: listingIds }, status: { in: ["LIVE", "QUEUED"] } },
        data: { status: "WITHDRAWN" },
      });
    }

    // 3. Revoke portal credentials
    await prisma.portalCredential.updateMany({
      where: { userId: user.id },
      data: { status: "REVOKED" },
    });

    // 4. Close active conversations
    await prisma.conversation.updateMany({
      where: { userId: user.id, status: "ACTIVE" },
      data: { status: "ABANDONED", closedAt: new Date() },
    });

    // 5. Mark user as deleted (14-day grace period)
    await prisma.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date() },
    });

    // 6. Delete sessions (force sign-out)
    await prisma.session.deleteMany({ where: { userId: user.id } });

    return NextResponse.json({
      ok: true,
      message: "Ihr Konto wurde zur Loeschung markiert. Die endgueltige Loeschung erfolgt nach 14 Tagen. Sie werden jetzt abgemeldet.",
      deletedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Delete account error:", err);
    return NextResponse.json({ error: "Kontolöschung fehlgeschlagen" }, { status: 500 });
  }
}
