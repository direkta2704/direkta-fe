"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface PropertyItem {
  id: string;
  type: string;
  street: string;
  houseNumber: string;
  postcode: string;
  city: string;
  livingArea: number;
  rooms: number | null;
  condition: string;
  createdAt: string;
  buildingInfo: Record<string, string> | null;
  energyCert: { energyClass: string } | null;
  media: { id: string; storageKey: string }[];
  listings: { id: string; status: string }[];
  units?: { id: string; listings: { id: string; status: string }[] }[];
  _count?: { units: number };
}

const STATUS_DE: Record<string, string> = {
  ACTIVE: "Aktiv",
  DRAFT: "Entwurf",
  PAUSED: "Pausiert",
  CLOSED: "Abgeschlossen",
  REVIEW: "Prüfung",
  RESERVED: "Reserviert",
  WITHDRAWN: "Zurückgezogen",
};

export default function PropertiesPage() {
  const router = useRouter();
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/properties")
      .then((r) => r.json())
      .then((data) => setProperties(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);


  async function handleDelete(id: string) {
    setDeleting(id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/properties/${id}`, { method: "DELETE" });
      if (res.ok) {
        setConfirmId(null);
        setDeleting(null);
        setTimeout(() => setProperties((prev) => prev.filter((p) => p.id !== id)), 50);
        return;
      } else {
        setDeleteError("Immobilie konnte nicht gelöscht werden. Bitte versuchen Sie es erneut.");
      }
    } catch {
      setDeleteError("Netzwerkfehler. Bitte versuchen Sie es erneut.");
    }
    setDeleting(null);
  }

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-blueprint tracking-tight">Immobilien</h1>
          <p className="text-slate-500 mt-1">Verwalten Sie Ihre Immobilien und deren Details.</p>
        </div>
        <Link
          href="/dashboard/properties/new"
          className="bg-primary hover:bg-primary-dark text-white px-5 py-3 rounded-xl text-sm font-black uppercase tracking-[0.18em] transition-all duration-300 hover:scale-[1.02] flex items-center gap-2 shadow-lg shadow-primary/25"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Immobilie hinzufügen
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : properties.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
          <div className="w-20 h-20 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-4xl">add_home_work</span>
          </div>
          <h2 className="text-xl font-black text-blueprint mb-2">Noch keine Immobilien</h2>
          <p className="text-slate-500 max-w-md mx-auto mb-8">
            Fügen Sie Ihre erste Immobilie hinzu, um loszulegen. Sie benötigen die Adresse, grundlegende Angaben und Ihren Energieausweis.
          </p>
          <Link
            href="/dashboard/properties/new"
            className="inline-flex bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl text-sm font-black uppercase tracking-[0.18em] transition-all items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">add_home</span>
            Immobilie hinzufügen
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {properties.map((p) => (
            <div
              key={p.id}
              onClick={() => router.push(`/dashboard/properties/${p.id}`)}
              className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all group cursor-pointer relative"
            >
              {/* 3-dot menu */}
              <div className="absolute top-4 right-4 z-[11]">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(menuOpen === p.id ? null : p.id);
                  }}
                  className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blueprint hover:border-slate-300 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                >
                  <span className="material-symbols-outlined text-lg">more_vert</span>
                </button>

                {menuOpen === p.id && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-10 w-48 bg-white rounded-xl border border-slate-200 shadow-xl py-1 animate-in fade-in zoom-in-95 duration-150"
                  >
                    <button
                      onClick={() => {
                        router.push(`/dashboard/properties/${p.id}`);
                        setMenuOpen(null);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">edit</span>
                      Bearbeiten
                    </button>
                    {p.listings.length > 0 && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const listing = p.listings[0];
                          const newStatus = listing.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
                          const res = await fetch(`/api/listings/${listing.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ status: newStatus }),
                          });
                          if (res.ok) {
                            setProperties((prev) =>
                              prev.map((prop) =>
                                prop.id === p.id
                                  ? { ...prop, listings: [{ ...listing, status: newStatus }] }
                                  : prop
                              )
                            );
                          }
                          setMenuOpen(null);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        <span className="material-symbols-outlined text-base">
                          {p.listings[0].status === "ACTIVE" ? "pause_circle" : "play_circle"}
                        </span>
                        {p.listings[0].status === "ACTIVE" ? "Deaktivieren" : "Aktivieren"}
                      </button>
                    )}
                    <div className="border-t border-slate-100 my-1" />
                    <button
                      onClick={() => {
                        setConfirmId(p.id);
                        setDeleteError(null);
                        setMenuOpen(null);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                      Löschen
                    </button>
                  </div>
                )}
              </div>

              <div className="w-full h-36 rounded-xl bg-slate-100 flex items-center justify-center mb-4 overflow-hidden relative">
                {p.media.length > 0 ? (
                  <Image
                    src={p.media[0].storageKey}
                    alt={`${p.street} ${p.houseNumber}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  <span className="material-symbols-outlined text-3xl text-slate-300">
                    add_photo_alternate
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded">{p.type}</span>
                {p.listings.length > 0 && (
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                    p.listings[0].status === "ACTIVE" ? "bg-emerald-50 text-emerald-600"
                    : p.listings[0].status === "DRAFT" ? "bg-amber-50 text-amber-600"
                    : "bg-slate-100 text-slate-500"
                  }`}>
                    {STATUS_DE[p.listings[0].status] || p.listings[0].status}
                  </span>
                )}
              </div>
              <h3 className="font-black text-blueprint group-hover:text-primary transition-colors">
                {p.street} {p.houseNumber}
              </h3>
              <p className="text-sm text-slate-500">{p.postcode} {p.city}</p>
              <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">calendar_today</span>
                {new Date(p.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })} · {new Date(p.createdAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100 text-xs text-slate-400">
                <span>{p.livingArea} m²</span>
                {p.rooms && <span>{p.rooms} Zi.</span>}
                {p.energyCert && <span className="text-primary font-bold">{p.energyCert.energyClass}</span>}
                {p._count && p._count.units > 0 && (
                  <span className="ml-auto flex items-center gap-1 text-blueprint font-bold">
                    <span className="material-symbols-outlined text-sm">apartment</span>
                    {p._count.units} WE
                    {(() => {
                      const unitsWithListings = p.units?.filter((u) => u.listings.length > 0).length || 0;
                      const mode = (p.buildingInfo as Record<string, string> | null)?._sellingMode;
                      if (mode === "BUNDLE" || mode === "BOTH") return (
                        <span className="text-[9px] font-black uppercase tracking-widest text-primary ml-1">
                          {mode === "BOTH" ? "Beides" : "Paket"}
                        </span>
                      );
                      if (unitsWithListings > 0) return (
                        <span className="text-[9px] text-slate-400 ml-1">
                          · {unitsWithListings}/{p._count.units} Inserate
                        </span>
                      );
                      return null;
                    })()}
                  </span>
                )}
              </div>
            </div>
          ))}
          <Link
            href="/dashboard/properties/new"
            className="bg-white rounded-2xl border-2 border-dashed border-slate-200 hover:border-primary/40 p-6 flex flex-col items-center justify-center min-h-[280px] transition-colors group"
          >
            <span className="material-symbols-outlined text-3xl text-slate-300 group-hover:text-primary transition-colors mb-2">add_circle</span>
            <span className="text-sm font-bold text-slate-400 group-hover:text-blueprint transition-colors">Weitere Immobilie hinzufügen</span>
          </Link>
        </div>
      )}

      {menuOpen && (
        <div className="fixed inset-0 z-[9]" onClick={() => setMenuOpen(null)} />
      )}

      {/* Delete Confirmation Modal */}
      {confirmId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="fixed inset-0 bg-blueprint/60 backdrop-blur-sm" onClick={() => { setConfirmId(null); setDeleteError(null); }} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-2xl text-red-500">delete_forever</span>
            </div>
            <h3 className="text-lg font-black text-blueprint text-center mb-2">
              Immobilie löschen?
            </h3>
            <p className="text-sm text-slate-500 text-center mb-6">
              {(() => {
                const prop = properties.find((x) => x.id === confirmId);
                const unitCount = prop?._count?.units || 0;
                return (
                  <>
                    <span className="font-bold text-blueprint">{prop?.street} {prop?.houseNumber}</span> wird unwiderruflich gelöscht
                    {unitCount > 0 && <>, einschließlich {unitCount} Wohneinheit{unitCount > 1 ? "en" : ""}</>}.
                  </>
                );
              })()}
            </p>
            {deleteError && (
              <p className="text-sm text-red-500 text-center mb-4 bg-red-50 rounded-lg px-3 py-2">{deleteError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setConfirmId(null); setDeleteError(null); }}
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleDelete(confirmId)}
                disabled={deleting === confirmId}
                className="flex-1 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-black uppercase tracking-[0.1em] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {deleting === confirmId ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">delete</span>
                    Löschen
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
