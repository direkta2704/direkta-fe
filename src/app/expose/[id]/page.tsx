import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ExposeViewer from "./expose-viewer";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const listing = await prisma.listing.findFirst({
    where: { id }, include: { property: true },
  });
  return { title: listing ? `Exposé — ${listing.property.street} ${listing.property.houseNumber}` : "Exposé" };
}

export default async function ExposePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const listing = await prisma.listing.findFirst({
    where: { id },
    include: { property: { select: { street: true, houseNumber: true, city: true } } },
  });
  if (!listing) notFound();

  return <ExposeViewer listingId={id} title={`${listing.property.street} ${listing.property.houseNumber} · ${listing.property.city}`} />;
}
