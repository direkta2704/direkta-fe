import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createVerificationToken } from "@/lib/auth-tokens";
import { sendPasswordResetEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "E-Mail erforderlich" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });

  // Always return success to prevent email enumeration
  if (user) {
    const token = await createVerificationToken(email, "reset-password");
    await sendPasswordResetEmail(email, token).catch((e) => console.error("Reset email failed:", e));
  }

  return NextResponse.json({ ok: true, message: "Falls ein Konto existiert, wurde ein Link gesendet." });
}
