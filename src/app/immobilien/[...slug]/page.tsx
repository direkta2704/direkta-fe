import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import EnquiryForm from "./enquiry-form";
import OfferForm from "./offer-form";
import BookingWidget from "./booking-widget";
import ShareButtons from "./share-buttons";
import PhotoGallery from "./photo-gallery";

interface Props {
  params: Promise<{ slug: string[] }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const listing = await prisma.listing.findFirst({
    where: { slug: slug.join("/"), status: "ACTIVE" },
    include: { property: true },
  });
  if (!listing) return { title: "Inserat nicht gefunden" };
  const p = listing.property;
  return {
    title: listing.titleShort || `${p.street} ${p.houseNumber}, ${p.city} — Direkta`,
    description: listing.descriptionLong?.substring(0, 160) || `Immobilie in ${p.city}`,
    openGraph: {
      title: listing.titleShort || `${p.street} ${p.houseNumber}, ${p.city}`,
      description: listing.descriptionLong?.substring(0, 160) || "",
      type: "website",
    },
  };
}

export default async function PublicListingPage({ params }: Props) {
  const { slug } = await params;
  const fullSlug = slug.join("/");

  const listing = await prisma.listing.findFirst({
    where: { slug: fullSlug, status: "ACTIVE" },
    include: {
      property: {
        include: {
          energyCert: true,
          media: { orderBy: { ordering: "asc" } },
        },
      },
    },
  });
  if (!listing) notFound();

  // Fetch similar listings
  const similar = await prisma.listing.findMany({
    where: { status: "ACTIVE", id: { not: listing.id } },
    include: {
      property: {
        select: {
          type: true, street: true, houseNumber: true, postcode: true, city: true,
          livingArea: true, rooms: true,
          energyCert: { select: { energyClass: true } },
          media: { where: { kind: "PHOTO" }, orderBy: { ordering: "asc" }, take: 1, select: { storageKey: true } },
        },
      },
    },
    take: 3,
    orderBy: { publishedAt: "desc" },
  });

  const p = listing.property;
  const photos = p.media.filter((m) => m.kind === "PHOTO");
  const floorplans = p.media.filter((m) => m.kind === "FLOORPLAN");
  const price = listing.askingPrice ? Number(listing.askingPrice) : null;

  const TYPE_DE: Record<string, string> = {
    ETW: "Eigentumswohnung", EFH: "Einfamilienhaus", MFH: "Mehrfamilienhaus",
    DHH: "Doppelhaushaelfte", RH: "Reihenhaus", GRUNDSTUECK: "Grundstueck",
  };
  const COND_DE: Record<string, string> = {
    ERSTBEZUG: "Erstbezug", NEUBAU: "Neubau", GEPFLEGT: "Gepflegt",
    RENOVIERUNGS_BEDUERFTIG: "Renovierungsbedarf", SANIERUNGS_BEDUERFTIG: "Sanierungsbedarf", ROHBAU: "Rohbau", KERNSANIERT: "Kernsaniert",
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <header className="border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="material-symbols-outlined text-2xl text-primary">home_work</span>
            <span className="text-lg font-black tracking-tight">DIREKTA<span className="text-primary">.</span></span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/immobilien" className="hidden sm:block text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 hover:text-primary transition-colors">
              Alle Inserate
            </Link>
            <a href="#anfrage" className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-[0.18em] transition-all hover:scale-[1.03] flex items-center gap-1.5">
              Anfrage senden
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </a>
          </div>
        </div>
      </header>

      {/* Breadcrumbs */}
      <div className="max-w-6xl mx-auto px-6 pt-4">
        <nav className="flex items-center gap-2 text-xs text-slate-400">
          <Link href="/immobilien" className="hover:text-primary transition-colors">Inserate</Link>
          <span>/</span>
          <span className="text-slate-500">{p.city}</span>
          <span>/</span>
          <span className="text-slate-600 truncate max-w-[200px]">{listing.titleShort || `${p.street} ${p.houseNumber}`}</span>
        </nav>
      </div>

      {/* Photo gallery with lightbox */}
      <PhotoGallery photos={photos.map((ph) => ({ id: ph.id, storageKey: ph.storageKey }))} />

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid lg:grid-cols-3 gap-10">
          {/* ═══ Main content ═══ */}
          <div className="lg:col-span-2 space-y-10">

            {/* Header + Price + Share */}
            <div>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1">
                  {/* Provisionsfrei badge */}
                  <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest mb-4">
                    <span className="material-symbols-outlined text-sm">verified</span>
                    Provisionsfrei
                  </div>

                  {price && (
                    <div className="text-4xl font-black text-primary mb-3">
                      EUR {price.toLocaleString("de-DE")}
                    </div>
                  )}
                  <h1 className="text-2xl md:text-3xl font-black text-blueprint tracking-tight">
                    {listing.titleShort || `${p.street} ${p.houseNumber}`}
                  </h1>
                  <p className="text-slate-500 mt-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-slate-400">location_on</span>
                    {p.street} {p.houseNumber}, {p.postcode} {p.city}
                  </p>
                </div>
              </div>

              {/* Share buttons */}
              <ShareButtons
                title={listing.titleShort || `${p.street} ${p.houseNumber}, ${p.city}`}
                price={price}
              />
            </div>

            {/* Key facts grid */}
            <div>
              <h2 className="text-lg font-black text-blueprint mb-4">Eckdaten</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                <FactCard icon="straighten" label="Wohnflaeche" value={`${p.livingArea} m²`} />
                {p.rooms && <FactCard icon="meeting_room" label="Zimmer" value={String(p.rooms)} />}
                {p.bathrooms && <FactCard icon="bathtub" label="Badezimmer" value={String(p.bathrooms)} />}
                {p.yearBuilt && <FactCard icon="calendar_month" label="Baujahr" value={String(p.yearBuilt)} />}
                {p.plotArea && <FactCard icon="landscape" label="Grundstueck" value={`${p.plotArea} m²`} />}
                <FactCard icon="home_work" label="Typ" value={TYPE_DE[p.type] || p.type} />
                <FactCard icon="construction" label="Zustand" value={COND_DE[p.condition] || p.condition} />
                {p.floor != null && <FactCard icon="layers" label="Etage" value={String(p.floor)} />}
              </div>
            </div>

            {/* Description */}
            {listing.descriptionLong && (
              <div>
                <h2 className="text-lg font-black text-blueprint mb-4">Beschreibung</h2>
                <div className="text-slate-600 leading-relaxed whitespace-pre-line text-[15px]">
                  {listing.descriptionLong}
                </div>
              </div>
            )}

            {/* Features */}
            {p.attributes && (p.attributes as string[]).length > 0 && (
              <div>
                <h2 className="text-lg font-black text-blueprint mb-4">Ausstattung</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(p.attributes as string[]).map((attr) => (
                    <div key={attr} className="flex items-center gap-2.5 bg-slate-50 rounded-xl px-4 py-3">
                      <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                      <span className="text-sm font-medium text-blueprint">{attr}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Floor plan */}
            {floorplans.length > 0 && (
              <div>
                <h2 className="text-lg font-black text-blueprint mb-4">Grundriss</h2>
                {floorplans.map((fp) => (
                  <div key={fp.id} className="bg-slate-50 rounded-2xl p-4">
                    {fp.storageKey.endsWith(".pdf") ? (
                      <a href={fp.storageKey} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 hover:bg-slate-100 rounded-xl transition-colors">
                        <span className="material-symbols-outlined text-3xl text-primary">picture_as_pdf</span>
                        <div>
                          <p className="font-bold text-blueprint">Grundriss (PDF)</p>
                          <p className="text-xs text-slate-500">Klicken zum Oeffnen</p>
                        </div>
                      </a>
                    ) : (
                      <Image src={fp.storageKey} alt="Grundriss" width={800} height={600} className="w-full h-auto rounded-xl" />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Energy certificate — GEG mandatory */}
            {p.energyCert && (
              <div>
                <h2 className="text-lg font-black text-blueprint mb-4">Energieausweis</h2>
                <div className="bg-slate-50 rounded-2xl p-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Ausweistyp</div>
                      <div className="text-sm font-bold text-blueprint">{p.energyCert.type === "VERBRAUCH" ? "Verbrauchsausweis" : "Bedarfsausweis"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Energieklasse</div>
                      <div className="text-2xl font-black text-primary">{p.energyCert.energyClass}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Kennwert</div>
                      <div className="text-sm font-bold text-blueprint">{p.energyCert.energyValue} kWh/(m²·a)</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Energietraeger</div>
                      <div className="text-sm font-bold text-blueprint">{p.energyCert.primarySource}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Map placeholder */}
            <div>
              <h2 className="text-lg font-black text-blueprint mb-4">Lage</h2>
              <div className="bg-slate-100 rounded-2xl h-48 flex items-center justify-center">
                <div className="text-center">
                  <span className="material-symbols-outlined text-3xl text-slate-300 mb-2 block">map</span>
                  <p className="text-sm font-bold text-slate-400">{p.street} {p.houseNumber}, {p.postcode} {p.city}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ Sidebar ═══ */}
          <div>
            <div id="anfrage" className="sticky top-24 space-y-4">
              <EnquiryForm listingId={listing.id} />
              <BookingWidget listingId={listing.id} />
              <OfferForm listingId={listing.id} askingPrice={price} />

              {/* Direkta branding */}
              <div className="text-center pt-4">
                <div className="flex items-center gap-2 justify-center mb-2">
                  <span className="material-symbols-outlined text-primary text-base">home_work</span>
                  <span className="text-sm font-black tracking-tight">DIREKTA<span className="text-primary">.</span></span>
                </div>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                  Immobilie verkaufen. Direkt.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Similar listings */}
      {similar.length > 0 && (
        <div className="bg-slate-50 border-t border-slate-200">
          <div className="max-w-6xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-black text-blueprint mb-8">Aehnliche Immobilien</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {similar.map((s) => (
                <Link
                  key={s.id}
                  href={`/immobilien/${s.slug}`}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all group"
                >
                  <div className="relative aspect-[16/10] bg-slate-100">
                    {s.property.media[0] ? (
                      <Image src={s.property.media[0].storageKey} alt="" fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="33vw" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-3xl text-slate-300">home_work</span>
                      </div>
                    )}
                    {s.askingPrice && (
                      <div className="absolute bottom-3 left-3 bg-blueprint/90 backdrop-blur-sm text-white px-3 py-1 rounded-lg font-black">
                        EUR {Number(s.askingPrice).toLocaleString("de-DE")}
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-black text-blueprint group-hover:text-primary transition-colors truncate">
                      {s.titleShort || `${s.property.street} ${s.property.houseNumber}`}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">{s.property.postcode} {s.property.city}</p>
                    <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                      <span>{s.property.livingArea} m²</span>
                      {s.property.rooms && <span>{s.property.rooms} Zi.</span>}
                      {s.property.energyCert && <span className="text-primary font-bold">{s.property.energyCert.energyClass}</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="text-center mt-8">
              <Link href="/immobilien" className="text-sm font-bold text-primary hover:text-primary-dark transition-colors">
                Alle Inserate anzeigen →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
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

function FactCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="material-symbols-outlined text-primary text-lg">{icon}</span>
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</span>
      </div>
      <div className="text-base font-black text-blueprint">{value}</div>
    </div>
  );
}
