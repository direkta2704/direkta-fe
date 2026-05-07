import { prisma } from "./prisma";

export async function logListingEvent(
  listingId: string,
  type: string,
  payload?: Record<string, unknown>,
  actorUserId?: string,
) {
  await prisma.listingEvent.create({
    data: {
      listingId,
      type,
      payload: payload ? JSON.parse(JSON.stringify(payload)) : undefined,
      actorUserId: actorUserId ?? undefined,
    },
  });
}

export const EVENT_TYPES = {
  CREATED: "CREATED",
  PUBLISHED: "PUBLISHED",
  PAUSED: "PAUSED",
  WITHDRAWN: "WITHDRAWN",
  CLOSED: "CLOSED",
  PRICE_CHANGED: "PRICE_CHANGED",
  DESCRIPTION_UPDATED: "DESCRIPTION_UPDATED",
  LEAD_RECEIVED: "LEAD_RECEIVED",
  OFFER_RECEIVED: "OFFER_RECEIVED",
  OFFER_ACCEPTED: "OFFER_ACCEPTED",
  OFFER_REJECTED: "OFFER_REJECTED",
  SYNDICATION_PUBLISHED: "SYNDICATION_PUBLISHED",
  SYNDICATION_FAILED: "SYNDICATION_FAILED",
  PHOTO_ADDED: "PHOTO_ADDED",
  PHOTO_REMOVED: "PHOTO_REMOVED",
} as const;
