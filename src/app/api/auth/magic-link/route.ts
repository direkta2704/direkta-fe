import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { consumeToken } from "@/lib/auth-tokens";
import { sign } from "jsonwebtoken";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/?error=missing-token", req.url));
  }

  const email = await consumeToken(token, "magic-link");
  if (!email) {
    return NextResponse.redirect(new URL("/?error=invalid-token", req.url));
  }

  // Mark email as verified (they clicked the link from their inbox)
  const user = await prisma.user.update({
    where: { email },
    data: { emailVerified: new Date() },
  });

  // Create a session by setting a cookie that NextAuth can read
  // Redirect to a callback that signs them in
  const callbackUrl = `/api/auth/callback/credentials?email=${encodeURIComponent(email)}&magic=true`;
  return NextResponse.redirect(new URL(`/dashboard?magic=true&email=${encodeURIComponent(email)}`, req.url));
}
