import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await getRequiredUser();
    const url = new URL(req.url);

    if (url.searchParams.get("countOnly") === "new") {
      const count = await prisma.lead.count({
        where: { listing: { property: { userId: user.id } }, status: "NEW" },
      });
      return NextResponse.json({ count });
    }

    const leads = await prisma.lead.findMany({
      where: { listing: { property: { userId: user.id } } },
      include: {
        listing: {
          select: {
            id: true,
            slug: true,
            property: {
              select: { street: true, houseNumber: true, city: true },
            },
          },
        },
      },
      orderBy: [{ qualityScore: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(leads);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}
