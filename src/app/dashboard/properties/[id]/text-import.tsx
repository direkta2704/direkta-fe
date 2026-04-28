"use client";

import { useState } from "react";

export default function TextImport({ propertyId, onImported }: { propertyId: string; onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; extracted?: Record<string, unknown> } | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileUpload(file: File) {
    setUploading(true);
    try {
      const isDocx = file.name.toLowerCase().endsWith(".docx") ||
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      if (isDocx) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/extract-text", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "Fehler beim Extrahieren");
        } else if (data.text) {
          setText(data.text);
        } else {
          alert("Kein Text in der Datei gefunden");
        }
      } else {
        const content = await file.text();
        setText(content);
      }
    } catch (err) {
      console.error("File read error:", err);
      alert("Datei konnte nicht gelesen werden: " + (err instanceof Error ? err.message : ""));
    }
    setUploading(false);
  }

  async function handleImport() {
    if (!text.trim()) return;
    setImporting(true);
    setResult(null);

    try {
      const res = await fetch(`/api/properties/${propertyId}/import-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setResult({ ok: true, message: data.message });
      onImported();
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : "Import fehlgeschlagen" });
    }
    setImporting(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-white border-2 border-dashed border-slate-200 hover:border-primary/40 rounded-2xl p-6 flex items-center justify-center gap-3 transition-colors group"
      >
        <span className="material-symbols-outlined text-2xl text-slate-300 group-hover:text-primary transition-colors">
          smart_toy
        </span>
        <div className="text-left">
          <span className="text-sm font-black text-blueprint group-hover:text-primary transition-colors block">
            Aus Text importieren (KI)
          </span>
          <span className="text-xs text-slate-400">
            Text einfuegen oder Datei hochladen — KI fuellt alle Felder automatisch
          </span>
        </div>
      </button>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-primary/30 p-7 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-black text-blueprint flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">smart_toy</span>
            KI-Textimport
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Fuegen Sie beliebigen Text ein — Notizen, E-Mail, Transkript — die KI extrahiert alle Daten automatisch.
          </p>
        </div>
        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      {/* File upload */}
      <div className="flex items-center gap-3">
        <label className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-blueprint px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors cursor-pointer flex items-center gap-2">
          <span className="material-symbols-outlined text-base">upload_file</span>
          {uploading ? "Wird geladen..." : "Datei waehlen"}
          <input
            type="file"
            accept=".txt,.md,.docx,.csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
          />
        </label>
        <span className="text-xs text-slate-400">.txt, .md, .docx — oder Text unten einfuegen</span>
      </div>

      {/* Text area */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        placeholder={"Beispiel:\n\nWir bauen in der Marxstrasse 12 in Gaggenau eine ehemalige Gaststaette in drei Wohnungen um. Zwei Wohnungen werden ca. 94-95 m² haben mit zwei Schlafzimmern und einem grossen Wohn-/Essbereich. Fussbodenheizung in allen Raeumen, Holzdielen, glatt gespachtelte Waende, hohe Tueren (2,10m), Deckenhoehe 2,70-2,80m...\n\n(Einfach den Text des Kunden einfuegen)"}
        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-y font-mono"
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{text.length} Zeichen</span>
        <button
          onClick={handleImport}
          disabled={importing || text.length < 20}
          className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-[0.18em] transition-all hover:scale-[1.02] shadow-lg shadow-primary/25 disabled:opacity-60 flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-base">auto_awesome</span>
          {importing ? "KI analysiert..." : "Daten extrahieren"}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className={`rounded-xl p-4 ${result.ok ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
          <div className="flex items-start gap-3">
            <span className={`material-symbols-outlined text-lg ${result.ok ? "text-emerald-600" : "text-red-500"}`}>
              {result.ok ? "check_circle" : "error"}
            </span>
            <div>
              <p className={`text-sm font-bold ${result.ok ? "text-emerald-800" : "text-red-700"}`}>
                {result.ok ? "Import erfolgreich" : "Import fehlgeschlagen"}
              </p>
              <p className={`text-xs mt-1 ${result.ok ? "text-emerald-600" : "text-red-600"}`}>
                {result.message}
              </p>
              {result.ok && (
                <p className="text-xs text-emerald-600 font-bold mt-2">Seite wird aktualisiert...</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
