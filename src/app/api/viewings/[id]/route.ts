import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { generateICS } from "@/lib/ics";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;
    const body = await req.json();

    const viewing = await prisma.viewing.findFirst({
      where: { id, listing: { property: { userId: user.id } } },
    });

    if (!viewing) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    const updated = await prisma.viewing.update({
      where: { id },
      data: {
        status: body.status ?? undefined,
        notes: body.notes ?? undefined,
      },
    });

    if (body.status && viewing.leadId) {
      const newLeadStatus =
        body.status === "CONFIRMED" ? "VIEWING_SCHEDULED" :
        body.status === "CANCELLED" ? "QUALIFIED" : undefined;

      if (newLeadStatus) {
        await prisma.lead.update({
          where: { id: viewing.leadId },
          data: { status: newLeadStatus },
        });
      }
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Update viewing error:", err);
    return NextResponse.json({ error: "Aktualisierung fehlgeschlagen" }, { status: 500 });
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

    const viewing = await prisma.viewing.findFirst({
      where: { id, listing: { property: { userId: user.id } } },
    });

    if (!viewing) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    await prisma.viewing.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Löschen fehlgeschlagen" }, { status: 500 });
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;
    const url = new URL(req.url);
    const format = url.searchParams.get("format");

    const viewing = await prisma.viewing.findFirst({
      where: { id, listing: { property: { userId: user.id } } },
      include: {
        listing: { select: { property: { select: { street: true, houseNumber: true, city: true, postcode: true } } } },
        lead: { select: { name: true, emailRaw: true } },
      },
    });

    if (!viewing) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    if (format === "ics") {
      const p = viewing.listing.property;
      const ics = generateICS({
        title: `Besichtigung: ${p.street} ${p.houseNumber}`,
        description: `Immobilienbesichtigung${viewing.lead ? ` mit ${viewing.lead.name || viewing.lead.emailRaw}` : ""}`,
        location: `${p.street} ${p.houseNumber}, ${p.postcode} ${p.city}`,
        startsAt: viewing.startsAt,
        endsAt: viewing.endsAt,
      });

      return new Response(ics, {
        headers: {
          "Content-Type": "text/calendar; charset=utf-8",
          "Content-Disposition": `attachment; filename="besichtigung-${id}.ics"`,
        },
      });
    }

    return NextResponse.json(viewing);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}
