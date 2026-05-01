"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ListingItem {
  id: string;
  status: string;
  slug: string;
  titleShort: string | null;
  askingPrice: string | null;
  createdAt: string;
  publishedAt: string | null;
  property: {
    id: string;
    street: string;
    houseNumber: string;
    city: string;
    postcode: string;
    type: string;
    livingArea: number;
    rooms: number | null;
    media?: { storageKey: string }[];
  };
  syndicationTargets?: { portal: string; status: string; externalUrl: string | null }[];
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

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-600",
  DRAFT: "bg-amber-50 text-amber-600",
  REVIEW: "bg-blue-50 text-blue-600",
  RESERVED: "bg-violet-50 text-violet-600",
  CLOSED: "bg-slate-100 text-slate-600",
  PAUSED: "bg-orange-50 text-orange-600",
  WITHDRAWN: "bg-slate-100 text-slate-500",
};

function daysOnMarket(publishedAt: string | null, createdAt: string): number {
  const start = publishedAt ? new Date(publishedAt) : new Date(createdAt);
  return Math.floor((Date.now() - start.getTime()) / 86400000);
}

function commissionSaved(price: number): number {
  return Math.round(price * 0.0357);
}

export default function ListingsPage() {
  const router = useRouter();
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "price" | "leads">("date");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  function toggleSelect(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const deletable = filtered.filter((l) => l.status !== "ACTIVE");
    if (selected.size === deletable.length) setSelected(new Set());
    else setSelected(new Set(deletable.map((l) => l.id)));
  }

  async function deleteSelected() {
    if (!confirm(`${selected.size} Inserat(e) wirklich löschen?`)) return;
    setDeleting(true);
    for (const id of selected) await fetch(`/api/listings/${id}`, { method: "DELETE" });
    setSelected(new Set());
    await reload();
    setDeleting(false);
  }

  async function bulkAction(action: string) {
    if (!confirm(`${selected.size} Inserat(e) ${action === "ACTIVE" ? "veröffentlichen" : action === "PAUSED" ? "pausieren" : "zurückziehen"}?`)) return;
    for (const id of selected) {
      await fetch(`/api/listings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: action }) });
    }
    setSelected(new Set());
    await reload();
  }

  async function reload() {
    const res = await fetch("/api/listings");
    const data = await res.json();
    setListings(Array.isArray(data) ? data : []);
  }

  async function quickAction(id: string, action: string) {
    setMenuOpen(null);
    if (action === "delete") {
      if (!confirm("Inserat wirklich löschen?")) return;
      await fetch(`/api/listings/${id}`, { method: "DELETE" });
      await reload();
    } else if (action === "duplicate") {
      const res = await fetch(`/api/listings/${id}/duplicate`, { method: "POST" });
      if (res.ok) await reload();
      else alert("Duplizieren fehlgeschlagen");
    } else if (action === "pause" || action === "activate" || action === "withdraw" || action === "reactivate") {
      const status = action === "pause" ? "PAUSED" : action === "withdraw" ? "WITHDRAWN" : "ACTIVE";
      await fetch(`/api/listings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      await reload();
    } else if (action === "share") {
      const listing = listings.find((l) => l.id === id);
      if (listing) {
        const url = `${window.location.origin}/immobilien/${listing.slug}`;
        if (navigator.share) navigator.share({ title: listing.titleShort || "", url });
        else { navigator.clipboard.writeText(url); alert("Link kopiert!"); }
      }
    }
  }

  useEffect(() => {
    fetch("/api/listings")
      .then((r) => r.json())
      .then((data) => setListings(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  // Filter + search
  let filtered = filter === "ALL" ? listings : listings.filter((l) => l.status === filter);
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter((l) =>
      (l.titleShort || "").toLowerCase().includes(q) ||
      l.property.street.toLowerCase().includes(q) ||
      l.property.city.toLowerCase().includes(q)
    );
  }

  // Sort
  filtered = [...filtered].sort((a, b) => {
    if (sortBy === "price") return (Number(b.askingPrice) || 0) - (Number(a.askingPrice) || 0);
    if (sortBy === "leads") return (b._count.leads + b._count.offers) - (a._count.leads + a._count.offers);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-blueprint tracking-tight">Inserate</h1>
          <p className="text-slate-500 mt-1">Ihre aktiven, entworfenen und abgeschlossenen Inserate.</p>
        </div>
        <Link
          href="/dashboard/properties/new"
          className="bg-primary hover:bg-primary-dark text-white px-5 py-3 rounded-xl text-sm font-black uppercase tracking-[0.18em] transition-all hover:scale-[1.02] flex items-center gap-2 shadow-lg shadow-primary/25"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Neues Inserat
        </Link>
      </div>

      {/* Filter tabs + search + sort */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { key: "ALL", label: "Alle" },
            { key: "DRAFT", label: "Entwurf" },
            { key: "ACTIVE", label: "Aktiv" },
            { key: "PAUSED", label: "Pausiert" },
            { key: "CLOSED", label: "Abgeschlossen" },
            { key: "WITHDRAWN", label: "Zurückgezogen" },
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
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-sm">search</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suchen..."
              className="pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 w-48"
            />
          </div>
          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "date" | "price" | "leads")}
            className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-500 outline-none"
          >
            <option value="date">Neueste zuerst</option>
            <option value="price">Preis (hoch → niedrig)</option>
            <option value="leads">Meiste Anfragen</option>
          </select>
        </div>
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
            {filter === "ALL" && !search ? "Noch keine Inserate" : "Keine Ergebnisse"}
          </h2>
          <p className="text-slate-500 max-w-md mx-auto mb-8">
            {search ? "Keine Inserate gefunden für diese Suche." : "Erstellen Sie zuerst eine Immobilie, dann generieren Sie ein KI-gestütztes Inserat."}
          </p>
        </div>
      ) : (
        <>
        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="mb-4 flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-5 py-3">
            <div className="flex items-center gap-3">
              <button onClick={toggleAll} className="text-xs font-bold text-blueprint hover:text-primary">
                {selected.size === filtered.filter((l) => l.status !== "ACTIVE").length ? "Alle abwählen" : "Alle wählen"}
              </button>
              <span className="text-sm font-bold text-blueprint">{selected.size} ausgewählt</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => bulkAction("ACTIVE")} className="px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100">Aktivieren</button>
              <button onClick={() => bulkAction("PAUSED")} className="px-3 py-1.5 rounded-lg text-xs font-bold text-amber-600 bg-amber-50 hover:bg-amber-100">Pausieren</button>
              <button onClick={deleteSelected} disabled={deleting} className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-60">
                {deleting ? "Löschen..." : "Löschen"}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {filtered.map((l) => {
            const thumb = l.property.media?.[0]?.storageKey;
            const is24 = l.syndicationTargets?.[0];
            const days = daysOnMarket(l.publishedAt, l.createdAt);
            const saved = l.status === "CLOSED" && l.askingPrice ? commissionSaved(Number(l.askingPrice)) : 0;

            return (
              <div key={l.id} className="flex items-center gap-3">
                {/* Checkbox */}
                {l.status !== "ACTIVE" ? (
                  <button
                    onClick={(e) => toggleSelect(l.id, e)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      selected.has(l.id) ? "bg-primary border-primary text-white" : "border-slate-300 hover:border-primary"
                    }`}
                  >
                    {selected.has(l.id) && <span className="material-symbols-outlined text-xs">check</span>}
                  </button>
                ) : <div className="w-5" />}

                {/* Listing card */}
                <Link
                  href={`/dashboard/listings/${l.id}`}
                  className="flex-1 block bg-white rounded-2xl border border-slate-200 p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all"
                >
                  <div className="flex items-center gap-4">
                    {/* Thumbnail */}
                    {thumb ? (
                      <img src={thumb} alt="" className="w-20 h-14 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-20 h-14 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-2xl text-slate-300">home</span>
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full ${STATUS_COLOR[l.status] || "bg-slate-100 text-slate-500"}`}>
                          {STATUS_DE[l.status] || l.status}
                        </span>
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">{l.property.type}</span>
                        {is24?.status === "LIVE" && (
                          <span className="text-[10px] font-bold text-[#ff7500] bg-[#ff7500]/10 px-2 py-0.5 rounded">IS24</span>
                        )}
                        {saved > 0 && (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                            €{saved.toLocaleString("de-DE")} gespart
                          </span>
                        )}
                      </div>
                      <h3 className="font-black text-blueprint truncate">
                        {l.titleShort || `${l.property.street} ${l.property.houseNumber}`}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                        <span>{l.property.postcode} {l.property.city} · {l.property.livingArea} m²{l.property.rooms ? ` · ${l.property.rooms} Zi.` : ""}</span>
                        <span>·</span>
                        <span>{days} Tage{l.status === "ACTIVE" ? " online" : ""}</span>
                        <span>·</span>
                        <span>Erstellt {new Date(l.createdAt).toLocaleDateString("de-DE")}</span>
                      </div>
                    </div>

                    {/* Actions + Stats */}
                    <div className="flex items-center gap-5 ml-4 flex-shrink-0">
                      {/* Quick action buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.preventDefault(); window.open(`/api/listings/${l.id}/pdf`, "_blank"); }}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors"
                          title="Exposé PDF"
                        >
                          <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
                        </button>
                        <button
                          onClick={(e) => { e.preventDefault(); quickAction(l.id, "share"); }}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors"
                          title="Teilen"
                        >
                          <span className="material-symbols-outlined text-lg">share</span>
                        </button>
                      </div>

                      {/* Stats */}
                      {l.askingPrice && (
                        <div className="text-right">
                          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Preis</div>
                          <div className="font-black text-blueprint">€{Number(l.askingPrice).toLocaleString("de-DE")}</div>
                        </div>
                      )}
                      <div className="text-right">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Anfragen</div>
                        <div className="font-black text-blueprint">{l._count.leads}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Angebote</div>
                        <div className="font-black text-blueprint">{l._count.offers}</div>
                      </div>

                      {/* Quick menu */}
                      <div className="relative">
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(menuOpen === l.id ? null : l.id); }}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-blueprint hover:bg-slate-100 transition-colors"
                        >
                          <span className="material-symbols-outlined text-lg">more_vert</span>
                        </button>
                        {menuOpen === l.id && (
                          <div
                            onClick={(e) => e.preventDefault()}
                            className="absolute right-0 top-10 w-48 bg-white rounded-xl border border-slate-200 shadow-xl py-1 z-20"
                          >
                            <button onClick={() => { router.push(`/dashboard/listings/${l.id}`); setMenuOpen(null); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
                              <span className="material-symbols-outlined text-base">edit</span>Bearbeiten
                            </button>
                            <button onClick={() => quickAction(l.id, "duplicate")} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
                              <span className="material-symbols-outlined text-base">content_copy</span>Duplizieren
                            </button>
                            {l.status === "ACTIVE" && (
                              <button onClick={() => quickAction(l.id, "pause")} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-amber-600 hover:bg-amber-50">
                                <span className="material-symbols-outlined text-base">pause_circle</span>Pausieren
                              </button>
                            )}
                            {(l.status === "PAUSED" || l.status === "WITHDRAWN" || l.status === "DRAFT") && (
                              <button onClick={() => quickAction(l.id, "activate")} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-emerald-600 hover:bg-emerald-50">
                                <span className="material-symbols-outlined text-base">play_circle</span>Aktivieren
                              </button>
                            )}
                            {l.status === "ACTIVE" && (
                              <button onClick={() => quickAction(l.id, "withdraw")} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
                                <span className="material-symbols-outlined text-base">cancel</span>Zurückziehen
                              </button>
                            )}
                            <div className="border-t border-slate-100 my-1" />
                            {l.status !== "ACTIVE" && (
                              <button onClick={() => quickAction(l.id, "delete")} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50">
                                <span className="material-symbols-outlined text-base">delete</span>Löschen
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
        </>
      )}

      {/* Click outside to close menu */}
      {menuOpen && <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />}
    </>
  );
}
