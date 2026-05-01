"use client";

import { useEffect, useState } from "react";

interface Viewing {
  id: string;
  startsAt: string;
  endsAt: string;
  mode: string;
  status: string;
  notes: string | null;
  leadId: string | null;
  listing: {
    id: string;
    property: { street: string; houseNumber: string; city: string; postcode: string };
  };
  lead: { id: string; name: string | null; emailRaw: string; phone: string | null; qualityScore: number | null } | null;
}

interface ListingOption {
  id: string;
  property: { street: string; houseNumber: string; city: string };
}

const STATUS_DE: Record<string, { label: string; color: string }> = {
  PROPOSED: { label: "Verfügbar", color: "bg-blue-50 text-blue-600" },
  CONFIRMED: { label: "Bestätigt", color: "bg-emerald-50 text-emerald-600" },
  COMPLETED: { label: "Abgeschlossen", color: "bg-slate-100 text-slate-500" },
  CANCELLED: { label: "Abgesagt", color: "bg-red-50 text-red-500" },
  NO_SHOW: { label: "Nicht erschienen", color: "bg-amber-50 text-amber-600" },
};

export default function ViewingsPage() {
  const [viewings, setViewings] = useState<Viewing[]>([]);
  const [listings, setListings] = useState<ListingOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterListing, setFilterListing] = useState("ALL");

  // Form state
  const [formListingId, setFormListingId] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formStartTime, setFormStartTime] = useState("10:00");
  const [formEndTime, setFormEndTime] = useState("11:00");
  const [formMode, setFormMode] = useState("ONSITE");
  const [formRepeat, setFormRepeat] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/viewings").then((r) => r.json()),
      fetch("/api/listings").then((r) => r.json()),
    ]).then(([v, l]) => {
      setViewings(Array.isArray(v) ? v : []);
      const listingOpts = Array.isArray(l) ? l : [];
      setListings(listingOpts);
      if (listingOpts.length > 0) setFormListingId(listingOpts[0].id);
      setLoading(false);
    });
  }, []);

  async function createSlot() {
    if (!formListingId || !formDate || !formStartTime || !formEndTime) return;
    setSaving(true);

    const created: Viewing[] = [];
    for (let week = 0; week < formRepeat; week++) {
      const baseDate = new Date(formDate);
      baseDate.setDate(baseDate.getDate() + week * 7);
      const dateStr = baseDate.toISOString().split("T")[0];

      const startsAt = new Date(`${dateStr}T${formStartTime}:00`);
      const endsAt = new Date(`${dateStr}T${formEndTime}:00`);

      const res = await fetch("/api/viewings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: formListingId, startsAt, endsAt, mode: formMode }),
      });

      if (res.ok) {
        const viewing = await res.json();
        created.push({ ...viewing, listing: listings.find((l) => l.id === formListingId), lead: null });
      }
    }

    setViewings((prev) => [...prev, ...created]);
    setShowForm(false);
    setFormDate("");
    setFormRepeat(1);
    setSaving(false);
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/viewings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setViewings((prev) => prev.map((v) => (v.id === id ? { ...v, status } : v)));
  }

  async function updateNotes(id: string, notes: string) {
    await fetch(`/api/viewings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    setViewings((prev) => prev.map((v) => (v.id === id ? { ...v, notes } : v)));
  }

  async function deleteViewing(id: string) {
    await fetch(`/api/viewings/${id}`, { method: "DELETE" });
    setViewings((prev) => prev.filter((v) => v.id !== id));
  }

  function downloadICS(id: string) {
    window.open(`/api/viewings/${id}?format=ics`, "_blank");
  }

  // Filter
  const filtered = filterListing === "ALL" ? viewings : viewings.filter((v) => v.listing.id === filterListing);
  const upcoming = filtered.filter((v) => new Date(v.startsAt) >= new Date() && v.status !== "CANCELLED");
  const past = filtered.filter((v) => new Date(v.startsAt) < new Date() || v.status === "CANCELLED");

  // Stats
  const confirmed = viewings.filter((v) => v.status === "CONFIRMED").length;
  const completed = viewings.filter((v) => v.status === "COMPLETED").length;
  const noShows = viewings.filter((v) => v.status === "NO_SHOW").length;
  const available = viewings.filter((v) => v.status === "PROPOSED" && !v.leadId).length;

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-blueprint tracking-tight">Besichtigungen</h1>
          <p className="text-slate-500 mt-1">
            {upcoming.length} anstehend · {available} offene Zeitfenster
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-primary hover:bg-primary-dark text-white px-5 py-3 rounded-xl text-sm font-black uppercase tracking-[0.18em] transition-all hover:scale-[1.02] flex items-center gap-2 shadow-lg shadow-primary/25"
        >
          <span className="material-symbols-outlined text-lg">{showForm ? "close" : "calendar_add_on"}</span>
          {showForm ? "Abbrechen" : "Zeitfenster hinzufügen"}
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Verfügbar", value: available, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Bestätigt", value: confirmed, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Abgeschlossen", value: completed, color: "text-slate-600", bg: "bg-slate-50" },
          { label: "Nicht erschienen", value: noShows, color: "text-amber-600", bg: "bg-amber-50" },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 text-center`}>
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter by property */}
      {listings.length > 1 && (
        <div className="mb-6">
          <select
            value={filterListing}
            onChange={(e) => setFilterListing(e.target.value)}
            className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-blueprint outline-none"
          >
            <option value="ALL">Alle Immobilien</option>
            {listings.map((l) => (
              <option key={l.id} value={l.id}>{l.property.street} {l.property.houseNumber}, {l.property.city}</option>
            ))}
          </select>
        </div>
      )}

      {/* Create slot form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 p-7 mb-6">
          <h2 className="text-lg font-black text-blueprint mb-5">Neues Zeitfenster erstellen</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1.5">Inserat</label>
              <select value={formListingId} onChange={(e) => setFormListingId(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint outline-none focus:border-primary">
                {listings.map((l) => (
                  <option key={l.id} value={l.id}>{l.property.street} {l.property.houseNumber}, {l.property.city}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1.5">Datum</label>
              <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} min={new Date().toISOString().split("T")[0]}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1.5">Von</label>
              <input type="time" value={formStartTime} onChange={(e) => setFormStartTime(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1.5">Bis</label>
              <input type="time" value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1.5">Art</label>
              <select value={formMode} onChange={(e) => setFormMode(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint outline-none focus:border-primary">
                <option value="ONSITE">Vor Ort</option>
                <option value="VIRTUAL">Virtuell</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1.5">Wiederholen</label>
              <select value={formRepeat} onChange={(e) => setFormRepeat(Number(e.target.value))} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint outline-none focus:border-primary">
                <option value={1}>Einmalig</option>
                <option value={2}>2 Wochen</option>
                <option value={4}>4 Wochen</option>
                <option value={8}>8 Wochen</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button onClick={createSlot} disabled={saving || !formDate}
              className="bg-blueprint hover:bg-primary text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors disabled:opacity-60 flex items-center gap-2">
              <span className="material-symbols-outlined text-base">add</span>
              {saving ? "Wird erstellt..." : formRepeat > 1 ? `${formRepeat} Zeitfenster erstellen` : "Zeitfenster erstellen"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : viewings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
          <span className="material-symbols-outlined text-5xl text-slate-300 mb-4 block">calendar_month</span>
          <h2 className="text-xl font-black text-blueprint mb-2">Noch keine Besichtigungen</h2>
          <p className="text-slate-500 max-w-md mx-auto">
            Erstellen Sie Zeitfenster, damit qualifizierte Käufer Besichtigungen buchen können.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-lg font-black text-blueprint mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">upcoming</span>
                Anstehende ({upcoming.length})
              </h2>
              <div className="space-y-3">
                {upcoming.map((v) => (
                  <ViewingCard key={v.id} viewing={v} onUpdateStatus={updateStatus} onUpdateNotes={updateNotes} onDelete={deleteViewing} onDownloadICS={downloadICS} />
                ))}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h2 className="text-lg font-black text-blueprint mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-400">history</span>
                Vergangene ({past.length})
              </h2>
              <div className="space-y-3">
                {past.map((v) => (
                  <ViewingCard key={v.id} viewing={v} onUpdateStatus={updateStatus} onUpdateNotes={updateNotes} onDelete={deleteViewing} onDownloadICS={downloadICS} past />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function ViewingCard({
  viewing: v,
  onUpdateStatus,
  onUpdateNotes,
  onDelete,
  onDownloadICS,
  past,
}: {
  viewing: Viewing;
  onUpdateStatus: (id: string, status: string) => void;
  onUpdateNotes: (id: string, notes: string) => void;
  onDelete: (id: string) => void;
  onDownloadICS: (id: string) => void;
  past?: boolean;
}) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState(v.notes || "");

  const status = STATUS_DE[v.status] || { label: v.status, color: "bg-slate-100 text-slate-500" };
  const date = new Date(v.startsAt);
  const endDate = new Date(v.endsAt);
  const isBooked = !!v.leadId;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-5">
        {/* Date block */}
        <div className="flex-shrink-0 w-16 h-16 bg-slate-50 rounded-xl flex flex-col items-center justify-center">
          <span className="text-[10px] font-black uppercase text-slate-400">
            {date.toLocaleDateString("de-DE", { weekday: "short" })}
          </span>
          <span className="text-2xl font-black text-blueprint leading-none">{date.getDate()}</span>
          <span className="text-[10px] font-bold text-slate-400">
            {date.toLocaleDateString("de-DE", { month: "short" })}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${status.color}`}>
              {status.label}
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
              {v.mode === "VIRTUAL" ? "Virtuell" : "Vor Ort"}
            </span>
          </div>
          <p className="text-sm font-bold text-blueprint">
            {date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} – {endDate.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr
          </p>
          <p className="text-xs text-slate-500 truncate">
            {v.listing.property.street} {v.listing.property.houseNumber}, {v.listing.property.city}
          </p>
        </div>

        {/* Buyer info + contact */}
        <div className="flex-shrink-0">
          {isBooked && v.lead ? (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-bold text-blueprint">{v.lead.name || "Unbekannt"}</p>
                <p className="text-xs text-slate-400">{v.lead.emailRaw}</p>
                {v.lead.qualityScore != null && (
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full mt-1 inline-block ${
                    v.lead.qualityScore >= 80 ? "bg-emerald-50 text-emerald-600"
                    : v.lead.qualityScore >= 50 ? "bg-amber-50 text-amber-600"
                    : "bg-slate-100 text-slate-500"
                  }`}>Score: {v.lead.qualityScore}</span>
                )}
              </div>
              {/* Contact buttons */}
              <div className="flex flex-col gap-1">
                {v.lead.phone && (
                  <a href={`tel:${v.lead.phone}`} className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100" title="Anrufen">
                    <span className="material-symbols-outlined text-sm">call</span>
                  </a>
                )}
                <a href={`mailto:${v.lead.emailRaw}`} className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100" title="E-Mail">
                  <span className="material-symbols-outlined text-sm">mail</span>
                </a>
                {v.lead.phone && (
                  <a href={`https://wa.me/${v.lead.phone.replace(/[^0-9+]/g, "")}`} target="_blank" className="w-7 h-7 rounded-lg bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100" title="WhatsApp">
                    <span className="material-symbols-outlined text-sm">chat</span>
                  </a>
                )}
              </div>
            </div>
          ) : (
            <span className="text-xs text-slate-400 italic">Noch nicht gebucht</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {!past && v.status === "PROPOSED" && isBooked && (
            <button onClick={() => onUpdateStatus(v.id, "CONFIRMED")} className="w-8 h-8 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 flex items-center justify-center" title="Bestätigen">
              <span className="material-symbols-outlined text-lg">check_circle</span>
            </button>
          )}
          {!past && v.status === "CONFIRMED" && (
            <>
              <button onClick={() => onUpdateStatus(v.id, "COMPLETED")} className="w-8 h-8 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 flex items-center justify-center" title="Abgeschlossen">
                <span className="material-symbols-outlined text-lg">task_alt</span>
              </button>
              <button onClick={() => onUpdateStatus(v.id, "NO_SHOW")} className="w-8 h-8 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 flex items-center justify-center" title="Nicht erschienen">
                <span className="material-symbols-outlined text-lg">person_off</span>
              </button>
            </>
          )}
          <button onClick={() => onDownloadICS(v.id)} className="w-8 h-8 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 flex items-center justify-center" title="Kalender (.ics)">
            <span className="material-symbols-outlined text-lg">calendar_today</span>
          </button>
          <button onClick={() => setEditingNotes(!editingNotes)} className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blueprint flex items-center justify-center" title="Notizen">
            <span className="material-symbols-outlined text-lg">{v.notes ? "edit_note" : "note_add"}</span>
          </button>
          {!past && v.status !== "CANCELLED" && (
            <button onClick={() => onUpdateStatus(v.id, "CANCELLED")} className="w-8 h-8 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 flex items-center justify-center" title="Absagen">
              <span className="material-symbols-outlined text-lg">cancel</span>
            </button>
          )}
          {v.status === "PROPOSED" && !isBooked && (
            <button onClick={() => onDelete(v.id)} className="w-8 h-8 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 flex items-center justify-center" title="Löschen">
              <span className="material-symbols-outlined text-lg">delete</span>
            </button>
          )}
        </div>
      </div>

      {/* Notes section */}
      {(editingNotes || v.notes) && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          {editingNotes ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                placeholder="Notizen zur Besichtigung..."
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm text-blueprint outline-none focus:border-primary"
                autoFocus
              />
              <button
                onClick={() => { onUpdateNotes(v.id, notesText); setEditingNotes(false); }}
                className="px-3 py-2 rounded-lg bg-blueprint text-white text-xs font-bold"
              >
                Speichern
              </button>
              <button onClick={() => { setEditingNotes(false); setNotesText(v.notes || ""); }} className="px-3 py-2 rounded-lg text-xs font-bold text-slate-400">
                Abbrechen
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-slate-400">note</span>
              {v.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
