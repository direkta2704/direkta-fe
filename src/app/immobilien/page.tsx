import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Immobilien kaufen — Direkta",
  description: "Finden Sie Ihre Traumimmobilie. Alle aktuellen Inserate direkt vom Eigentümer — ohne Maklerprovision.",
};

const TYPE_DE: Record<string, string> = {
  ETW: "Wohnung", EFH: "Einfamilienhaus", MFH: "Mehrfamilienhaus",
  DHH: "Doppelhaushälfte", RH: "Reihenhaus", GRUNDSTUECK: "Grundstück",
};

export const dynamic = "force-dynamic";

export default async function ListingsBrowsePage() {
  const listings = await prisma.listing.findMany({
    where: { status: "ACTIVE" },
    include: {
      property: {
        select: {
          type: true, street: true, houseNumber: true, postcode: true, city: true,
          livingArea: true, rooms: true, bathrooms: true, yearBuilt: true, condition: true,
          energyCert: { select: { energyClass: true } },
          media: { where: { kind: "PHOTO" }, orderBy: { ordering: "asc" }, take: 1, select: { storageKey: true } },
        },
      },
    },
    orderBy: { publishedAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <header className="border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="material-symbols-outlined text-2xl text-primary">home_work</span>
            <span className="text-lg font-black tracking-tight">DIREKTA<span className="text-primary">.</span></span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 hover:text-primary transition-colors">
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

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-4xl font-black text-blueprint tracking-tight">
            Aktuelle Immobilien
          </h1>
          <p className="text-lg text-slate-500 mt-2">
            Alle Inserate direkt vom Eigentümer — ohne Maklerprovision.
          </p>
        </div>

        {listings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
            <span className="material-symbols-outlined text-5xl text-slate-300 mb-4 block">search</span>
            <h2 className="text-xl font-black text-blueprint mb-2">Noch keine Inserate verfügbar</h2>
            <p className="text-slate-500 max-w-md mx-auto mb-6">
              Aktuell sind keine Immobilien inseriert. Schauen Sie bald wieder vorbei.
            </p>
            <Link
              href="/"
              className="inline-flex bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl text-sm font-black uppercase tracking-[0.18em] transition-all items-center gap-2"
            >
              Eigene Immobilie verkaufen
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((l) => {
              const p = l.property;
              const photo = p.media[0];
              const price = l.askingPrice ? Number(l.askingPrice) : null;

              return (
                <Link
                  key={l.id}
                  href={`/immobilien/${l.slug}`}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:shadow-primary/10 hover:border-primary/30 transition-all group"
                >
                  {/* Photo */}
                  <div className="relative aspect-[16/10] bg-slate-100">
                    {photo ? (
                      <Image src={photo.storageKey} alt={`${p.street} ${p.houseNumber}`} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="(max-width: 768px) 100vw, 33vw" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-4xl text-slate-300">home_work</span>
                      </div>
                    )}
                    {price && (
                      <div className="absolute bottom-3 left-3 bg-blueprint/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg font-black text-lg">
                        €{price.toLocaleString("de-DE")}
                      </div>
                    )}
                    <div className="absolute top-3 left-3 bg-primary text-white text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-widest">
                      {TYPE_DE[p.type] || p.type}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-5">
                    <h3 className="font-black text-blueprint text-lg group-hover:text-primary transition-colors truncate">
                      {l.titleShort || `${p.street} ${p.houseNumber}`}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      {p.postcode} {p.city}
                    </p>

                    <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm text-primary">straighten</span>
                        {p.livingArea} m²
                      </span>
                      {p.rooms && (
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm text-primary">meeting_room</span>
                          {p.rooms} Zi.
                        </span>
                      )}
                      {p.bathrooms && (
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm text-primary">bathtub</span>
                          {p.bathrooms}
                        </span>
                      )}
                      {p.energyCert && (
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm text-primary">bolt</span>
                          {p.energyCert.energyClass}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 px-6 mt-12">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-slate-400">© 2026 Direkta GmbH · Deutschland</p>
          <div className="flex items-center gap-6 text-xs text-slate-400">
            <a href="#" className="hover:text-blueprint transition-colors">Impressum</a>
            <a href="#" className="hover:text-blueprint transition-colors">Datenschutz</a>
            <a href="#" className="hover:text-blueprint transition-colors">AGB</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
