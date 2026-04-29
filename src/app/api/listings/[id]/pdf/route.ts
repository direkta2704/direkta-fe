import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { generateExposePdf } from "@/lib/pdf-generate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;

    const listing = await prisma.listing.findFirst({
      where: { id, property: { userId: user.id } },
      include: { property: { select: { street: true, houseNumber: true, city: true } } },
    });
    if (!listing) return new Response("Not found", { status: 404 });

    const url = new URL(req.url);
    const exposeUrl = `${url.protocol}//${url.host}/expose/${id}`;

    const pdf = await generateExposePdf(exposeUrl);

    const p = listing.property;
    const fn = `Expose_${p.street}_${p.houseNumber}_${p.city}.pdf`.replace(/\s+/g, "_");

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fn}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("PDF error:", message, err);
    return new Response(`PDF-Erstellung fehlgeschlagen: ${message}`, { status: 500 });
  }
}
