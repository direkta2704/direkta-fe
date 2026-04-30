import { auth } from "./auth";
import { prisma } from "./prisma";

export async function getRequiredUser() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    throw new Error("Unauthorized");
  }
  return { id: session.user.id, email: session.user.email, name: session.user.name };
}

export async function getRequiredAdmin() {
  const user = await getRequiredUser();
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  if (dbUser?.role !== "ADMIN") {
    throw new Error("Admin role required");
  }
  return user;
}
