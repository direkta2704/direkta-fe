import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { generateReservationPdf } from "@/lib/reservation-pdf";
import { isS3Enabled, uploadToS3 } from "@/lib/s3";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;
    void req;

    const tx = await prisma.transaction.findUnique({ where: { id } });
    if (!tx) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const listing = await prisma.listing.findFirst({
      where: { id: tx.listingId, property: { userId: user.id } },
      include: {
        property: {
          include: { user: { select: { name: true, email: true } } },
        },
      },
    });

    if (!listing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const offer = await prisma.offer.findUnique({
      where: { id: tx.acceptedOfferId },
      include: { buyer: true },
    });

    if (!offer) return NextResponse.json({ error: "Angebot nicht gefunden" }, { status: 404 });

    const p = listing.property;
    const seller = p.user;
    const buyer = offer.buyer;

    const pdf = await generateReservationPdf({
      transactionId: tx.id,
      date: new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }),
      sellerName: seller.name || seller.email,
      sellerEmail: seller.email,
      buyerName: buyer.name,
      buyerEmail: buyer.email,
      buyerPhone: buyer.phone || undefined,
      propertyAddress: `${p.street} ${p.houseNumber}, ${p.postcode} ${p.city}`,
      propertyType: p.type,
      propertyArea: p.livingArea,
      propertyRooms: p.rooms || undefined,
      purchasePrice: Number(tx.finalPrice).toLocaleString("de-DE"),
      purchasePriceNum: Number(tx.finalPrice),
      conditions: offer.conditions || undefined,
      desiredClosingDate: offer.desiredClosingAt
        ? offer.desiredClosingAt.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
        : undefined,
    });

    // Store PDF if not yet stored
    if (!tx.reservationPdfAssetId) {
      const fileName = `Reservierung_${p.street}_${p.houseNumber}_${tx.id.slice(0, 8)}.pdf`.replace(/\s+/g, "_");
      let storageKey: string;

      if (isS3Enabled()) {
        storageKey = await uploadToS3(`transactions/${tx.id}/${fileName}`, pdf, "application/pdf");
      } else {
        const dir = path.join(process.cwd(), "public", "uploads", "transactions", tx.id);
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, fileName), pdf);
        storageKey = `/uploads/transactions/${tx.id}/${fileName}`;
      }

      const asset = await prisma.mediaAsset.create({
        data: {
          kind: "DOCUMENT",
          storageKey,
          fileName,
          mimeType: "application/pdf",
          sizeBytes: pdf.length,
        },
      });

      await prisma.transaction.update({
        where: { id: tx.id },
        data: { reservationPdfAssetId: asset.id },
      });
    }

    const fn = `Reservierung_${p.street}_${p.houseNumber}.pdf`.replace(/\s+/g, "_");

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fn}"`,
      },
    });
  } catch (err) {
    console.error("Reservation PDF error:", err);
    return NextResponse.json({ error: "PDF-Erstellung fehlgeschlagen" }, { status: 500 });
  }
}
