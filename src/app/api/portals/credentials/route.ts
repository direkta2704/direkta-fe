import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { encrypt } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getRequiredUser();

    const credentials = await prisma.portalCredential.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        portal: true,
        username: true,
        status: true,
        consentedAt: true,
        reconfirmedAt: true,
        lastVerifiedAt: true,
      },
    });

    return NextResponse.json(credentials);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getRequiredUser();
    const body = await req.json();

    const { portal, username, password, consent } = body;

    if (!portal || !username || !password) {
      return NextResponse.json({ error: "Portal, Benutzername und Passwort sind erforderlich" }, { status: 400 });
    }

    if (!consent) {
      return NextResponse.json({ error: "Zustimmung ist erforderlich" }, { status: 400 });
    }

    const passwordCipher = new Uint8Array(encrypt(password));

    // Upsert: replace existing credential for this portal
    const existing = await prisma.portalCredential.findFirst({
      where: { userId: user.id, portal },
    });

    let credential;
    if (existing) {
      credential = await prisma.portalCredential.update({
        where: { id: existing.id },
        data: {
          username,
          passwordCipher,
          status: "ACTIVE",
          consentedAt: new Date(),
          reconfirmedAt: new Date(),
          lastVerifiedAt: new Date(),
        },
      });
    } else {
      credential = await prisma.portalCredential.create({
        data: {
          userId: user.id,
          portal,
          username,
          passwordCipher,
          consentedAt: new Date(),
          lastVerifiedAt: new Date(),
          status: "ACTIVE",
        },
      });
    }

    return NextResponse.json({
      id: credential.id,
      portal: credential.portal,
      username: credential.username,
      status: credential.status,
    }, { status: 201 });
  } catch (err) {
    console.error("Credential error:", err);
    return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 500 });
  }
}
