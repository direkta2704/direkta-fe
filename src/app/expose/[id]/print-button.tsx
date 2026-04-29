"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function PrintButton() {
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get("print") === "1";

  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => window.print(), 800);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  return (
    <div className="print-controls">
      <button onClick={() => window.print()} className="print-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" />
        </svg>
        PDF herunterladen
      </button>
    </div>
  );
}
