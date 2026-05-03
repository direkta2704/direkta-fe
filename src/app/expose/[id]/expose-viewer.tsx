"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function ExposeViewer({ listingId, title }: { listingId: string; title: string }) {
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get("print") === "1";
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      try {
        const res = await fetch(`/api/listings/${listingId}/pdf?inline=1`);
        if (!res.ok) throw new Error("PDF failed");
        const blob = await res.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
        setLoading(false);

        if (autoPrint) {
          const a = document.createElement("a");
          a.href = url;
          a.download = `Expose_${title.replace(/[·\s]+/g, "_")}.pdf`;
          a.click();
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    }

    loadPdf();
    return () => { cancelled = true; };
  }, [listingId, autoPrint, title]);

  function handleDownload() {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `Expose_${title.replace(/[·\s]+/g, "_")}.pdf`;
    a.click();
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: "32px", marginBottom: "16px" }}>⚠</div>
          <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px" }}>PDF konnte nicht erstellt werden</h2>
          <p style={{ color: "#6b7280", fontSize: "14px" }}>Bitte versuchen Sie es erneut.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={spinnerStyle} />
          <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px", marginTop: "20px" }}>Exposé wird erstellt...</h2>
          <p style={{ color: "#6b7280", fontSize: "14px" }}>{title}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", background: "#1a1a1a" }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "12px 20px", background: "#0f1b2e", color: "white",
        fontFamily: "Helvetica, Arial, sans-serif",
      }}>
        <span style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.1em" }}>
          DIREKTA<span style={{ color: "#B85432" }}>.</span> Exposé
        </span>
        <div style={{ display: "flex", gap: "12px" }}>
          <button onClick={handleDownload} style={btnStyle}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            PDF herunterladen
          </button>
        </div>
      </div>
      <iframe
        src={pdfUrl || ""}
        style={{ flex: 1, border: "none", width: "100%" }}
        title="Exposé PDF"
      />
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  width: "100vw", height: "100vh", display: "flex",
  alignItems: "center", justifyContent: "center",
  background: "#f7f3ea", fontFamily: "Helvetica, Arial, sans-serif",
};

const cardStyle: React.CSSProperties = {
  textAlign: "center", padding: "48px", background: "white",
  borderRadius: "16px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
};

const spinnerStyle: React.CSSProperties = {
  width: "40px", height: "40px", border: "3px solid #e6e1d7",
  borderTopColor: "#8b6f47", borderRadius: "50%",
  animation: "spin 1s linear infinite", margin: "0 auto",
};

const btnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "8px",
  padding: "8px 16px", background: "rgba(255,255,255,0.1)",
  color: "white", border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: "8px", fontSize: "13px", fontWeight: 600,
  cursor: "pointer", transition: "all 0.15s",
};
