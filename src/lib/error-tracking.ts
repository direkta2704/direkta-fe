const SENTRY_DSN = process.env.SENTRY_DSN || "";

let sentryInitialized = false;

export async function initErrorTracking() {
  if (sentryInitialized || !SENTRY_DSN) return;

  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: SENTRY_DSN,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV,
    });
    sentryInitialized = true;
    console.log("[Sentry] Initialized");
  } catch {
    console.warn("[Sentry] @sentry/nextjs not installed — error tracking disabled");
  }
}

export function captureException(error: Error, context?: Record<string, unknown>) {
  console.error("[Error]", error.message, context);

  if (SENTRY_DSN && sentryInitialized) {
    import("@sentry/nextjs").then((Sentry) => {
      Sentry.captureException(error, { extra: context });
    }).catch(() => {});
  }
}

export function captureMessage(message: string, level: "info" | "warning" | "error" = "info") {
  console.log(`[${level}]`, message);

  if (SENTRY_DSN && sentryInitialized) {
    import("@sentry/nextjs").then((Sentry) => {
      Sentry.captureMessage(message, level);
    }).catch(() => {});
  }
}
