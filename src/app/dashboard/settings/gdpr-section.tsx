"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export default function GDPRSection() {
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [exportDone, setExportDone] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) throw new Error("Export fehlgeschlagen");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Direkta_Datenexport_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportDone(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Export fehlgeschlagen");
    }
    setExporting(false);
  }

  async function handleDelete() {
    if (deleteInput !== "KONTO LOESCHEN") return;
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert("Ihr Konto wurde zur Loeschung markiert. Sie werden jetzt abgemeldet.");
      signOut({ callbackUrl: "/" });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Loeschung fehlgeschlagen");
      setDeleting(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-7">
      <h2 className="text-lg font-black text-blueprint mb-2">Daten & Datenschutz</h2>
      <p className="text-sm text-slate-500 mb-6">DSGVO-Datenverwaltung und Kontolöschung.</p>

      <div className="space-y-4">
        {/* Data export */}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="w-full flex items-center justify-between py-4 px-5 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors text-left disabled:opacity-60"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-lg text-slate-400">download</span>
            <div>
              <p className="text-sm font-bold text-blueprint">
                {exporting ? "Wird exportiert..." : "Meine Daten exportieren"}
              </p>
              <p className="text-xs text-slate-400">
                Alle Ihre Daten als JSON herunterladen (DSGVO Art. 20)
              </p>
            </div>
          </div>
          {exportDone ? (
            <span className="material-symbols-outlined text-emerald-500">check_circle</span>
          ) : (
            <span className="material-symbols-outlined text-slate-400">chevron_right</span>
          )}
        </button>

        {/* Account deletion */}
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center justify-between py-4 px-5 rounded-xl border border-red-200 hover:border-red-300 hover:bg-red-50/50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-lg text-red-400">delete_forever</span>
              <div>
                <p className="text-sm font-bold text-red-600">Konto loeschen</p>
                <p className="text-xs text-red-400">
                  Konto und alle Daten dauerhaft loeschen (14 Tage Widerrufsfrist)
                </p>
              </div>
            </div>
            <span className="material-symbols-outlined text-red-400">chevron_right</span>
          </button>
        ) : (
          <div className="border border-red-300 bg-red-50 rounded-xl p-6">
            <div className="flex items-start gap-3 mb-5">
              <span className="material-symbols-outlined text-2xl text-red-500 mt-0.5">warning</span>
              <div>
                <h3 className="font-black text-red-700 mb-1">Konto endgueltig loeschen</h3>
                <p className="text-sm text-red-600 leading-relaxed">
                  Diese Aktion kann nicht rueckgaengig gemacht werden. Folgendes wird geloescht:
                </p>
                <ul className="mt-3 space-y-1.5 text-sm text-red-600">
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">remove_circle</span>
                    Alle Immobilien und Inserate
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">remove_circle</span>
                    Alle Fotos und Dokumente
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">remove_circle</span>
                    Alle Interessenten und Angebote
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">remove_circle</span>
                    Portal-Verbindungen
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">remove_circle</span>
                    Ihr Profil und Kontodaten
                  </li>
                </ul>
              </div>
            </div>

            <p className="text-xs text-red-600 mb-3">
              Tippen Sie <strong>KONTO LOESCHEN</strong> ein, um zu bestaetigen:
            </p>
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="KONTO LOESCHEN"
              className="w-full px-4 py-3 rounded-xl border border-red-300 text-sm text-red-700 placeholder:text-red-300 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all mb-4 font-bold"
            />

            <div className="flex items-center gap-3">
              <button
                onClick={handleDelete}
                disabled={deleteInput !== "KONTO LOESCHEN" || deleting}
                className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors disabled:opacity-40 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">delete_forever</span>
                {deleting ? "Wird geloescht..." : "Konto endgueltig loeschen"}
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteInput(""); }}
                className="text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
