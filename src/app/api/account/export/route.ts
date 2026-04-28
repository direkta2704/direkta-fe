import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getRequiredUser();

    const [profile, properties, listings, leads, offers, viewings, conversations, credentials] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true, name: true, email: true, phone: true, role: true,
          emailVerified: true, createdAt: true,
        },
      }),
      prisma.property.findMany({
        where: { userId: user.id },
        include: {
          energyCert: true,
          media: { select: { id: true, kind: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true } },
        },
      }),
      prisma.listing.findMany({
        where: { property: { userId: user.id } },
        include: {
          events: { orderBy: { createdAt: "desc" } },
          priceRecommendation: { include: { comparables: true } },
        },
      }),
      prisma.lead.findMany({
        where: { listing: { property: { userId: user.id } } },
        select: {
          id: true, name: true, emailRaw: true, phone: true, message: true,
          budget: true, financingState: true, timing: true, qualityScore: true,
          status: true, source: true, createdAt: true,
        },
      }),
      prisma.offer.findMany({
        where: { listing: { property: { userId: user.id } } },
        include: { buyer: { select: { name: true, email: true } } },
      }),
      prisma.viewing.findMany({
        where: { listing: { property: { userId: user.id } } },
        select: {
          id: true, startsAt: true, endsAt: true, mode: true, status: true,
          notes: true, createdAt: true,
        },
      }),
      prisma.conversation.findMany({
        where: { userId: user.id },
        include: {
          turns: {
            select: { id: true, role: true, content: true, createdAt: true },
            orderBy: { createdAt: "asc" },
          },
        },
      }),
      prisma.portalCredential.findMany({
        where: { userId: user.id },
        select: {
          id: true, portal: true, username: true, status: true,
          consentedAt: true, lastVerifiedAt: true,
        },
      }),
    ]);

    const exportData = {
      exportDate: new Date().toISOString(),
      exportVersion: "1.0",
      notice: "Datenexport gemaess DSGVO Art. 20 (Recht auf Datenuebertragbarkeit)",
      profile,
      properties,
      listings,
      leads,
      offers,
      viewings,
      conversations,
      portalCredentials: credentials,
    };

    const json = JSON.stringify(exportData, null, 2);
    const fileName = `Direkta_Datenexport_${new Date().toISOString().split("T")[0]}.json`;

    return new Response(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    console.error("Export error:", err);
    return NextResponse.json({ error: "Export fehlgeschlagen" }, { status: 500 });
  }
}
