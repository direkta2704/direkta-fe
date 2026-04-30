"use client";

import { useEffect } from "react";

export default function TranslateSafe({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const origError = console.error;
    console.error = (...args: unknown[]) => {
      const msg = typeof args[0] === "string" ? args[0] : "";
      if (msg.includes("removeChild") || msg.includes("insertBefore") || msg.includes("not a child")) {
        return;
      }
      origError.apply(console, args);
    };

    const handler = (e: ErrorEvent) => {
      if (e.message?.includes("removeChild") || e.message?.includes("insertBefore") || e.message?.includes("not a child")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };
    window.addEventListener("error", handler, true);

    return () => {
      console.error = origError;
      window.removeEventListener("error", handler, true);
    };
  }, []);

  return <>{children}</>;
}
