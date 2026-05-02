"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useParams } from "next/navigation";

export default function PrintButton() {
  const searchParams = useSearchParams();
  const params = useParams();
  const autoPrint = searchParams.get("print") === "1";
  const [downloading, setDownloading] = useState(false);
  const listingId = params.id as string;

  useEffect(() => {
    if (autoPrint) {
      downloadPdf();
    }
  }, [autoPrint]);

  async function downloadPdf() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/listings/${listingId}/pdf`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Expose_${listingId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Fallback to browser print if API fails (e.g., not logged in)
        window.print();
      }
    } catch {
      window.print();
    }
    setDownloading(false);
  }

  return (
    <div className="print-controls">
      <button onClick={downloadPdf} disabled={downloading} className="print-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" />
        </svg>
        {downloading ? "Wird erstellt..." : "PDF herunterladen"}
      </button>
    </div>
  );
}
