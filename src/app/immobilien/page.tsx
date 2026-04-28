import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import ListingsFilter from "./listings-filter";

export const metadata: Metadata = {
  title: "Immobilien kaufen — Direkta",
  description: "Finden Sie Ihre Traumimmobilie. Alle Inserate direkt vom Eigentuemer — ohne Maklerprovision.",
};

export const dynamic = "force-dynamic";

const TYPE_DE: Record<string, string> = {
  ETW: "Wohnung", EFH: "Einfamilienhaus", MFH: "Mehrfamilienhaus",
  DHH: "Doppelhaushaelfte", RH: "Reihenhaus", GRUNDSTUECK: "Grundstueck",
};

export default async function ListingsBrowsePage() {
  const listings = await prisma.listing.findMany({
    where: { status: "ACTIVE" },
    include: {
      property: {
        select: {
          type: true, street: true, houseNumber: true, postcode: true, city: true,
          livingArea: true, plotArea: true, rooms: true, bathrooms: true, yearBuilt: true, condition: true,
          energyCert: { select: { energyClass: true } },
          media: { where: { kind: "PHOTO" }, orderBy: { ordering: "asc" }, take: 1, select: { storageKey: true } },
        },
      },
    },
    orderBy: { publishedAt: "desc" },
  });

  const cities = [...new Set(listings.map((l) => l.property.city))].sort();
  const types = [...new Set(listings.map((l) => l.property.type))].sort();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <header className="border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="material-symbols-outlined text-2xl text-primary">home_work</span>
            <span className="text-lg font-black tracking-tight">DIREKTA<span className="text-primary">.</span></span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="hidden sm:block text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 hover:text-primary transition-colors">
              Startseite
            </Link>
            <Link
              href="/#cta"
              className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-[0.18em] transition-all hover:scale-[1.03] flex items-center gap-1.5"
            >
              Immobilie verkaufen
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero banner */}
      <div className="bg-blueprint relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(236,91,19,0.3) 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        </div>
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-20 relative">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/20 px-4 py-1.5 text-primary mb-6">
              <span className="material-symbols-outlined text-sm">verified</span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">100% Provisionsfrei</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight mb-4">
              Immobilien entdecken
            </h1>
            <p className="text-lg text-white/70 leading-relaxed">
              Alle Inserate direkt vom Eigentuemer — ohne Maklerprovision.
              Sparen Sie tausende Euro beim Immobilienkauf.
            </p>
            <div className="flex items-center gap-6 mt-8">
              <div className="text-center">
                <div className="text-3xl font-black text-primary">{listings.length}</div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Inserate</div>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div className="text-center">
                <div className="text-3xl font-black text-primary">{cities.length}</div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Staedte</div>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div className="text-center">
                <div className="text-3xl font-black text-white">0%</div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Provision</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 py-10">
        <ListingsFilter
          listings={listings.map((l) => ({
            id: l.id,
            slug: l.slug,
            titleShort: l.titleShort,
            askingPrice: l.askingPrice ? String(l.askingPrice) : null,
            publishedAt: l.publishedAt?.toISOString() || null,
            property: {
              type: l.property.type,
              street: l.property.street,
              houseNumber: l.property.houseNumber,
              postcode: l.property.postcode,
              city: l.property.city,
              livingArea: l.property.livingArea,
              rooms: l.property.rooms,
              bathrooms: l.property.bathrooms,
              yearBuilt: l.property.yearBuilt,
              photo: l.property.media[0]?.storageKey || null,
              energyClass: l.property.energyCert?.energyClass || null,
            },
          }))}
          cities={cities}
          types={types.map((t) => ({ value: t, label: TYPE_DE[t] || t }))}
        />
      </div>

      {/* Seller CTA */}
      <div className="bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="bg-blueprint rounded-3xl p-10 md:p-16 relative overflow-hidden">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
            </div>
            <div className="absolute -top-20 -right-20 w-80 h-80 bg-primary/20 rounded-full blur-[100px]" />
            <div className="relative text-center max-w-xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-4">
                Auch Ihre Immobilie verkaufen?
              </h2>
              <p className="text-white/70 mb-8 leading-relaxed">
                Erstellen Sie Ihr Inserat in 15 Minuten. KI-generierte Beschreibung,
                automatische Preisempfehlung, qualifizierte Kaeufer — ohne Maklerprovision.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/#cta"
                  className="bg-primary hover:bg-primary-dark text-white px-8 py-4 rounded-full text-sm font-black uppercase tracking-[0.18em] transition-all hover:scale-[1.03] shadow-xl shadow-primary/30 flex items-center gap-2"
                >
                  Jetzt Preis erfahren
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </Link>
                <Link
                  href="/"
                  className="text-white/70 hover:text-white text-sm font-bold transition-colors"
                >
                  Mehr erfahren
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-slate-400">© 2026 Direkta GmbH · Deutschland</p>
          <div className="flex items-center gap-6 text-xs text-slate-400">
            <Link href="/impressum" className="hover:text-blueprint transition-colors">Impressum</Link>
            <Link href="/datenschutz" className="hover:text-blueprint transition-colors">Datenschutz</Link>
            <Link href="/agb" className="hover:text-blueprint transition-colors">AGB</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
