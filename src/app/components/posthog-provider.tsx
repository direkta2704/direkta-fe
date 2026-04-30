"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { initPostHog, identifyUser, resetUser } from "@/lib/posthog";
import posthog from "posthog-js";

export default function PostHogProvider() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  useEffect(() => {
    initPostHog();
  }, []);

  // Identify user on login
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      identifyUser(
        (session.user as { id?: string }).id || session.user.email || "",
        session.user.email || "",
        session.user.name || undefined
      );
    } else if (status === "unauthenticated") {
      resetUser();
    }
  }, [status, session]);

  // Track page views on route change
  useEffect(() => {
    if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      posthog.capture("$pageview", { path: pathname });
    }
  }, [pathname]);

  return null;
}
