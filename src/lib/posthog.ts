import posthog from "posthog-js";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || "";
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

let initialized = false;

export function initPostHog() {
  console.log("[PostHog] init called, key:", POSTHOG_KEY ? POSTHOG_KEY.slice(0, 12) + "..." : "MISSING", "host:", POSTHOG_HOST);
  if (initialized || !POSTHOG_KEY || typeof window === "undefined") return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    persistence: "localStorage",
    disable_session_recording: false,
  });

  initialized = true;
  console.log("[PostHog] initialized successfully");
  posthog.capture("$pageview");

  // Expose for debugging
  if (typeof window !== "undefined") {
    (window as unknown as Record<string, unknown>).__posthog = posthog;
  }
}

export function identifyUser(userId: string, email: string, name?: string) {
  if (!POSTHOG_KEY) return;
  posthog.identify(userId, { email, name: name || undefined });
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (!POSTHOG_KEY) return;
  posthog.capture(event, properties);
}

export function resetUser() {
  if (!POSTHOG_KEY) return;
  posthog.reset();
}

// Pre-defined events for Direkta funnel
export const EVENTS = {
  SIGNUP: "user_signed_up",
  LOGIN: "user_logged_in",
  PROPERTY_CREATED: "property_created",
  UNIT_ADDED: "unit_added",
  PHOTOS_UPLOADED: "photos_uploaded",
  LISTING_CREATED: "listing_created",
  AI_TEXT_GENERATED: "ai_text_generated",
  PRICE_CALCULATED: "price_calculated",
  LISTING_PUBLISHED: "listing_published",
  LEAD_RECEIVED: "lead_received",
  OFFER_RECEIVED: "offer_received",
  OFFER_ACCEPTED: "offer_accepted",
  SALE_COMPLETED: "sale_completed",
  VALUATION_STARTED: "valuation_started",
  VALUATION_COMPLETED: "valuation_completed",
  VALUATION_EMAIL_CAPTURED: "valuation_email_captured",
  EXPOSE_PREVIEWED: "expose_previewed",
  EXPOSE_PDF_DOWNLOADED: "expose_pdf_downloaded",
} as const;
