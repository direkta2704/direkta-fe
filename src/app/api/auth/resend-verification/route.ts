import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createVerificationToken } from "@/lib/auth-tokens";
import { sendVerificationEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.redirect(new URL("/dashboard?error=missing-email", req.url));
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.emailVerified) {
    const token = await createVerificationToken(email, "verify-email");
    await sendVerificationEmail(email, token).catch((e) => console.error("Resend failed:", e));
  }

  return NextResponse.redirect(new URL("/dashboard?verification-sent=true", req.url));
}
