import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import puppeteer from "puppeteer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
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

    const url = new URL(req.url);
    const format = url.searchParams.get("format");
    const dateStr = new Date().toISOString().split("T")[0];

    if (format === "pdf") {
      const htmlSections = Object.entries(exportData)
        .filter(([k]) => k !== "exportDate" && k !== "exportVersion" && k !== "notice")
        .map(([key, value]) => `
          <h2 style="font-size:14px;font-weight:700;color:#0F1B2E;margin:20px 0 8px;border-bottom:1px solid #e7dfcd;padding-bottom:4px;">${key}</h2>
          <pre style="font-size:9px;color:#485468;white-space:pre-wrap;word-break:break-all;background:#f7f3ea;padding:8px;border-radius:4px;">${JSON.stringify(value, null, 2)}</pre>
        `).join("");

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        body { font-family: Helvetica, Arial, sans-serif; padding: 40px; color: #0F1B2E; font-size: 12px; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        .meta { color: #8A92A0; font-size: 11px; margin-bottom: 20px; }
      </style></head><body>
        <h1>Direkta — Datenexport (DSGVO Art. 20)</h1>
        <p class="meta">Export vom ${dateStr} · ${exportData.profile?.email || ""}</p>
        <p style="font-size:11px;color:#485468;margin-bottom:16px;">${exportData.notice}</p>
        ${htmlSections}
        <p style="margin-top:30px;font-size:9px;color:#8A92A0;">Direkta GmbH · www.direkta.de · Generiert am ${dateStr}</p>
      </body></html>`;

      const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
      try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "domcontentloaded" });
        const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "15mm", right: "15mm", bottom: "15mm", left: "15mm" } });
        return new Response(new Uint8Array(pdf), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="Direkta_Datenexport_${dateStr}.pdf"`,
          },
        });
      } finally {
        await browser.close();
      }
    }

    const json = JSON.stringify(exportData, null, 2);
    return new Response(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="Direkta_Datenexport_${dateStr}.json"`,
      },
    });
  } catch (err) {
    console.error("Export error:", err);
    return NextResponse.json({ error: "Export fehlgeschlagen" }, { status: 500 });
  }
}
