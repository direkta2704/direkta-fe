"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ExposeSection from "./expose-section";

interface Comparable {
  id: string;
  source: string;
  type: string;
  livingArea: number;
  pricePerSqm: number;
  distanceMeters: number;
  ageDays: number;
  similarityScore: number;
}

interface PriceRec {
  id: string;
  low: string;
  median: string;
  high: string;
  strategyQuick: string;
  strategyReal: string;
  strategyMax: string;
  confidence: string;
  comparables: Comparable[];
}

interface Listing {
  id: string;
  status: string;
  slug: string;
  titleShort: string | null;
  descriptionLong: string | null;
  askingPrice: string | null;
  createdAt: string;
  exposeHeadline: string | null;
  locationDescription: string | null;
  buildingDescription: string | null;
  highlights: string[] | null;
  sellerContact: Record<string, string> | null;
  priceRecommendation: PriceRec | null;
  property: {
    id: string;
    type: string;
    street: string;
    houseNumber: string;
    postcode: string;
    city: string;
    livingArea: number;
    rooms: number | null;
    energyCert: { energyClass: string } | null;
    media: { id: string; storageKey: string; kind: string }[];
  };
}

const CONFIDENCE_DE: Record<string, { label: string; color: string }> = {
  HIGH: { label: "Hoch", color: "bg-emerald-50 text-emerald-600" },
  MEDIUM: { label: "Mittel", color: "bg-amber-50 text-amber-600" },
  LOW: { label: "Niedrig", color: "bg-red-50 text-red-500" },
};

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [pricing, setPricing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  const [titleShort, setTitleShort] = useState("");
  const [descriptionLong, setDescriptionLong] = useState("");
  const [askingPrice, setAskingPrice] = useState("");

  useEffect(() => {
    fetch(`/api/listings/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setListing(data);
        setTitleShort(data.titleShort || "");
        setDescriptionLong(data.descriptionLong || "");
        setAskingPrice(data.askingPrice || "");
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch(`/api/listings/${id}/generate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTitleShort(data.titleShort || "");
      setDescriptionLong(data.descriptionLong || "");
      setListing((prev) => (prev ? { ...prev, ...data } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generierung fehlgeschlagen");
    }
    setGenerating(false);
  }

  async function handlePricing() {
    setPricing(true);
    setError("");
    try {
      const res = await fetch(`/api/listings/${id}/price-recommendation`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setListing((prev) => (prev ? { ...prev, priceRecommendation: data } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preisberechnung fehlgeschlagen");
    }
    setPricing(false);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleShort,
          descriptionLong,
          askingPrice: askingPrice ? parseFloat(askingPrice) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setListing((prev) => (prev ? { ...prev, ...data } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    }
    setSaving(false);
  }

  async function handlePublish() {
    setPublishing(true);
    setError("");
    try {
      // Save first
      await fetch(`/api/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleShort, descriptionLong, askingPrice: parseFloat(askingPrice) }),
      });
      // Then publish
      const res = await fetch(`/api/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setListing((prev) => (prev ? { ...prev, ...data } : prev));
      router.push("/dashboard/listings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Veröffentlichung fehlgeschlagen");
    }
    setPublishing(false);
  }

  function applyStrategy(price: string) {
    setAskingPrice(String(Math.round(Number(price))));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!listing) {
    return <div className="text-center py-20"><p className="text-slate-500">Inserat nicht gefunden.</p></div>;
  }

  const photos = listing.property.media.filter((m) => m.kind === "PHOTO");
  const hasEnergy = !!listing.property.energyCert;
  const hasMinPhotos = photos.length >= 6;
  const hasDescription = !!descriptionLong;
  const hasPrice = !!askingPrice && parseFloat(askingPrice) > 0;
  const canPublish = hasEnergy && hasMinPhotos && hasDescription && hasPrice;
  const rec = listing.priceRecommendation;

  return (
    <div className="max-w-4xl mx-auto">
      <button
        onClick={() => router.push("/dashboard/listings")}
        className="flex items-center gap-1 text-slate-400 hover:text-blueprint text-sm font-bold mb-4 transition-colors"
      >
        <span className="material-symbols-outlined text-lg">arrow_back</span>
        Zurück zu Inserate
      </button>

      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-black text-blueprint tracking-tight">Inserat bearbeiten</h1>
            <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
              listing.status === "ACTIVE" ? "bg-emerald-50 text-emerald-600"
              : listing.status === "DRAFT" ? "bg-amber-50 text-amber-600"
              : "bg-slate-100 text-slate-500"
            }`}>{listing.status}</span>
          </div>
          <p className="text-slate-500">
            {listing.property.street} {listing.property.houseNumber}, {listing.property.postcode} {listing.property.city}
          </p>
        </div>
        <a
          href={`/expose/${id}`}
          target="_blank"
          className="bg-white border border-slate-200 hover:border-primary text-blueprint px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors flex items-center gap-2 flex-shrink-0"
        >
          <span className="material-symbols-outlined text-base text-primary">picture_as_pdf</span>
          Expose Vorschau
        </a>
      </div>

      {listing.status === "ACTIVE" && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-emerald-600">public</span>
            <div>
              <p className="text-sm font-bold text-emerald-800">Inserat ist live</p>
              <p className="text-xs text-emerald-600 truncate max-w-md">{typeof window !== "undefined" ? window.location.origin : ""}/immobilien/{listing.slug}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/immobilien/${listing.slug}`}
              target="_blank"
              className="bg-white border border-emerald-200 text-emerald-700 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-[0.15em] hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">open_in_new</span>
              Ansehen
            </a>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/immobilien/${listing.slug}`);
                alert("Link kopiert!");
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-black uppercase tracking-[0.15em] transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">link</span>
              Link kopieren
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 font-medium">{error}</div>
      )}

      <div className="space-y-6">
        {/* ── Pricing Engine ── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-7">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-black text-blueprint">Preisempfehlung</h2>
              <p className="text-xs text-slate-500 mt-1">Regelbasierte Berechnung anhand von Vergleichsobjekten und Marktdaten.</p>
            </div>
            <button
              onClick={handlePricing}
              disabled={pricing}
              className="bg-blueprint hover:bg-primary text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-all hover:scale-[1.02] disabled:opacity-60 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">{pricing ? "hourglass_top" : "finance"}</span>
              {pricing ? "Wird berechnet..." : rec ? "Neu berechnen" : "Preis berechnen"}
            </button>
          </div>

          {rec && (
            <>
              {/* Confidence */}
              <div className="flex items-center gap-3 mb-6">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Konfidenz:</span>
                <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${CONFIDENCE_DE[rec.confidence]?.color || "bg-slate-100 text-slate-500"}`}>
                  {CONFIDENCE_DE[rec.confidence]?.label || rec.confidence}
                </span>
                <span className="text-xs text-slate-400">· {rec.comparables.length} Vergleichsobjekte</span>
              </div>

              {/* Price band */}
              <div className="bg-slate-50 rounded-xl p-5 mb-6">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Preisspanne</div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-xs text-slate-400">Niedrig</div>
                    <div className="text-lg font-black text-slate-500">€{Number(rec.low).toLocaleString("de-DE")}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-primary font-bold">Median</div>
                    <div className="text-2xl font-black text-blueprint">€{Number(rec.median).toLocaleString("de-DE")}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Hoch</div>
                    <div className="text-lg font-black text-slate-500">€{Number(rec.high).toLocaleString("de-DE")}</div>
                  </div>
                </div>
                <div className="mt-3 h-2 bg-slate-200 rounded-full overflow-hidden relative">
                  <div className="absolute inset-y-0 bg-gradient-to-r from-blue-400 via-primary to-red-400 rounded-full" style={{ left: "10%", right: "10%" }} />
                </div>
              </div>

              {/* Three strategies */}
              <div className="grid sm:grid-cols-3 gap-4 mb-6">
                <StrategyCard
                  name="Schnellverkauf"
                  price={rec.strategyQuick}
                  timeline="3–6 Wochen"
                  description="Unter Median, schneller Abschluss"
                  color="blue"
                  onApply={() => applyStrategy(rec.strategyQuick)}
                />
                <StrategyCard
                  name="Realistisch"
                  price={rec.strategyReal}
                  timeline="6–12 Wochen"
                  description="Marktgerechter Preis"
                  color="primary"
                  recommended
                  onApply={() => applyStrategy(rec.strategyReal)}
                />
                <StrategyCard
                  name="Maximum"
                  price={rec.strategyMax}
                  timeline="10–20 Wochen"
                  description="Über Median, längere Vermarktung"
                  color="violet"
                  onApply={() => applyStrategy(rec.strategyMax)}
                />
              </div>

              {/* Comparables table */}
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
                  Vergleichsobjekte ({rec.comparables.length})
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 pr-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Quelle</th>
                        <th className="text-left py-2 pr-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Fläche</th>
                        <th className="text-left py-2 pr-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">€/m²</th>
                        <th className="text-left py-2 pr-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Entfernung</th>
                        <th className="text-left py-2 pr-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Alter</th>
                        <th className="text-left py-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Ähnlichkeit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rec.comparables.slice(0, 10).map((c) => (
                        <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="py-2 pr-4 text-slate-500">{c.source}</td>
                          <td className="py-2 pr-4 text-blueprint font-medium">{c.livingArea} m²</td>
                          <td className="py-2 pr-4 text-blueprint font-medium">€{c.pricePerSqm.toLocaleString("de-DE")}</td>
                          <td className="py-2 pr-4 text-slate-500">{c.distanceMeters >= 1000 ? `${(c.distanceMeters / 1000).toFixed(1)} km` : `${c.distanceMeters} m`}</td>
                          <td className="py-2 pr-4 text-slate-500">{c.ageDays} Tage</td>
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full" style={{ width: `${c.similarityScore * 100}%` }} />
                              </div>
                              <span className="text-xs text-slate-500">{Math.round(c.similarityScore * 100)}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── AI Description ── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-7">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-black text-blueprint">KI-Beschreibung</h2>
              <p className="text-xs text-slate-500 mt-1">Professionelle Exposé-Beschreibung aus Ihren Immobiliendaten.</p>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-all hover:scale-[1.02] shadow-lg shadow-primary/25 disabled:opacity-60 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">{generating ? "hourglass_top" : "auto_awesome"}</span>
              {generating ? "Wird generiert..." : descriptionLong ? "Neu generieren" : "Beschreibung generieren"}
            </button>
          </div>
          {generating && (
            <div className="flex items-center gap-3 py-8 justify-center">
              <div className="w-6 h-6 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-slate-500">KI erstellt Ihre Beschreibung...</p>
            </div>
          )}
        </div>

        {/* Short title */}
        <div className="bg-white rounded-2xl border border-slate-200 p-7">
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Kurzbeschreibung (max. 160 Zeichen)</label>
          <input
            type="text"
            value={titleShort}
            onChange={(e) => setTitleShort(e.target.value)}
            maxLength={160}
            placeholder="z.B. Helle 3-Zimmer-Wohnung mit Balkon in Prenzlauer Berg"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
          <p className="text-xs text-slate-400 mt-2 text-right">{titleShort.length}/160</p>
        </div>

        {/* Long description */}
        <div className="bg-white rounded-2xl border border-slate-200 p-7">
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Langbeschreibung (250–600 Wörter)</label>
          <textarea
            value={descriptionLong}
            onChange={(e) => setDescriptionLong(e.target.value)}
            rows={12}
            placeholder="Klicken Sie oben auf 'Beschreibung generieren' für eine KI-erstellte Beschreibung."
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-y leading-relaxed"
          />
          <p className="text-xs text-slate-400 mt-2 text-right">{descriptionLong.split(/\s+/).filter(Boolean).length} Wörter</p>
        </div>

        {/* Asking price */}
        <div className="bg-white rounded-2xl border border-slate-200 p-7">
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Angebotspreis (€)</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">€</span>
            <input
              type="number"
              value={askingPrice}
              onChange={(e) => setAskingPrice(e.target.value)}
              placeholder="z.B. 450000"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          {rec && askingPrice && (
            <p className="text-xs mt-2 text-slate-500">
              {Number(askingPrice) < Number(rec.low)
                ? "⚠️ Unter der empfohlenen Preisspanne"
                : Number(askingPrice) > Number(rec.high)
                  ? "⚠️ Über der empfohlenen Preisspanne"
                  : "✓ Innerhalb der empfohlenen Preisspanne"}
            </p>
          )}
        </div>

        {/* Expose content */}
        <ExposeSection
          listingId={id}
          initial={{
            exposeHeadline: listing.exposeHeadline || null,
            locationDescription: listing.locationDescription || null,
            buildingDescription: listing.buildingDescription || null,
            highlights: listing.highlights as string[] | null,
            sellerContact: listing.sellerContact as { name?: string; phone?: string; email?: string; company?: string } | null,
          }}
        />

        {/* Compliance check */}
        <div className="bg-white rounded-2xl border border-slate-200 p-7">
          <h2 className="text-lg font-black text-blueprint mb-4">Veröffentlichungs-Check</h2>
          <div className="space-y-3">
            <CheckItem ok={hasEnergy} label="Energieausweis vorhanden" />
            <CheckItem ok={hasMinPhotos} label={`Mindestens 6 Fotos (${photos.length}/6)`} />
            <CheckItem ok={hasDescription} label="Beschreibung vorhanden" />
            <CheckItem ok={hasPrice} label="Angebotspreis festgelegt" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 pb-8">
          <button
            onClick={() => router.push(`/dashboard/properties/${listing.property.id}`)}
            className="text-sm font-bold text-slate-500 hover:text-blueprint transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Zur Immobilie
          </button>
          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={saving} className="bg-blueprint hover:bg-primary text-white px-6 py-3 rounded-xl text-sm font-black uppercase tracking-[0.15em] transition-colors disabled:opacity-60">
              {saving ? "Wird gespeichert..." : "Speichern"}
            </button>
            <button
              onClick={handlePublish}
              disabled={!canPublish || publishing}
              className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl text-sm font-black uppercase tracking-[0.18em] transition-all hover:scale-[1.02] shadow-lg shadow-primary/25 disabled:opacity-40 disabled:hover:scale-100 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">publish</span>
              {publishing ? "Wird veröffentlicht..." : "Veröffentlichen"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StrategyCard({
  name,
  price,
  timeline,
  description,
  color,
  recommended,
  onApply,
}: {
  name: string;
  price: string;
  timeline: string;
  description: string;
  color: string;
  recommended?: boolean;
  onApply: () => void;
}) {
  const border = recommended ? "border-primary ring-2 ring-primary/20" : "border-slate-200";
  const colorMap: Record<string, string> = {
    blue: "text-blue-600",
    primary: "text-primary",
    violet: "text-violet-600",
  };
  return (
    <div className={`bg-white border ${border} rounded-xl p-5 relative`}>
      {recommended && (
        <div className="absolute -top-2.5 left-4 bg-primary text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
          Empfohlen
        </div>
      )}
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">{name}</div>
      <div className={`text-2xl font-black ${colorMap[color] || "text-blueprint"} mb-1`}>
        €{Number(price).toLocaleString("de-DE")}
      </div>
      <div className="text-xs text-slate-500 mb-1">{timeline}</div>
      <div className="text-xs text-slate-400 mb-4">{description}</div>
      <button
        onClick={onApply}
        className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-blueprint py-2 rounded-lg text-xs font-black uppercase tracking-[0.15em] transition-colors"
      >
        Preis übernehmen
      </button>
    </div>
  );
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`material-symbols-outlined text-lg ${ok ? "text-emerald-500" : "text-slate-300"}`}>
        {ok ? "check_circle" : "cancel"}
      </span>
      <span className={`text-sm ${ok ? "text-blueprint" : "text-slate-400"}`}>{label}</span>
    </div>
  );
}
