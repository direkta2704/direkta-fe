import { prisma } from "@/lib/prisma";
import { sendWeeklyReport } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      properties: {
        where: { parentId: null },
        select: {
          id: true,
          street: true,
          houseNumber: true,
          city: true,
          listings: {
            where: { status: { in: ["ACTIVE", "DRAFT"] } },
            select: {
              id: true,
              status: true,
              titleShort: true,
              askingPrice: true,
              publishedAt: true,
              _count: { select: { leads: true, offers: true } },
            },
            take: 1,
          },
          media: { where: { kind: "PHOTO" }, select: { id: true } },
        },
      },
    },
  });

  let sent = 0;
  for (const user of users) {
    const listings = user.properties
      .filter(p => p.listings.length > 0)
      .map(p => {
        const l = p.listings[0];
        const daysOnline = l.publishedAt
          ? Math.floor((Date.now() - new Date(l.publishedAt).getTime()) / 86400000)
          : 0;
        return {
          title: l.titleShort || `${p.street} ${p.houseNumber}`,
          address: `${p.street} ${p.houseNumber}, ${p.city}`,
          status: l.status,
          price: l.askingPrice ? Number(l.askingPrice) : null,
          leads: l._count.leads,
          offers: l._count.offers,
          photos: p.media.length,
          daysOnline,
        };
      });

    if (listings.length === 0) continue;

    const totalLeads = listings.reduce((s, l) => s + l.leads, 0);
    const totalOffers = listings.reduce((s, l) => s + l.offers, 0);

    try {
      await sendWeeklyReport({
        to: user.email,
        name: user.name || "Verkäufer",
        listings,
        totalLeads,
        totalOffers,
      });
      sent++;
    } catch (e) {
      console.error(`Weekly report failed for ${user.email}:`, e);
    }
  }

  return Response.json({ ok: true, sent });
}
