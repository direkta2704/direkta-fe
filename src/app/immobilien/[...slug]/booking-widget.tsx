"use client";

import { useEffect, useState } from "react";

interface Slot {
  id: string;
  startsAt: string;
  endsAt: string;
  mode: string;
}

export default function BookingWidget({ listingId }: { listingId: string }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [booking, setBooking] = useState(false);
  const [success, setSuccess] = useState<{ startsAt: string; location: string; ics: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/public/viewings?listingId=${listingId}`)
      .then((r) => r.json())
      .then((data) => setSlots(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [listingId]);

  async function handleBook() {
    if (!selectedSlot || !name || !email) return;
    setBooking(true);
    setError("");

    try {
      const res = await fetch("/api/public/viewings/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewingId: selectedSlot, name, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess({ startsAt: data.viewing.startsAt, location: data.viewing.location, ics: data.ics });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Buchung fehlgeschlagen");
    }
    setBooking(false);
  }

  function downloadICS() {
    if (!success?.ics) return;
    const blob = new Blob([atob(success.ics)], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "besichtigung.ics";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return null;
  if (slots.length === 0) return null;

  if (success) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-7 text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-2xl">event_available</span>
        </div>
        <h3 className="text-lg font-black text-blueprint mb-2">Besichtigung gebucht</h3>
        <p className="text-sm text-slate-500 mb-1">
          {new Date(success.startsAt).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
        <p className="text-sm text-slate-500 mb-1">
          {new Date(success.startsAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr
        </p>
        <p className="text-xs text-slate-400 mb-4">{success.location}</p>
        <button
          onClick={downloadICS}
          className="bg-blueprint hover:bg-primary text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors flex items-center justify-center gap-2 mx-auto"
        >
          <span className="material-symbols-outlined text-base">calendar_today</span>
          Zum Kalender hinzufügen
        </button>
      </div>
    );
  }

  // Group slots by date
  const grouped: Record<string, Slot[]> = {};
  slots.forEach((s) => {
    const dateKey = new Date(s.startsAt).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(s);
  });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-lg shadow-slate-200/50">
      <h3 className="text-lg font-black text-blueprint mb-1">Besichtigung buchen</h3>
      <p className="text-xs text-slate-500 mb-5">Wählen Sie einen verfügbaren Termin.</p>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">{error}</div>
      )}

      <div className="space-y-4 mb-5 max-h-60 overflow-y-auto">
        {Object.entries(grouped).map(([date, dateSlots]) => (
          <div key={date}>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">{date}</div>
            <div className="flex flex-wrap gap-2">
              {dateSlots.map((slot) => {
                const time = new Date(slot.startsAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
                return (
                  <button
                    key={slot.id}
                    onClick={() => setSelectedSlot(slot.id)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                      selectedSlot === slot.id
                        ? "bg-primary text-white"
                        : "bg-slate-50 border border-slate-200 text-blueprint hover:border-primary"
                    }`}
                  >
                    {time} Uhr
                    {slot.mode === "VIRTUAL" && (
                      <span className="ml-1 opacity-60">📹</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {selectedSlot && (
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ihr Name *"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Ihre E-Mail *"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
          <button
            onClick={handleBook}
            disabled={booking || !name || !email}
            className="w-full bg-primary hover:bg-primary-dark text-white py-3 rounded-xl font-black text-sm uppercase tracking-[0.18em] transition-all hover:scale-[1.02] shadow-lg shadow-primary/25 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">event_available</span>
            {booking ? "Wird gebucht..." : "Termin buchen"}
          </button>
        </div>
      )}
    </div>
  );
}
