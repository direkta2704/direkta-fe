import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendCredentialExpiryEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const RECONFIRM_DAYS = 90;
const WARN_DAYS = 80; // warn 10 days before enforcement

// Cron: enforce 90-day credential re-consent (F-M6-14)
// Checks all ACTIVE portal credentials and:
// 1. Warns sellers 10 days before expiry
// 2. Pauses syndication and marks credential EXPIRED after 90 days
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let warned = 0;
  let expired = 0;
  let paused = 0;

  try {
    const credentials = await prisma.portalCredential.findMany({
      where: { status: "ACTIVE" },
      include: { user: { select: { email: true, name: true } } },
    });

    const now = Date.now();

    for (const cred of credentials) {
      const lastConfirmed = cred.reconfirmedAt || cred.consentedAt;
      const daysSince = (now - lastConfirmed.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSince >= RECONFIRM_DAYS) {
        // Expire the credential
        await prisma.portalCredential.update({
          where: { id: cred.id },
          data: { status: "EXPIRED" },
        });

        // Pause all LIVE syndication targets for this user + portal
        const targets = await prisma.syndicationTarget.findMany({
          where: {
            status: "LIVE",
            portal: cred.portal,
            listing: { property: { userId: cred.userId } },
          },
        });

        for (const target of targets) {
          await prisma.syndicationTarget.update({
            where: { id: target.id },
            data: { status: "PAUSED" },
          });

          await prisma.syndicationJob.create({
            data: {
              syndicationTargetId: target.id,
              kind: "PAUSE",
              status: "QUEUED",
            },
          });

          paused++;
        }

        if (cred.user.email) {
          try {
            await sendCredentialExpiryEmail(cred.user.email, {
              portal: cred.portal,
              action: "expired",
            });
          } catch {
            // non-fatal
          }
        }

        expired++;
      } else if (daysSince >= WARN_DAYS) {
        const daysLeft = Math.ceil(RECONFIRM_DAYS - daysSince);
        if (cred.user.email) {
          try {
            await sendCredentialExpiryEmail(cred.user.email, {
              portal: cred.portal,
              action: "warning",
              daysLeft,
            });
          } catch {
            // non-fatal
          }
        }
        warned++;
      }
    }

    return NextResponse.json({ ok: true, warned, expired, paused });
  } catch (err) {
    console.error("Credential expiry enforcement error:", err);
    return NextResponse.json({ error: "Prüfung fehlgeschlagen" }, { status: 500 });
  }
}
