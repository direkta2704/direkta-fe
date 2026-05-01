import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { consumeToken } from "@/lib/auth-tokens";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/?error=missing-token", req.url));

  // Redirect to a reset form page with the token
  return NextResponse.redirect(new URL(`/reset-password?token=${token}`, req.url));
}

export async function POST(req: Request) {
  const { token, password } = await req.json();

  if (!token || !password) {
    return NextResponse.json({ error: "Token und Passwort erforderlich" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Passwort muss mindestens 8 Zeichen haben" }, { status: 400 });
  }

  const email = await consumeToken(token, "reset-password");
  if (!email) {
    return NextResponse.json({ error: "Ungültiger oder abgelaufener Link" }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { email },
    data: { passwordHash: hash },
  });

  return NextResponse.json({ ok: true, message: "Passwort wurde zurückgesetzt" });
}
