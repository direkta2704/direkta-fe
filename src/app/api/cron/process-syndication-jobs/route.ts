import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDriver } from "@/lib/portal-driver";
import { isCircuitOpen, recordSuccess, recordFailure } from "@/lib/circuit-breaker";
import { sendSyndicationFailureEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Cron: process QUEUED syndication jobs (PAUSE, WITHDRAW, UPDATE)
// These are created when a listing changes status or content but need
// the portal driver to actually execute the action on the remote portal.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const MAX_JOBS_PER_RUN = 20;
  const MAX_RETRIES = 3;

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  try {
    const jobs = await prisma.syndicationJob.findMany({
      where: {
        status: { in: ["QUEUED", "RETRYING"] },
        kind: { in: ["PAUSE", "WITHDRAW", "UPDATE", "UNPAUSE"] },
        attempts: { lt: MAX_RETRIES },
      },
      include: {
        syndicationTarget: {
          include: {
            listing: {
              include: {
                property: {
                  include: {
                    energyCert: true,
                    media: {
                      where: { kind: { in: ["PHOTO", "FLOORPLAN"] } },
                      orderBy: { ordering: "asc" },
                    },
                    user: { select: { name: true, email: true, phone: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { scheduledFor: "asc" },
      take: MAX_JOBS_PER_RUN,
    });

    for (const job of jobs) {
      const target = job.syndicationTarget;
      const portal = target.portal;

      if (isCircuitOpen(portal)) {
        skipped++;
        continue;
      }

      if (!target.externalListingId && job.kind !== "UPDATE") {
        // Can't pause/withdraw a listing that was never published
        await prisma.syndicationJob.update({
          where: { id: job.id },
          data: { status: "SUCCESS", finishedAt: new Date(), attempts: job.attempts + 1 },
        });
        succeeded++;
        processed++;
        continue;
      }

      try {
        await prisma.syndicationJob.update({
          where: { id: job.id },
          data: { status: "RUNNING", startedAt: new Date(), attempts: job.attempts + 1 },
        });

        const driver = getDriver(portal);

        switch (job.kind) {
          case "PAUSE":
            if (target.externalListingId) {
              await driver.pause(target.externalListingId);
            }
            break;

          case "WITHDRAW":
            if (target.externalListingId) {
              await driver.withdraw(target.externalListingId);
            }
            break;

          case "UNPAUSE":
            // Re-publish with existing data
            if (target.externalListingId) {
              await driver.update(target.externalListingId, {});
            }
            break;

          case "UPDATE": {
            if (!target.externalListingId) break;
            const listing = target.listing;
            const p = listing.property;
            const photoKeys = p.media.map((m) =>
              m.kind === "FLOORPLAN" ? `floorplan:${m.storageKey}` : m.storageKey
            );

            await driver.update(target.externalListingId, {
              title: listing.titleShort || `${p.street} ${p.houseNumber}`,
              description: listing.descriptionLong || "",
              price: listing.askingPrice ? Number(listing.askingPrice) : 0,
              propertyType: p.type,
              livingArea: p.livingArea,
              plotArea: p.plotArea,
              rooms: p.rooms,
              bathrooms: p.bathrooms,
              floor: p.floor,
              yearBuilt: p.yearBuilt,
              condition: p.condition,
              attributes: (p.attributes as string[]) || [],
              city: p.city,
              postcode: p.postcode,
              street: p.street,
              houseNumber: p.houseNumber,
              photos: photoKeys,
              energyClass: p.energyCert?.energyClass || null,
              energyValue: p.energyCert?.energyValue || null,
              energyCertType: p.energyCert?.type || null,
              energyPrimarySource: p.energyCert?.primarySource || null,
            });
            break;
          }
        }

        await prisma.syndicationJob.update({
          where: { id: job.id },
          data: { status: "SUCCESS", finishedAt: new Date() },
        });

        await prisma.syndicationTarget.update({
          where: { id: target.id },
          data: { lastSyncedAt: new Date() },
        });

        recordSuccess(portal);
        succeeded++;
      } catch (err) {
        const isRetryable = job.attempts + 1 < MAX_RETRIES;

        await prisma.syndicationJob.update({
          where: { id: job.id },
          data: {
            status: isRetryable ? "RETRYING" : "FAILED",
            finishedAt: isRetryable ? undefined : new Date(),
            lastError: String(err),
          },
        });

        recordFailure(portal);

        if (!isRetryable) {
          const sellerEmail = target.listing.property.user?.email;
          if (sellerEmail) {
            const errMsg = String(err).toLowerCase();
            const isCaptchaMfa = errMsg.includes("captcha") || errMsg.includes("mfa") || errMsg.includes("two-factor");
            const isLayoutChange = errMsg.includes("selector") || errMsg.includes("timeout");

            try {
              await sendSyndicationFailureEmail(sellerEmail, {
                portal,
                propertyAddress: `${target.listing.property.street} ${target.listing.property.houseNumber}, ${target.listing.property.city}`,
                errorType: isCaptchaMfa ? "captcha_mfa" : isLayoutChange ? "layout_change" : "unknown",
                errorMessage: err instanceof Error ? err.message : String(err),
              });
            } catch {
              // email failure is non-fatal
            }
          }

          // Mark permanently failed jobs as DEAD after max retries
          await prisma.syndicationJob.update({
            where: { id: job.id },
            data: { status: "DEAD" },
          });
        }

        failed++;
      }

      processed++;
    }

    return NextResponse.json({ ok: true, processed, succeeded, failed, skipped });
  } catch (err) {
    console.error("Process syndication jobs error:", err);
    return NextResponse.json({ error: "Verarbeitung fehlgeschlagen" }, { status: 500 });
  }
}
