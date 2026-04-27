"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ListingItem {
  id: string;
  status: string;
  slug: string;
  titleShort: string | null;
  askingPrice: string | null;
  createdAt: string;
  property: {
    id: string;
    street: string;
    houseNumber: string;
    city: string;
    postcode: string;
    type: string;
    livingArea: number;
    rooms: number | null;
  };
  _count: { leads: number; offers: number };
}

const STATUS_DE: Record<string, string> = {
  DRAFT: "Entwurf",
  REVIEW: "Prüfung",
  ACTIVE: "Aktiv",
  PAUSED: "Pausiert",
  RESERVED: "Reserviert",
  CLOSED: "Abgeschlossen",
  WITHDRAWN: "Zurückgezogen",
};

export default function ListingsPage() {
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    fetch("/api/listings")
      .then((r) => r.json())
      .then((data) => setListings(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === "ALL" ? listings : listings.filter((l) => l.status === filter);

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-blueprint tracking-tight">Inserate</h1>
          <p className="text-slate-500 mt-1">Ihre aktiven, entworfenen und abgeschlossenen Inserate.</p>
        </div>
        <Link
          href="/dashboard/properties/new"
          className="bg-primary hover:bg-primary-dark text-white px-5 py-3 rounded-xl text-sm font-black uppercase tracking-[0.18em] transition-all duration-300 hover:scale-[1.02] flex items-center gap-2 shadow-lg shadow-primary/25"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Neues Inserat
        </Link>
      </div>

      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {[
          { key: "ALL", label: "Alle" },
          { key: "DRAFT", label: "Entwurf" },
          { key: "ACTIVE", label: "Aktiv" },
          { key: "PAUSED", label: "Pausiert" },
          { key: "CLOSED", label: "Abgeschlossen" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-[0.15em] transition-colors ${
              filter === tab.key
                ? "bg-blueprint text-white"
                : "bg-white border border-slate-200 text-slate-500 hover:text-blueprint hover:border-slate-300"
            }`}
          >
            {tab.label}
            {tab.key !== "ALL" && (
              <span className="ml-1.5 opacity-60">
                {listings.filter((l) => l.status === tab.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
          <div className="w-20 h-20 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-4xl">description</span>
          </div>
          <h2 className="text-xl font-black text-blueprint mb-2">
            {filter === "ALL" ? "Noch keine Inserate" : `Keine ${STATUS_DE[filter] || filter}-Inserate`}
          </h2>
          <p className="text-slate-500 max-w-md mx-auto mb-8">
            Erstellen Sie zuerst eine Immobilie, dann generieren Sie ein KI-gestütztes Inserat.
          </p>
          <Link
            href="/dashboard/properties/new"
            className="inline-flex bg-blueprint hover:bg-primary text-white px-6 py-3 rounded-xl text-sm font-black uppercase tracking-[0.18em] transition-colors"
          >
            Erstes Inserat erstellen
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((l) => (
            <Link
              key={l.id}
              href={`/dashboard/listings/${l.id}`}
              className="block bg-white rounded-2xl border border-slate-200 p-6 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                      l.status === "ACTIVE" ? "bg-emerald-50 text-emerald-600"
                      : l.status === "DRAFT" ? "bg-amber-50 text-amber-600"
                      : "bg-slate-100 text-slate-500"
                    }`}>{STATUS_DE[l.status] || l.status}</span>
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">{l.property.type}</span>
                  </div>
                  <h3 className="font-black text-blueprint text-lg truncate">
                    {l.titleShort || `${l.property.street} ${l.property.houseNumber}`}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {l.property.postcode} {l.property.city} · {l.property.livingArea} m²
                    {l.property.rooms ? ` · ${l.property.rooms} Zi.` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-8 ml-6">
                  {l.askingPrice && (
                    <div className="text-right">
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Preis</div>
                      <div className="font-black text-blueprint">
                        €{Number(l.askingPrice).toLocaleString("de-DE")}
                      </div>
                    </div>
                  )}
                  <div className="text-right">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Interessenten</div>
                    <div className="font-black text-blueprint">{l._count.leads}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Angebote</div>
                    <div className="font-black text-blueprint">{l._count.offers}</div>
                  </div>
                  <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
