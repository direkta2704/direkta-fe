import { auth } from "./auth";

export async function getRequiredUser() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    throw new Error("Unauthorized");
  }
  return { id: session.user.id, email: session.user.email, name: session.user.name };
}
