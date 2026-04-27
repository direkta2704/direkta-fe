"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
  energyCert: { energyClass: string } | null;
  media: { id: string }[];
  listings: { id: string; status: string }[];
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
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/properties")
      .then((r) => r.json())
      .then((data) => setProperties(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

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
            <Link
              key={p.id}
              href={`/dashboard/properties/${p.id}`}
              className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all group"
            >
              <div className="w-full h-36 rounded-xl bg-slate-100 flex items-center justify-center mb-4 overflow-hidden">
                <span className="material-symbols-outlined text-3xl text-slate-300">
                  {p.media.length > 0 ? "image" : "add_photo_alternate"}
                </span>
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
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100 text-xs text-slate-400">
                <span>{p.livingArea} m²</span>
                {p.rooms && <span>{p.rooms} Zi.</span>}
                {p.energyCert && <span className="text-primary font-bold">{p.energyCert.energyClass}</span>}
              </div>
            </Link>
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
    </>
  );
}
