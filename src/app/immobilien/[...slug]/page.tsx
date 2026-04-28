import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import EnquiryForm from "./enquiry-form";
import OfferForm from "./offer-form";
import BookingWidget from "./booking-widget";

interface Props {
  params: Promise<{ slug: string[] }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const fullSlug = slug.join("/");
  const listing = await prisma.listing.findFirst({
    where: { slug: fullSlug, status: "ACTIVE" },
    include: { property: true },
  });

  if (!listing) return { title: "Inserat nicht gefunden" };

  const p = listing.property;
  return {
    title: listing.titleShort || `${p.street} ${p.houseNumber}, ${p.city} — Direkta`,
    description: listing.descriptionLong?.substring(0, 160) || `Immobilie in ${p.city}`,
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
          media: { where: { kind: "PHOTO" }, orderBy: { ordering: "asc" } },
        },
      },
    },
  });

  if (!listing) notFound();

  const p = listing.property;
  const photos = p.media;
  const price = listing.askingPrice ? Number(listing.askingPrice) : null;

  const CONDITION_DE: Record<string, string> = {
    ERSTBEZUG: "Erstbezug", NEUBAU: "Neubau", GEPFLEGT: "Gepflegt",
    RENOVIERUNGS_BEDUERFTIG: "Renovierungsbedürftig",
    SANIERUNGS_BEDUERFTIG: "Sanierungsbedürftig", ROHBAU: "Rohbau",
  };

  const TYPE_DE: Record<string, string> = {
    ETW: "Eigentumswohnung", EFH: "Einfamilienhaus", MFH: "Mehrfamilienhaus",
    DHH: "Doppelhaushälfte", RH: "Reihenhaus", GRUNDSTUECK: "Grundstück",
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <header className="border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <span className="material-symbols-outlined text-2xl text-primary">home_work</span>
            <span className="text-lg font-black tracking-tight">DIREKTA<span className="text-primary">.</span></span>
          </a>
          <a href="#anfrage" className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-[0.18em] transition-all hover:scale-[1.03] flex items-center gap-1.5">
            Anfrage senden
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </a>
        </div>
      </header>

      {/* Photo gallery */}
      {photos.length > 0 && (
        <div className="max-w-6xl mx-auto px-6 pt-6">
          <div className="grid grid-cols-4 gap-2 rounded-2xl overflow-hidden max-h-[480px]">
            <div className="col-span-2 row-span-2 relative aspect-[4/3]">
              <Image src={photos[0].storageKey} alt="" fill className="object-cover" sizes="50vw" priority />
            </div>
            {photos.slice(1, 5).map((photo) => (
              <div key={photo.id} className="relative aspect-[4/3]">
                <Image src={photo.storageKey} alt="" fill className="object-cover" sizes="25vw" />
              </div>
            ))}
            {photos.length <= 1 && (
              <>
                <div className="bg-slate-100" />
                <div className="bg-slate-100" />
                <div className="bg-slate-100" />
                <div className="bg-slate-100" />
              </>
            )}
          </div>
          {photos.length > 5 && (
            <p className="text-xs text-slate-400 mt-2 text-right">{photos.length} Fotos insgesamt</p>
          )}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid lg:grid-cols-3 gap-10">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Header */}
            <div>
              {price && (
                <div className="text-4xl font-black text-primary mb-3">
                  €{price.toLocaleString("de-DE")}
                </div>
              )}
              <h1 className="text-3xl font-black text-blueprint tracking-tight">
                {listing.titleShort || `${p.street} ${p.houseNumber}`}
              </h1>
              <p className="text-lg text-slate-500 mt-2">
                {p.street} {p.houseNumber}, {p.postcode} {p.city}
              </p>
            </div>

            {/* Key facts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Fact icon="straighten" label="Wohnfläche" value={`${p.livingArea} m²`} />
              {p.rooms && <Fact icon="meeting_room" label="Zimmer" value={String(p.rooms)} />}
              {p.bathrooms && <Fact icon="bathtub" label="Badezimmer" value={String(p.bathrooms)} />}
              {p.yearBuilt && <Fact icon="calendar_month" label="Baujahr" value={String(p.yearBuilt)} />}
              {p.plotArea && <Fact icon="landscape" label="Grundstück" value={`${p.plotArea} m²`} />}
              <Fact icon="home_work" label="Typ" value={TYPE_DE[p.type] || p.type} />
              <Fact icon="construction" label="Zustand" value={CONDITION_DE[p.condition] || p.condition} />
              {p.floor != null && <Fact icon="layers" label="Etage" value={String(p.floor)} />}
            </div>

            {/* Description */}
            {listing.descriptionLong && (
              <div>
                <h2 className="text-xl font-black text-blueprint mb-4">Beschreibung</h2>
                <div className="text-slate-600 leading-relaxed whitespace-pre-line">
                  {listing.descriptionLong}
                </div>
              </div>
            )}

            {/* Features */}
            {p.attributes && (p.attributes as string[]).length > 0 && (
              <div>
                <h2 className="text-xl font-black text-blueprint mb-4">Ausstattung</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(p.attributes as string[]).map((attr) => (
                    <div key={attr} className="flex items-center gap-2 text-sm text-blueprint">
                      <span className="material-symbols-outlined text-primary text-base">check_circle</span>
                      {attr}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Energy certificate — GEG mandatory */}
            {p.energyCert && (
              <div className="bg-slate-50 rounded-2xl p-6">
                <h2 className="text-xl font-black text-blueprint mb-4">Energieausweis</h2>
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
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Energieträger</div>
                    <div className="text-sm font-bold text-blueprint">{p.energyCert.primarySource}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar: Enquiry form */}
          <div>
            <div id="anfrage" className="sticky top-24">
              <EnquiryForm listingId={listing.id} />

              <div className="mt-4">
                <BookingWidget listingId={listing.id} />
              </div>

              <div className="mt-4">
                <OfferForm listingId={listing.id} askingPrice={price} />
              </div>

              <div className="mt-6 text-center">
                <div className="flex items-center gap-2 justify-center mb-3">
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

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 px-6">
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

function Fact({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="material-symbols-outlined text-primary text-base">{icon}</span>
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</span>
      </div>
      <div className="text-sm font-black text-blueprint">{value}</div>
    </div>
  );
}
