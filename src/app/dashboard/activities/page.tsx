"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface EventItem {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  actorUserId: string | null;
  createdAt: string;
  listing: {
    id: string;
    slug: string;
    property: { street: string; houseNumber: string; city: string; type: string };
  };
}

const EVENT_META: Record<string, { icon: string; label: string; color: string }> = {
  CREATED: { icon: "add_circle", label: "Inserat erstellt", color: "text-blue-600 bg-blue-50" },
  TEXT_GENERATED: { icon: "auto_awesome", label: "KI-Text generiert", color: "text-violet-600 bg-violet-50" },
  PRICE_RECOMMENDED: { icon: "trending_up", label: "Preisempfehlung erstellt", color: "text-amber-600 bg-amber-50" },
  PUBLISHED: { icon: "public", label: "Inserat veröffentlicht", color: "text-emerald-600 bg-emerald-50" },
  PAUSED: { icon: "pause_circle", label: "Inserat pausiert", color: "text-slate-600 bg-slate-100" },
  SYNDICATED: { icon: "sync_alt", label: "Portal-Syndizierung", color: "text-blue-600 bg-blue-50" },
  LEAD_RECEIVED: { icon: "person_add", label: "Neue Anfrage", color: "text-primary bg-primary/10" },
  VIEWING_BOOKED: { icon: "calendar_month", label: "Besichtigung gebucht", color: "text-teal-600 bg-teal-50" },
  OFFER_RECEIVED: { icon: "local_offer", label: "Kaufangebot eingegangen", color: "text-amber-600 bg-amber-50" },
  OFFER_ACCEPTED: { icon: "check_circle", label: "Angebot angenommen", color: "text-emerald-600 bg-emerald-50" },
  STATUS_CHANGED: { icon: "swap_horiz", label: "Status geändert", color: "text-slate-600 bg-slate-100" },
};

const DEFAULT_META = { icon: "info", label: "Ereignis", color: "text-slate-500 bg-slate-100" };

export default function ActivitiesPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((data) => setEvents(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === "ALL" ? events : events.filter((e) => e.type === filter);

  const eventTypes = ["ALL", ...new Set(events.map((e) => e.type))];

  function formatDate(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return "Gerade eben";
    if (mins < 60) return `Vor ${mins} Min.`;
    if (hours < 24) return `Vor ${hours} Std.`;
    if (days < 7) return `Vor ${days} Tag${days > 1 ? "en" : ""}`;
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }

  function getDetail(e: EventItem): string | null {
    const p = e.payload;
    if (!p) return null;
    if (e.type === "LEAD_RECEIVED" && p.qualityScore) return `Score: ${p.qualityScore}/100`;
    if (e.type === "OFFER_RECEIVED" && p.amount) return `EUR ${Number(p.amount).toLocaleString("de-DE")}`;
    if (e.type === "OFFER_ACCEPTED" && p.finalPrice) return `EUR ${Number(p.finalPrice).toLocaleString("de-DE")}`;
    if (e.type === "SYNDICATED" && p.portal) return String(p.portal);
    if (e.type === "PUBLISHED" && p.pricingModel) return p.pricingModel === "FLAT_FEE" ? "Flat Fee" : "Erfolgsprovision";
    return null;
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-blueprint tracking-tight">Aktivitäten</h1>
        <p className="text-slate-500 mt-1">Vollständiges Protokoll aller Ereignisse Ihrer Immobilien.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {eventTypes.map((type) => {
          const meta = type === "ALL" ? { label: "Alle", icon: "", color: "" } : (EVENT_META[type] || DEFAULT_META);
          return (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                filter === type
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              {type === "ALL" ? "Alle" : meta.label}
              {type !== "ALL" && (
                <span className="ml-1.5 text-[10px] opacity-60">
                  {events.filter((e) => e.type === type).length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
          <span className="material-symbols-outlined text-4xl text-slate-300 mb-3 block">history</span>
          <h2 className="text-xl font-black text-blueprint mb-2">Noch keine Aktivitäten</h2>
          <p className="text-slate-500 text-sm">Ereignisse erscheinen hier, sobald Inserate erstellt und Anfragen eingehen.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {filtered.map((event, idx) => {
            const meta = EVENT_META[event.type] || DEFAULT_META;
            const detail = getDetail(event);
            const p = event.listing.property;
            const isLast = idx === filtered.length - 1;
            return (
              <div
                key={event.id}
                onClick={() => router.push(`/dashboard/listings/${event.listing.id}`)}
                className={`flex items-start gap-4 p-5 cursor-pointer hover:bg-slate-50/50 transition-colors ${!isLast ? "border-b border-slate-100" : ""}`}
              >
                {/* Timeline dot */}
                <div className="flex flex-col items-center pt-0.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${meta.color}`}>
                    <span className="material-symbols-outlined text-lg">{meta.icon}</span>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-blueprint">{meta.label}</span>
                    {detail && (
                      <span className="text-xs font-bold text-primary">{detail}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {p.street} {p.houseNumber}, {p.city}
                  </p>
                </div>

                {/* Timestamp */}
                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-bold text-slate-500">{formatDate(event.createdAt)}</div>
                  <div className="text-[10px] text-slate-400">{formatTime(event.createdAt)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
