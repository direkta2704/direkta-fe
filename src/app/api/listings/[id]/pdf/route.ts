import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import puppeteer from "puppeteer";

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

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    });

    try {
      const page = await browser.newPage();
      await page.goto(exposeUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

      // Wait for all images to load (but not iframes/PDFs which can hang)
      await page.evaluate(async () => {
        const imgs = Array.from(document.querySelectorAll("img"));
        await Promise.all(imgs.map(img => {
          if (img.complete) return;
          return new Promise(resolve => {
            img.addEventListener("load", resolve);
            img.addEventListener("error", resolve);
          });
        }));
      });

      // Remove iframes (PDF embeds don't render in print anyway)
      await page.evaluate(() => {
        document.querySelectorAll("iframe").forEach(el => {
          const placeholder = document.createElement("div");
          placeholder.style.cssText = "width:100%;height:210mm;display:flex;align-items:center;justify-content:center;background:#f5f0e6;border:1px solid #d9d0be;";
          placeholder.innerHTML = '<span style="font-family:Helvetica,sans-serif;font-size:9pt;color:#8A92A0;">PDF-Grundriss — siehe Anlage</span>';
          el.replaceWith(placeholder);
        });
      });

      await page.emulateMediaType("print");

      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
      });

      const p = listing.property;
      const fn = `Expose_${p.street}_${p.houseNumber}_${p.city}.pdf`.replace(/\s+/g, "_");

      return new Response(Buffer.from(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${fn}"`,
        },
      });
    } finally {
      await browser.close();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("PDF error:", message, err);
    return new Response(`PDF-Erstellung fehlgeschlagen: ${message}`, { status: 500 });
  }
}
