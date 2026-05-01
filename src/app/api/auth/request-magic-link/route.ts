import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createVerificationToken } from "@/lib/auth-tokens";
import { sendMagicLinkEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "E-Mail erforderlich" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const token = await createVerificationToken(email, "magic-link");
    await sendMagicLinkEmail(email, token).catch((e) => console.error("Magic link email failed:", e));
  }

  return NextResponse.json({ ok: true, message: "Falls ein Konto existiert, wurde ein Anmeldelink gesendet." });
}
