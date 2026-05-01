import { randomBytes } from "crypto";
import { prisma } from "./prisma";

export async function createVerificationToken(email: string, purpose: "verify-email" | "reset-password" | "magic-link"): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

  await prisma.verificationToken.create({
    data: {
      identifier: `${purpose}:${email}`,
      token,
      expires,
    },
  });

  return token;
}

export async function consumeToken(token: string, purpose: string): Promise<string | null> {
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record) return null;
  if (!record.identifier.startsWith(`${purpose}:`)) return null;
  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { token } });
    return null;
  }

  const email = record.identifier.slice(purpose.length + 1);
  await prisma.verificationToken.delete({ where: { token } });
  return email;
}
