/* eslint-disable no-console */
// Promotes an existing User to role=ADMIN so they can access the admin pages
// (/dashboard/admin/agent-stats, /dashboard/admin/agent-audit).
//
// Usage:
//   npm run grant-admin -- --email=foo@example.com
//   npm run grant-admin -- --email=foo@example.com --revoke   # back to SELLER

import { prisma } from "../src/lib/prisma";

function parseArg(name: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split("=")[1] : undefined;
}

async function main() {
  const email = parseArg("email");
  const revoke = process.argv.includes("--revoke");
  if (!email) {
    console.error("Usage: npm run grant-admin -- --email=user@example.com [--revoke]");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, role: true, name: true } });
  if (!user) {
    console.error(`User mit E-Mail "${email}" nicht gefunden.`);
    process.exit(1);
  }

  const newRole = revoke ? "SELLER" : "ADMIN";
  if (user.role === newRole) {
    console.log(`User ${user.email} hat bereits Rolle ${newRole} — nichts zu tun.`);
    process.exit(0);
  }

  await prisma.user.update({ where: { id: user.id }, data: { role: newRole } });
  console.log(`✓ ${user.email} (${user.name || "ohne Name"}): Rolle ${user.role} → ${newRole}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
