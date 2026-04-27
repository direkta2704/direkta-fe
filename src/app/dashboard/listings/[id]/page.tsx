"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface Listing {
  id: string;
  status: string;
  slug: string;
  titleShort: string | null;
  descriptionLong: string | null;
  askingPrice: string | null;
  createdAt: string;
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

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
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
      setListing((prev) => prev ? { ...prev, ...data } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generierung fehlgeschlagen");
    }
    setGenerating(false);
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
      setListing((prev) => prev ? { ...prev, ...data } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    }
    setSaving(false);
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
            <h1 className="text-3xl font-black text-blueprint tracking-tight">
              Inserat bearbeiten
            </h1>
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
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 font-medium">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* AI Generation */}
        <div className="bg-white rounded-2xl border border-slate-200 p-7">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-black text-blueprint">KI-Beschreibung</h2>
              <p className="text-xs text-slate-500 mt-1">
                Generieren Sie automatisch eine professionelle Exposé-Beschreibung aus Ihren Immobiliendaten.
              </p>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-all hover:scale-[1.02] shadow-lg shadow-primary/25 disabled:opacity-60 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">
                {generating ? "hourglass_top" : "auto_awesome"}
              </span>
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
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
            Kurzbeschreibung (max. 160 Zeichen)
          </label>
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
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
            Langbeschreibung (250–600 Wörter)
          </label>
          <textarea
            value={descriptionLong}
            onChange={(e) => setDescriptionLong(e.target.value)}
            rows={12}
            placeholder="Die KI generiert eine professionelle Beschreibung für Sie. Klicken Sie oben auf 'Beschreibung generieren'."
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-y leading-relaxed"
          />
          <p className="text-xs text-slate-400 mt-2 text-right">
            {descriptionLong.split(/\s+/).filter(Boolean).length} Wörter
          </p>
        </div>

        {/* Asking price */}
        <div className="bg-white rounded-2xl border border-slate-200 p-7">
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
            Angebotspreis (€)
          </label>
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
        </div>

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

        {/* Action buttons */}
        <div className="flex items-center justify-between pt-4">
          <button
            onClick={() => router.push(`/dashboard/properties/${listing.property.id}`)}
            className="text-sm font-bold text-slate-500 hover:text-blueprint transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Zur Immobilie
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blueprint hover:bg-primary text-white px-6 py-3 rounded-xl text-sm font-black uppercase tracking-[0.15em] transition-colors disabled:opacity-60"
            >
              {saving ? "Wird gespeichert..." : "Speichern"}
            </button>
            <button
              disabled={!canPublish}
              className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl text-sm font-black uppercase tracking-[0.18em] transition-all hover:scale-[1.02] shadow-lg shadow-primary/25 disabled:opacity-40 disabled:hover:scale-100 flex items-center gap-2"
              title={!canPublish ? "Alle Pflichtfelder müssen erfüllt sein" : ""}
            >
              <span className="material-symbols-outlined text-lg">publish</span>
              Veröffentlichen
            </button>
          </div>
        </div>
      </div>
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
