"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";

interface MediaItem {
  id: string;
  storageKey: string;
  fileName: string | null;
  kind: string;
  ordering: number;
}

interface Property {
  id: string;
  type: string;
  street: string;
  houseNumber: string;
  postcode: string;
  city: string;
  livingArea: number;
  plotArea: number | null;
  yearBuilt: number | null;
  rooms: number | null;
  bathrooms: number | null;
  floor: number | null;
  condition: string;
  attributes: string[] | null;
  createdAt: string;
  energyCert: {
    type: string;
    energyClass: string;
    energyValue: number;
    primarySource: string;
    validUntil: string;
  } | null;
  listings: { id: string; status: string; slug: string }[];
  media: MediaItem[];
}

const CONDITION_DE: Record<string, string> = {
  ERSTBEZUG: "Erstbezug",
  NEUBAU: "Neubau",
  GEPFLEGT: "Gepflegt",
  RENOVIERUNGS_BEDUERFTIG: "Renovierungsbedürftig",
  SANIERUNGS_BEDUERFTIG: "Sanierungsbedürftig",
  ROHBAU: "Rohbau",
};

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const fetchProperty = useCallback(() => {
    fetch(`/api/properties/${id}`)
      .then((r) => r.json())
      .then(setProperty)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchProperty();
  }, [fetchProperty]);

  async function uploadFiles(files: FileList | File[]) {
    setUploading(true);
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const form = new FormData();
      form.append("file", file);
      await fetch(`/api/properties/${id}/media`, {
        method: "POST",
        body: form,
      });
    }
    fetchProperty();
    setUploading(false);
  }

  async function deleteMedia(mediaId: string) {
    await fetch(`/api/media/${mediaId}`, { method: "DELETE" });
    fetchProperty();
  }

  async function createListing() {
    setCreating(true);
    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId: id }),
    });
    if (res.ok) {
      const listing = await res.json();
      router.push(`/dashboard/listings/${listing.id}`);
    }
    setCreating(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Immobilie nicht gefunden.</p>
      </div>
    );
  }

  const photos = property.media.filter((m) => m.kind === "PHOTO");
  const hasListing = property.listings.length > 0;

  return (
    <>
      <button
        onClick={() => router.push("/dashboard/properties")}
        className="flex items-center gap-1 text-slate-400 hover:text-blueprint text-sm font-bold mb-4 transition-colors"
      >
        <span className="material-symbols-outlined text-lg">arrow_back</span>
        Zurück zu Immobilien
      </button>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-blueprint tracking-tight">
            {property.street} {property.houseNumber}
          </h1>
          <p className="text-slate-500 mt-1">
            {property.postcode} {property.city}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!hasListing ? (
            <button
              onClick={createListing}
              disabled={creating}
              className="bg-primary hover:bg-primary-dark text-white px-5 py-3 rounded-xl text-sm font-black uppercase tracking-[0.18em] transition-all hover:scale-[1.02] shadow-lg shadow-primary/25 disabled:opacity-60 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">description</span>
              {creating ? "Wird erstellt..." : "Inserat erstellen"}
            </button>
          ) : (
            <button
              onClick={() => router.push(`/dashboard/listings/${property.listings[0].id}`)}
              className="bg-blueprint hover:bg-primary text-white px-5 py-3 rounded-xl text-sm font-black uppercase tracking-[0.18em] transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">description</span>
              Inserat anzeigen
            </button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Photo upload */}
          <div className="bg-white rounded-2xl border border-slate-200 p-7">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-blueprint">
                Fotos ({photos.length}/30)
              </h2>
              <label className="bg-blueprint hover:bg-primary text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors cursor-pointer flex items-center gap-2">
                <span className="material-symbols-outlined text-base">add_photo_alternate</span>
                Fotos hinzufügen
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && uploadFiles(e.target.files)}
                />
              </label>
            </div>

            {photos.length === 0 ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                  dragOver
                    ? "border-primary bg-primary/5"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                {uploading ? (
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
                    <p className="text-sm text-slate-500">Wird hochgeladen...</p>
                  </div>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-4xl text-slate-300 mb-3 block">
                      cloud_upload
                    </span>
                    <p className="font-bold text-blueprint mb-1">
                      Fotos hierher ziehen
                    </p>
                    <p className="text-sm text-slate-400">
                      oder klicken Sie auf &quot;Fotos hinzufügen&quot; · JPEG/PNG · max. 25 MB · mind. 6 Fotos
                    </p>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {photos.map((photo) => (
                    <div key={photo.id} className="relative group rounded-xl overflow-hidden bg-slate-100 aspect-[4/3]">
                      <Image
                        src={photo.storageKey}
                        alt={photo.fileName || "Foto"}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 50vw, 33vw"
                      />
                      <button
                        onClick={() => deleteMedia(photo.id)}
                        className="absolute top-2 right-2 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>
                  ))}

                  {/* Add more drop zone */}
                  <label
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl aspect-[4/3] flex flex-col items-center justify-center cursor-pointer transition-colors ${
                      dragOver ? "border-primary bg-primary/5" : "border-slate-200 hover:border-primary/40"
                    }`}
                  >
                    {uploading ? (
                      <div className="w-6 h-6 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-2xl text-slate-300 mb-1">add_photo_alternate</span>
                        <span className="text-[10px] font-bold text-slate-400">Hinzufügen</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => e.target.files && uploadFiles(e.target.files)}
                    />
                  </label>
                </div>

                {photos.length < 6 && (
                  <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">warning</span>
                    Mindestens 6 Fotos erforderlich zum Veröffentlichen (noch {6 - photos.length} nötig)
                  </p>
                )}
              </>
            )}
          </div>

          {/* Property details */}
          <div className="bg-white rounded-2xl border border-slate-200 p-7">
            <h2 className="text-lg font-black text-blueprint mb-5">Immobiliendetails</h2>
            <div className="grid sm:grid-cols-2 gap-y-5 gap-x-8">
              <Detail label="Immobilientyp" value={property.type} />
              <Detail label="Wohnfläche" value={`${property.livingArea} m²`} />
              {property.plotArea && <Detail label="Grundstück" value={`${property.plotArea} m²`} />}
              {property.rooms && <Detail label="Zimmer" value={String(property.rooms)} />}
              {property.bathrooms && <Detail label="Badezimmer" value={String(property.bathrooms)} />}
              {property.yearBuilt && <Detail label="Baujahr" value={String(property.yearBuilt)} />}
              {property.floor != null && <Detail label="Etage" value={String(property.floor)} />}
              <Detail label="Zustand" value={CONDITION_DE[property.condition] || property.condition} />
            </div>
            {property.attributes && (property.attributes as string[]).length > 0 && (
              <div className="mt-5 pt-5 border-t border-slate-100">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Ausstattung</div>
                <div className="flex flex-wrap gap-2">
                  {(property.attributes as string[]).map((attr) => (
                    <span key={attr} className="px-3 py-1 rounded-lg text-xs font-bold border border-primary/20 bg-primary/5 text-primary">{attr}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Energy cert */}
          <div className="bg-white rounded-2xl border border-slate-200 p-7">
            <h2 className="text-lg font-black text-blueprint mb-5">Energieausweis</h2>
            {property.energyCert ? (
              <div className="grid sm:grid-cols-2 gap-y-5 gap-x-8">
                <Detail label="Typ" value={property.energyCert.type === "VERBRAUCH" ? "Verbrauchsausweis" : "Bedarfsausweis"} />
                <Detail label="Energieklasse" value={property.energyCert.energyClass} />
                <Detail label="Energieverbrauch" value={`${property.energyCert.energyValue} kWh/m²·a`} />
                <Detail label="Primärenergieträger" value={property.energyCert.primarySource} />
                <Detail label="Gültig bis" value={new Date(property.energyCert.validUntil).toLocaleDateString("de-DE")} />
              </div>
            ) : (
              <div className="text-center py-8">
                <span className="material-symbols-outlined text-4xl text-slate-300 mb-3 block">electric_bolt</span>
                <p className="text-sm text-slate-400">Noch kein Energieausweis hochgeladen.</p>
                <p className="text-xs text-slate-400 mt-1">Gesetzlich vorgeschrieben vor Veröffentlichung eines Inserats.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <div className="bg-blueprint rounded-2xl p-7 text-white">
            <h3 className="font-black mb-4">Status</h3>
            <div className="space-y-3">
              <StatusRow label="Immobilie gespeichert" done />
              <StatusRow label="Energieausweis" done={!!property.energyCert} />
              <StatusRow label="Fotos hochgeladen" done={photos.length >= 6} detail={`${photos.length}/6 mind.`} />
              <StatusRow label="Inserat erstellt" done={hasListing} />
            </div>
          </div>

          {hasListing && (
            <div className="bg-white rounded-2xl border border-slate-200 p-7">
              <h3 className="font-black text-blueprint mb-4">Inserate</h3>
              <div className="space-y-3">
                {property.listings.map((l) => (
                  <div key={l.id} className="flex items-center justify-between py-2">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                      l.status === "ACTIVE" ? "bg-emerald-50 text-emerald-600"
                      : l.status === "DRAFT" ? "bg-amber-50 text-amber-600"
                      : "bg-slate-100 text-slate-500"
                    }`}>{l.status}</span>
                    <button
                      onClick={() => router.push(`/dashboard/listings/${l.id}`)}
                      className="text-xs font-bold text-primary hover:text-primary-dark transition-colors"
                    >
                      Anzeigen
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">{label}</div>
      <div className="text-sm font-bold text-blueprint">{value}</div>
    </div>
  );
}

function StatusRow({ label, done, detail }: { label: string; done: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`material-symbols-outlined text-base ${done ? "text-primary" : "text-white/20"}`}>
          {done ? "check_circle" : "radio_button_unchecked"}
        </span>
        <span className={`text-sm ${done ? "text-white/50" : "text-white/80"}`}>{label}</span>
      </div>
      {detail && <span className="text-[10px] font-bold text-white/40">{detail}</span>}
    </div>
  );
}
