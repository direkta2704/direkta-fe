"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import ExposeFields from "./expose-fields";
import TextImport from "./text-import";

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
  roomProgram: unknown;
  specifications: unknown;
  buildingInfo: unknown;
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [listingData, setListingData] = useState<{
    titleShort: string | null;
    descriptionLong: string | null;
    askingPrice: string | null;
    status: string;
  } | null>(null);

  const fetchProperty = useCallback(() => {
    fetch(`/api/properties/${id}`)
      .then((r) => r.json())
      .then(setProperty)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchProperty();
  }, [fetchProperty]);

  async function openPreview() {
    if (property?.listings[0]?.id) {
      const res = await fetch(`/api/listings/${property.listings[0].id}`);
      if (res.ok) {
        const data = await res.json();
        setListingData(data);
      }
    }
    setPreviewOpen(true);
  }

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
            <>
              <a
                href={`/api/listings/${property.listings[0].id}/pdf`}
                target="_blank"
                className="bg-white border border-slate-200 hover:border-primary text-blueprint px-5 py-3 rounded-xl text-sm font-black uppercase tracking-[0.18em] transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-lg text-primary">picture_as_pdf</span>
                PDF
              </a>
              <button
                onClick={openPreview}
                className="bg-white border border-slate-200 hover:border-primary text-blueprint px-5 py-3 rounded-xl text-sm font-black uppercase tracking-[0.18em] transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">visibility</span>
                Vorschau
              </button>
              <button
                onClick={() => router.push(`/dashboard/listings/${property.listings[0].id}`)}
                className="bg-blueprint hover:bg-primary text-white px-5 py-3 rounded-xl text-sm font-black uppercase tracking-[0.18em] transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">edit</span>
                Bearbeiten
              </button>
            </>
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

          {/* Floor plan */}
          <div className="bg-white rounded-2xl border border-slate-200 p-7">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-black text-blueprint">Grundrisse</h2>
                <p className="text-xs text-slate-500 mt-0.5">PDF, JPG oder PNG — mehrere Dateien möglich</p>
              </div>
              <label className="bg-blueprint hover:bg-primary text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors cursor-pointer flex items-center gap-2">
                <span className="material-symbols-outlined text-base">upload_file</span>
                Grundriss hochladen
                <input
                  type="file"
                  accept="image/*,.pdf"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      for (const file of Array.from(e.target.files)) {
                        const form = new FormData();
                        form.append("file", file);
                        form.append("kind", "FLOORPLAN");
                        await fetch(`/api/properties/${id}/media`, { method: "POST", body: form });
                      }
                      fetchProperty();
                    }
                  }}
                />
              </label>
            </div>
            {(() => {
              const floorplans = property.media.filter((m) => m.kind === "FLOORPLAN");
              if (floorplans.length === 0) {
                return (
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
                    <span className="material-symbols-outlined text-3xl text-slate-300 mb-2 block">floor_lamp</span>
                    <p className="text-sm text-slate-400">Noch kein Grundriss hochgeladen</p>
                  </div>
                );
              }
              return (
                <div className="space-y-3">
                  {floorplans.map((fp) => (
                    <div key={fp.id} className="relative group">
                      {fp.storageKey.endsWith(".pdf") ? (
                        <div className="bg-slate-50 rounded-xl p-5 flex items-center gap-4">
                          <span className="material-symbols-outlined text-3xl text-primary">picture_as_pdf</span>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-blueprint">{fp.fileName || "Grundriss.pdf"}</p>
                            <p className="text-xs text-slate-400">PDF-Datei</p>
                          </div>
                          <a href={fp.storageKey} target="_blank" className="text-xs font-bold text-primary hover:text-primary-dark">Anzeigen</a>
                          <button onClick={() => deleteMedia(fp.id)} className="text-xs font-bold text-red-500 hover:text-red-600">Entfernen</button>
                        </div>
                      ) : (
                        <div className="relative rounded-xl overflow-hidden bg-slate-100">
                          <Image src={fp.storageKey} alt="Grundriss" width={800} height={600} className="w-full h-auto" />
                          <button
                            onClick={() => deleteMedia(fp.id)}
                            className="absolute top-2 right-2 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <span className="material-symbols-outlined text-sm">close</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
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

        {/* Expose details — full width below the grid */}
        <div className="lg:col-span-3 mt-6 space-y-6">
          <TextImport propertyId={property.id} onImported={fetchProperty} />
          <ExposeFields
            propertyId={property.id}
            initialRooms={(property.roomProgram as { name: string; area: string }[] | null) || []}
            initialSpecs={(property.specifications as Record<string, Record<string, string>> | null) || {}}
            initialBuilding={(property.buildingInfo as Record<string, string> | null) || {}}
          />
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

      {/* Preview Modal */}
      {previewOpen && property && (
        <div className="fixed inset-0 z-[200] overflow-y-auto">
          <div className="fixed inset-0 bg-blueprint/60 backdrop-blur-sm modal-backdrop" onClick={() => setPreviewOpen(false)} />
          <div className="relative flex justify-center p-4 min-h-full">
            <div className="relative w-full max-w-3xl my-8 bg-white rounded-3xl shadow-2xl modal-panel overflow-hidden h-fit">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-slate-200 px-7 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">visibility</span>
                <span className="text-sm font-black text-blueprint uppercase tracking-[0.15em]">Inserats-Vorschau</span>
                {listingData?.status && (
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                    listingData.status === "ACTIVE" ? "bg-emerald-50 text-emerald-600"
                    : listingData.status === "DRAFT" ? "bg-amber-50 text-amber-600"
                    : "bg-slate-100 text-slate-500"
                  }`}>{listingData.status}</span>
                )}
              </div>
              <button onClick={() => setPreviewOpen(false)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Photo gallery */}
            {photos.length > 0 ? (
              <div className="grid grid-cols-2 gap-1">
                <div className="col-span-2 aspect-[16/9] relative">
                  <Image src={photos[0].storageKey} alt="" fill className="object-cover" sizes="768px" />
                </div>
                {photos.slice(1, 5).map((photo) => (
                  <div key={photo.id} className="aspect-[4/3] relative">
                    <Image src={photo.storageKey} alt="" fill className="object-cover" sizes="384px" />
                  </div>
                ))}
                {photos.length > 5 && (
                  <div className="aspect-[4/3] relative">
                    <Image src={photos[5].storageKey} alt="" fill className="object-cover" sizes="384px" />
                    {photos.length > 6 && (
                      <div className="absolute inset-0 bg-blueprint/60 flex items-center justify-center">
                        <span className="text-white font-black text-lg">+{photos.length - 6} Fotos</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-100 h-48 flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl text-slate-300">image</span>
              </div>
            )}

            <div className="p-7 space-y-6">
              {/* Price + Title */}
              <div>
                {listingData?.askingPrice && (
                  <div className="text-3xl font-black text-primary mb-2">
                    €{Number(listingData.askingPrice).toLocaleString("de-DE")}
                  </div>
                )}
                <h2 className="text-2xl font-black text-blueprint">
                  {listingData?.titleShort || `${property.street} ${property.houseNumber}, ${property.city}`}
                </h2>
                <p className="text-slate-500 mt-1">{property.street} {property.houseNumber}, {property.postcode} {property.city}</p>
              </div>

              {/* Key facts */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <FactChip icon="straighten" label="Wohnfläche" value={`${property.livingArea} m²`} />
                {property.rooms && <FactChip icon="meeting_room" label="Zimmer" value={String(property.rooms)} />}
                {property.bathrooms && <FactChip icon="bathtub" label="Badezimmer" value={String(property.bathrooms)} />}
                {property.yearBuilt && <FactChip icon="calendar_month" label="Baujahr" value={String(property.yearBuilt)} />}
                {property.plotArea && <FactChip icon="landscape" label="Grundstück" value={`${property.plotArea} m²`} />}
                {property.floor != null && <FactChip icon="layers" label="Etage" value={String(property.floor)} />}
              </div>

              {/* Description */}
              {listingData?.descriptionLong ? (
                <div>
                  <h3 className="text-sm font-black text-blueprint uppercase tracking-[0.15em] mb-3">Beschreibung</h3>
                  <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                    {listingData.descriptionLong}
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
                  Noch keine Beschreibung generiert. Bearbeiten Sie das Inserat, um eine KI-Beschreibung zu erstellen.
                </div>
              )}

              {/* Features */}
              {property.attributes && (property.attributes as string[]).length > 0 && (
                <div>
                  <h3 className="text-sm font-black text-blueprint uppercase tracking-[0.15em] mb-3">Ausstattung</h3>
                  <div className="flex flex-wrap gap-2">
                    {(property.attributes as string[]).map((attr) => (
                      <span key={attr} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-blueprint">
                        <span className="material-symbols-outlined text-primary text-sm">check</span>
                        {attr}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Energy */}
              {property.energyCert && (
                <div className="bg-slate-50 rounded-xl p-5">
                  <h3 className="text-sm font-black text-blueprint uppercase tracking-[0.15em] mb-3">Energieausweis</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-0.5">Typ</div>
                      <div className="font-medium text-blueprint">{property.energyCert.type === "VERBRAUCH" ? "Verbrauch" : "Bedarf"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-0.5">Klasse</div>
                      <div className="font-black text-primary text-lg">{property.energyCert.energyClass}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-0.5">Verbrauch</div>
                      <div className="font-medium text-blueprint">{property.energyCert.energyValue} kWh/m²·a</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-0.5">Energieträger</div>
                      <div className="font-medium text-blueprint">{property.energyCert.primarySource}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Enquiry button (disabled in preview) */}
              <div className="pt-4 border-t border-slate-200">
                <button disabled className="w-full bg-primary/40 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-[0.18em] cursor-not-allowed flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-lg">mail</span>
                  Anfrage senden (Vorschau)
                </button>
                <p className="text-[10px] text-slate-400 text-center mt-2">Kontaktformular wird nach Veröffentlichung aktiv</p>
              </div>
            </div>
          </div>
          </div>
        </div>
      )}
    </>
  );
}

function FactChip({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="material-symbols-outlined text-primary text-base">{icon}</span>
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</span>
      </div>
      <div className="text-sm font-black text-blueprint">{value}</div>
    </div>
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
