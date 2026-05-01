import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { consumeToken } from "@/lib/auth-tokens";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/?error=missing-token", req.url));
  }

  const email = await consumeToken(token, "verify-email");
  if (!email) {
    return NextResponse.redirect(new URL("/?error=invalid-token", req.url));
  }

  await prisma.user.update({
    where: { email },
    data: { emailVerified: new Date() },
  });

  return NextResponse.redirect(new URL("/dashboard?verified=true", req.url));
}
