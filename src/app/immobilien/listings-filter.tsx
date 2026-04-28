"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

interface ListingItem {
  id: string;
  slug: string;
  titleShort: string | null;
  askingPrice: string | null;
  publishedAt: string | null;
  property: {
    type: string;
    street: string;
    houseNumber: string;
    postcode: string;
    city: string;
    livingArea: number;
    rooms: number | null;
    bathrooms: number | null;
    yearBuilt: number | null;
    photo: string | null;
    energyClass: string | null;
  };
}

interface Props {
  listings: ListingItem[];
  cities: string[];
  types: { value: string; label: string }[];
}

type SortKey = "newest" | "price-asc" | "price-desc" | "size-desc";

export default function ListingsFilter({ listings, cities, types }: Props) {
  const [city, setCity] = useState("");
  const [type, setType] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minRooms, setMinRooms] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");

  let filtered = listings.filter((l) => {
    if (city && l.property.city !== city) return false;
    if (type && l.property.type !== type) return false;
    if (maxPrice && l.askingPrice && Number(l.askingPrice) > Number(maxPrice)) return false;
    if (minRooms && l.property.rooms && l.property.rooms < Number(minRooms)) return false;
    return true;
  });

  filtered.sort((a, b) => {
    switch (sort) {
      case "price-asc": return (Number(a.askingPrice) || 0) - (Number(b.askingPrice) || 0);
      case "price-desc": return (Number(b.askingPrice) || 0) - (Number(a.askingPrice) || 0);
      case "size-desc": return b.property.livingArea - a.property.livingArea;
      default: return (new Date(b.publishedAt || 0).getTime()) - (new Date(a.publishedAt || 0).getTime());
    }
  });

  const hasFilters = city || type || maxPrice || minRooms;

  return (
    <>
      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-8 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5">Stadt</label>
            <select value={city} onChange={(e) => setCity(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-blueprint outline-none focus:border-primary transition-colors">
              <option value="">Alle Staedte</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5">Immobilientyp</label>
            <select value={type} onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-blueprint outline-none focus:border-primary transition-colors">
              <option value="">Alle Typen</option>
              {types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5">Max. Preis</label>
            <select value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-blueprint outline-none focus:border-primary transition-colors">
              <option value="">Kein Limit</option>
              <option value="200000">bis 200.000 EUR</option>
              <option value="400000">bis 400.000 EUR</option>
              <option value="600000">bis 600.000 EUR</option>
              <option value="800000">bis 800.000 EUR</option>
              <option value="1000000">bis 1.000.000 EUR</option>
              <option value="1500000">bis 1.500.000 EUR</option>
            </select>
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5">Min. Zimmer</label>
            <select value={minRooms} onChange={(e) => setMinRooms(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-blueprint outline-none focus:border-primary transition-colors">
              <option value="">Beliebig</option>
              <option value="1">1+</option>
              <option value="2">2+</option>
              <option value="3">3+</option>
              <option value="4">4+</option>
              <option value="5">5+</option>
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5">Sortieren</label>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-blueprint outline-none focus:border-primary transition-colors">
              <option value="newest">Neueste zuerst</option>
              <option value="price-asc">Preis aufsteigend</option>
              <option value="price-desc">Preis absteigend</option>
              <option value="size-desc">Groesste zuerst</option>
            </select>
          </div>
          {hasFilters && (
            <button
              onClick={() => { setCity(""); setType(""); setMaxPrice(""); setMinRooms(""); }}
              className="px-4 py-2.5 text-xs font-bold text-primary hover:text-primary-dark transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">close</span>
              Zuruecksetzen
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-slate-500">
          <span className="font-black text-blueprint">{filtered.length}</span> Immobilie{filtered.length !== 1 ? "n" : ""} gefunden
          {hasFilters && <span className="text-primary ml-1">(gefiltert)</span>}
        </p>
      </div>

      {/* Listing grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
          <span className="material-symbols-outlined text-5xl text-slate-300 mb-4 block">search_off</span>
          <h2 className="text-xl font-black text-blueprint mb-2">Keine Ergebnisse</h2>
          <p className="text-slate-500 max-w-md mx-auto mb-6">
            {hasFilters
              ? "Keine Immobilien entsprechen Ihren Filterkriterien. Passen Sie die Filter an."
              : "Aktuell sind keine Immobilien inseriert. Schauen Sie bald wieder vorbei."}
          </p>
          {hasFilters && (
            <button
              onClick={() => { setCity(""); setType(""); setMaxPrice(""); setMinRooms(""); }}
              className="bg-blueprint hover:bg-primary text-white px-6 py-3 rounded-xl text-sm font-black uppercase tracking-[0.18em] transition-colors"
            >
              Filter zuruecksetzen
            </button>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((l) => {
            const pr = l.property;
            const price = l.askingPrice ? Number(l.askingPrice) : null;

            return (
              <Link
                key={l.id}
                href={`/immobilien/${l.slug}`}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:shadow-primary/10 hover:border-primary/30 transition-all group"
              >
                {/* Photo */}
                <div className="relative aspect-[16/10] bg-slate-100">
                  {pr.photo ? (
                    <Image src={pr.photo} alt={`${pr.street} ${pr.houseNumber}`} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="(max-width: 768px) 100vw, 33vw" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="material-symbols-outlined text-4xl text-slate-300">home_work</span>
                    </div>
                  )}
                  {/* Price badge */}
                  {price && (
                    <div className="absolute bottom-3 left-3 bg-blueprint/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg font-black text-lg">
                      EUR {price.toLocaleString("de-DE")}
                    </div>
                  )}
                  {/* Type badge */}
                  <div className="absolute top-3 left-3 bg-primary text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest">
                    {types.find((t) => t.value === pr.type)?.label || pr.type}
                  </div>
                  {/* Provisionsfrei badge */}
                  <div className="absolute top-3 right-3 bg-emerald-500 text-white text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-widest">
                    Provisionsfrei
                  </div>
                </div>

                {/* Info */}
                <div className="p-5">
                  <h3 className="font-black text-blueprint text-lg group-hover:text-primary transition-colors truncate leading-tight">
                    {l.titleShort || `${pr.street} ${pr.houseNumber}`}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-slate-400">location_on</span>
                    {pr.postcode} {pr.city}
                  </p>

                  <div className="flex items-center gap-5 mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-primary">straighten</span>
                      {pr.livingArea} m²
                    </span>
                    {pr.rooms && (
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-primary">meeting_room</span>
                        {pr.rooms} Zi.
                      </span>
                    )}
                    {pr.bathrooms && (
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-primary">bathtub</span>
                        {pr.bathrooms}
                      </span>
                    )}
                    {pr.energyClass && (
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-primary">bolt</span>
                        {pr.energyClass}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
