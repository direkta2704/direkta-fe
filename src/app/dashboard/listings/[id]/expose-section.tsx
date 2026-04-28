"use client";

import { useState } from "react";

interface Props {
  listingId: string;
  initial: {
    exposeHeadline: string | null;
    locationDescription: string | null;
    buildingDescription: string | null;
    highlights: string[] | null;
    sellerContact: { name?: string; phone?: string; email?: string; company?: string } | null;
  };
}

export default function ExposeSection({ listingId, initial }: Props) {
  const [headline, setHeadline] = useState(initial.exposeHeadline || "");
  const [location, setLocation] = useState(initial.locationDescription || "");
  const [building, setBuilding] = useState(initial.buildingDescription || "");
  const [highlights, setHighlights] = useState<string[]>(initial.highlights || [""]);
  const [contact, setContact] = useState(initial.sellerContact || { name: "", phone: "", email: "", company: "" });
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/listings/${listingId}/expose-content`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setHeadline(data.exposeHeadline || "");
      setLocation(data.locationDescription || "");
      setBuilding(data.buildingDescription || "");
      setHighlights(data.highlights || []);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Generierung fehlgeschlagen");
    }
    setGenerating(false);
  }

  async function save() {
    setSaving(true); setSaved(false);
    await fetch(`/api/listings/${listingId}/expose-content`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exposeHeadline: headline,
        locationDescription: location,
        buildingDescription: building,
        highlights: highlights.filter(Boolean),
        sellerContact: contact,
      }),
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-7 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-blueprint">Expose-Inhalte</h2>
          <p className="text-xs text-slate-500 mt-0.5">Zusaetzliche Texte und Kontaktdaten fuer das Expose</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={generate} disabled={generating}
            className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors disabled:opacity-60 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base">{generating ? "hourglass_top" : "auto_awesome"}</span>
            {generating ? "Wird generiert..." : "KI generieren"}
          </button>
          <button onClick={save} disabled={saving}
            className="bg-blueprint hover:bg-primary text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors disabled:opacity-60">
            {saving ? "Speichert..." : saved ? "Gespeichert!" : "Speichern"}
          </button>
        </div>
      </div>

      {/* Headline */}
      <div>
        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1.5">Expose-Ueberschrift</label>
        <input type="text" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="z.B. Drei kernsanierte Wohnungen in Gaggenau."
          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
      </div>

      {/* Location */}
      <div>
        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1.5">Lagebeschreibung</label>
        <textarea value={location} onChange={(e) => setLocation(e.target.value)} rows={5} placeholder="Beschreibung der Lage, Infrastruktur, Verkehrsanbindung..."
          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-y" />
      </div>

      {/* Building */}
      <div>
        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1.5">Gebaeudebeschreibung</label>
        <textarea value={building} onChange={(e) => setBuilding(e.target.value)} rows={4} placeholder="Beschreibung des Gebaeudes, Bausubstanz, Besonderheiten..."
          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-y" />
      </div>

      {/* Highlights */}
      <div>
        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1.5">Highlights</label>
        <div className="space-y-2">
          {highlights.map((h, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="text" value={h} onChange={(e) => { const u = [...highlights]; u[i] = e.target.value; setHighlights(u); }}
                placeholder="z.B. Fussbodenheizung in allen Raeumen"
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm text-blueprint outline-none focus:border-primary transition-colors" />
              <button onClick={() => setHighlights(highlights.filter((_, idx) => idx !== i))}
                className="w-8 h-8 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 flex items-center justify-center">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
          ))}
          <button onClick={() => setHighlights([...highlights, ""])}
            className="text-xs font-bold text-primary hover:text-primary-dark flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">add</span> Highlight hinzufuegen
          </button>
        </div>
      </div>

      {/* Seller Contact */}
      <div>
        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3">Kontaktdaten (fuer Expose)</label>
        <div className="grid sm:grid-cols-2 gap-3">
          <input type="text" value={contact.company || ""} onChange={(e) => setContact({ ...contact, company: e.target.value })} placeholder="Firma / Unternehmen"
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary transition-colors" />
          <input type="text" value={contact.name || ""} onChange={(e) => setContact({ ...contact, name: e.target.value })} placeholder="Ansprechpartner"
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary transition-colors" />
          <input type="tel" value={contact.phone || ""} onChange={(e) => setContact({ ...contact, phone: e.target.value })} placeholder="Telefon"
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary transition-colors" />
          <input type="email" value={contact.email || ""} onChange={(e) => setContact({ ...contact, email: e.target.value })} placeholder="E-Mail"
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary transition-colors" />
        </div>
      </div>
    </div>
  );
}
