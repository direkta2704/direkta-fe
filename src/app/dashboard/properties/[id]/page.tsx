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

interface UnitSummary {
  id: string;
  unitLabel: string | null;
  type: string;
  livingArea: number;
  rooms: number | null;
  bathrooms: number | null;
  floor: number | null;
  media: MediaItem[];
  listings: { id: string; status: string; slug: string }[];
  energyCert: { id: string } | null;
}

type SellingMode = "INDIVIDUAL" | "BUNDLE" | "BOTH";

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
  parentId: string | null;
  unitLabel: string | null;
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
  parent: { id: string; street: string; houseNumber: string; city: string } | null;
  units: UnitSummary[];
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
  const [addUnitOpen, setAddUnitOpen] = useState(false);
  const [unitForm, setUnitForm] = useState({ unitLabel: "", livingArea: "", rooms: "", bathrooms: "1", floor: "" });
  const [unitFloorplan, setUnitFloorplan] = useState<File | null>(null);
  const [unitCreating, setUnitCreating] = useState(false);
  const [sellingMode, setSellingMode] = useState<SellingMode>("INDIVIDUAL");
  const [savingMode, setSavingMode] = useState(false);
  const [unitListingCreating, setUnitListingCreating] = useState<string | null>(null);
  const [energyEditing, setEnergyEditing] = useState(false);
  const [energySaving, setEnergySaving] = useState(false);
  const [energyPdfUploading, setEnergyPdfUploading] = useState(false);
  const [energyPdfName, setEnergyPdfName] = useState<string | null>(null);
  const [energyPdfAssetId, setEnergyPdfAssetId] = useState<string | null>(null);
  const [energyForm, setEnergyForm] = useState({
    type: "VERBRAUCH",
    energyClass: "",
    energyValue: "",
    primarySource: "",
    validUntil: "",
  });

  const fetchProperty = useCallback(() => {
    fetch(`/api/properties/${id}`)
      .then((r) => r.json())
      .then(setProperty)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchProperty();
  }, [fetchProperty]);

  useEffect(() => {
    if (property?.buildingInfo) {
      const info = property.buildingInfo as Record<string, string>;
      if (info._sellingMode) setSellingMode(info._sellingMode as SellingMode);
    }
  }, [property?.buildingInfo]);

  useEffect(() => {
    if (property?.energyCert) {
      setEnergyForm({
        type: property.energyCert.type,
        energyClass: property.energyCert.energyClass,
        energyValue: String(property.energyCert.energyValue),
        primarySource: property.energyCert.primarySource,
        validUntil: property.energyCert.validUntil.slice(0, 10),
      });
    }
  }, [property?.energyCert]);

  async function saveEnergyCert() {
    if (!energyForm.energyClass || !energyForm.energyValue || !energyForm.primarySource || !energyForm.validUntil) return;
    setEnergySaving(true);
    await fetch(`/api/properties/${id}/energy-cert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...energyForm, pdfAssetId: energyPdfAssetId }),
    });
    setEnergySaving(false);
    setEnergyEditing(false);
    fetchProperty();
  }

  async function deleteEnergyCert() {
    await fetch(`/api/properties/${id}/energy-cert`, { method: "DELETE" });
    setEnergyForm({ type: "VERBRAUCH", energyClass: "", energyValue: "", primarySource: "", validUntil: "" });
    setEnergyEditing(false);
    fetchProperty();
  }

  async function saveSellingMode(mode: SellingMode) {
    setSellingMode(mode);
    setSavingMode(true);
    const existing = (property?.buildingInfo as Record<string, string>) || {};
    await fetch(`/api/properties/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buildingInfo: { ...existing, _sellingMode: mode } }),
    });
    setSavingMode(false);
    fetchProperty();
  }

  async function createUnitListing(unitId: string) {
    setUnitListingCreating(unitId);
    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId: unitId }),
    });
    if (res.ok) {
      const listing = await res.json();
      router.push(`/dashboard/listings/${listing.id}`);
    }
    setUnitListingCreating(null);
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

  async function createUnit() {
    if (!unitForm.unitLabel || !unitForm.livingArea) return;
    setUnitCreating(true);
    const res = await fetch(`/api/properties/${id}/units`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(unitForm),
    });
    if (res.ok) {
      const unit = await res.json();

      if (unitFloorplan) {
        const form = new FormData();
        form.append("file", unitFloorplan);
        form.append("kind", "FLOORPLAN");
        await fetch(`/api/properties/${unit.id}/media`, { method: "POST", body: form });
      }

      setAddUnitOpen(false);
      setUnitForm({ unitLabel: "", livingArea: "", rooms: "", bathrooms: "1", floor: "" });
      setUnitFloorplan(null);
      fetchProperty();
    }
    setUnitCreating(false);
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

  const isUnit = !!property.parentId;
  const hasUnits = !isUnit && (property.units?.length || 0) > 0;
  const showTopListingButton = isUnit || !hasUnits || sellingMode !== "INDIVIDUAL";

  return (
    <>
      {isUnit && property.parent ? (
        <button
          onClick={() => router.push(`/dashboard/properties/${property.parent!.id}`)}
          className="flex items-center gap-1 text-slate-400 hover:text-blueprint text-sm font-bold mb-4 transition-colors"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Zurück zu {property.parent.street} {property.parent.houseNumber}
        </button>
      ) : (
        <button
          onClick={() => router.push("/dashboard/properties")}
          className="flex items-center gap-1 text-slate-400 hover:text-blueprint text-sm font-bold mb-4 transition-colors"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Zurück zu Immobilien
        </button>
      )}

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-blueprint tracking-tight">
            {isUnit && property.unitLabel ? `${property.unitLabel} — ` : ""}{property.street} {property.houseNumber}
          </h1>
          <p className="text-slate-500 mt-1">
            {property.postcode} {property.city}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {showTopListingButton && (
            <>
              {!hasListing ? (
                <button
                  onClick={createListing}
                  disabled={creating}
                  className="bg-primary hover:bg-primary-dark text-white px-5 py-3 rounded-xl text-sm font-black uppercase tracking-[0.18em] transition-all hover:scale-[1.02] shadow-lg shadow-primary/25 disabled:opacity-60 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">description</span>
                  {creating ? "Wird erstellt..." : hasUnits ? "Paket-Inserat erstellen" : "Inserat erstellen"}
                </button>
              ) : (
                <>
                  <a
                    href={`/expose/${property.listings[0].id}`}
                    target="_blank"
                    className="bg-white border border-slate-200 hover:border-primary text-blueprint px-5 py-3 rounded-xl text-sm font-black uppercase tracking-[0.18em] transition-colors flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg text-primary">visibility</span>
                    Exposé Vorschau
                  </a>
                  <a
                    href={`/expose/${property.listings[0].id}?print=1`}
                    target="_blank"
                    className="bg-white border border-slate-200 hover:border-primary text-blueprint px-5 py-3 rounded-xl text-sm font-black uppercase tracking-[0.18em] transition-colors flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg text-primary">download</span>
                    PDF
                  </a>
                  <button
                    onClick={() => router.push(`/dashboard/listings/${property.listings[0].id}`)}
                    className="bg-blueprint hover:bg-primary text-white px-5 py-3 rounded-xl text-sm font-black uppercase tracking-[0.18em] transition-colors flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg">edit</span>
                    Bearbeiten
                  </button>
                </>
              )}
            </>
          )}
          {hasUnits && sellingMode === "INDIVIDUAL" && !hasListing && (
            <span className="text-xs text-slate-400 font-bold max-w-[200px] text-right">
              Inserate werden bei den einzelnen Wohnungen erstellt
            </span>
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

          {/* Per-unit floor plans — for parent properties with units */}
          {!isUnit && property.units && property.units.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-7">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-black text-blueprint">Grundrisse der Wohnungen</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Grundrisse je Wohneinheit — klicken Sie auf eine Wohnung, um den Grundriss hochzuladen
                  </p>
                </div>
              </div>

              {(() => {
                const unitsWithFloorplans = property.units.filter(
                  (u) => u.media?.some((m) => m.kind === "FLOORPLAN")
                );
                const unitsWithoutFloorplans = property.units.filter(
                  (u) => !u.media?.some((m) => m.kind === "FLOORPLAN")
                );

                if (unitsWithFloorplans.length === 0) {
                  return (
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
                      <span className="material-symbols-outlined text-3xl text-slate-300 mb-2 block">floor_lamp</span>
                      <p className="text-sm text-slate-500 font-bold">Noch keine Wohnungsgrundrisse</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Klicken Sie auf eine Wohnung oben und laden Sie dort den Grundriss hoch.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-5">
                    <div className={`grid gap-5 ${unitsWithFloorplans.length === 1 ? "grid-cols-1" : unitsWithFloorplans.length === 2 ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-3"}`}>
                      {unitsWithFloorplans.map((unit) => {
                        const fp = unit.media.find((m) => m.kind === "FLOORPLAN");
                        if (!fp) return null;
                        const isPdf = fp.storageKey.toLowerCase().endsWith(".pdf");
                        return (
                          <div
                            key={unit.id}
                            onClick={() => router.push(`/dashboard/properties/${unit.id}`)}
                            className="rounded-xl border border-slate-200 overflow-hidden hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer group"
                          >
                            {isPdf ? (
                              <div className="bg-slate-50 h-48 flex flex-col items-center justify-center gap-2">
                                <span className="material-symbols-outlined text-4xl text-primary">picture_as_pdf</span>
                                <span className="text-xs text-slate-400">PDF-Grundriss</span>
                              </div>
                            ) : (
                              <div className="bg-slate-50 relative" style={{ minHeight: "200px" }}>
                                <Image
                                  src={fp.storageKey}
                                  alt={`Grundriss ${unit.unitLabel || "Wohnung"}`}
                                  width={600}
                                  height={400}
                                  className="w-full h-auto object-contain"
                                />
                              </div>
                            )}
                            <div className="p-3 bg-white border-t border-slate-100">
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="text-sm font-black text-blueprint group-hover:text-primary transition-colors">
                                    {unit.unitLabel || "Wohnung"}
                                  </span>
                                  <p className="text-[10px] text-slate-400 mt-0.5">
                                    {unit.livingArea} m² · {unit.rooms || "–"} Zi. · {unit.bathrooms || "–"} Bad
                                  </p>
                                </div>
                                <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors text-lg">
                                  open_in_new
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {unitsWithoutFloorplans.length > 0 && (
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">warning</span>
                        {unitsWithoutFloorplans.length === 1
                          ? `${unitsWithoutFloorplans[0].unitLabel || "1 Wohnung"} hat noch keinen Grundriss`
                          : `${unitsWithoutFloorplans.length} Wohnungen haben noch keinen Grundriss`
                        }
                        {" — "}klicken Sie auf die Wohnung, um einen hochzuladen.
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Apartments section — for parent/MFH properties */}
          {!isUnit && (
            <div className="bg-white rounded-2xl border border-slate-200 p-7">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-black text-blueprint">
                    Wohnungen ({property.units?.length || 0})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Einzelne Wohnungen können separat oder als Paket verkauft werden
                  </p>
                </div>
                <button
                  onClick={() => setAddUnitOpen(true)}
                  className="bg-blueprint hover:bg-primary text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">add_home</span>
                  Wohnung hinzufügen
                </button>
              </div>

              {(!property.units || property.units.length === 0) ? (
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
                  <span className="material-symbols-outlined text-3xl text-slate-300 mb-2 block">apartment</span>
                  <p className="text-sm text-slate-500 font-bold">Noch keine Wohnungen angelegt</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Fügen Sie einzelne Wohnungen hinzu, um sie separat zu vermarkten.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {property.units.map((unit) => {
                    const unitPhotos = unit.media?.filter((m) => m.kind === "PHOTO") || [];
                    const unitFloorplans = unit.media?.filter((m) => m.kind === "FLOORPLAN") || [];
                    const heroPhoto = unitPhotos[0];
                    const unitListing = unit.listings?.[0];
                    const canCreateUnitListing = sellingMode !== "BUNDLE";
                    return (
                      <div
                        key={unit.id}
                        className="rounded-xl border border-slate-200 hover:border-primary/40 transition-all overflow-hidden"
                      >
                        <div
                          onClick={() => router.push(`/dashboard/properties/${unit.id}`)}
                          className="flex items-center gap-4 p-4 cursor-pointer group hover:bg-primary/[0.02]"
                        >
                          {heroPhoto ? (
                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                              <Image src={heroPhoto.storageKey} alt="" width={64} height={64} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                              <span className="material-symbols-outlined text-2xl text-slate-300">home</span>
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-blueprint">
                                {unit.unitLabel || "Wohnung"}
                              </span>
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {unit.type}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {unit.livingArea} m² · {unit.rooms || "–"} Zimmer · {unit.bathrooms || "–"} Bad
                              {unit.floor != null ? ` · ${unit.floor}. OG` : ""}
                            </p>
                          </div>

                          {unitListing ? (
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                              unitListing.status === "ACTIVE" ? "bg-emerald-50 text-emerald-600"
                              : unitListing.status === "DRAFT" ? "bg-amber-50 text-amber-600"
                              : "bg-slate-100 text-slate-500"
                            }`}>{unitListing.status}</span>
                          ) : canCreateUnitListing ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); createUnitListing(unit.id); }}
                              disabled={unitListingCreating === unit.id}
                              className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-60"
                            >
                              {unitListingCreating === unit.id ? "..." : "Inserat erstellen"}
                            </button>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400">Paketverkauf</span>
                          )}

                          <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors">
                            chevron_right
                          </span>
                        </div>

                        {/* Unit readiness indicators */}
                        <div className="px-4 pb-3 flex items-center gap-3 flex-wrap">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${unitPhotos.length >= 6 ? "text-emerald-600" : "text-amber-600"}`}>
                            <span className="material-symbols-outlined text-xs">{unitPhotos.length >= 6 ? "check_circle" : "warning"}</span>
                            {unitPhotos.length}/6 Fotos
                          </span>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${unitFloorplans.length > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                            <span className="material-symbols-outlined text-xs">{unitFloorplans.length > 0 ? "check_circle" : "radio_button_unchecked"}</span>
                            Grundriss
                          </span>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${unit.energyCert ? "text-emerald-600" : "text-slate-400"}`}>
                            <span className="material-symbols-outlined text-xs">{unit.energyCert ? "check_circle" : "radio_button_unchecked"}</span>
                            Energieausweis
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Selling Mode — for parent properties with units */}
          {!isUnit && property.units && property.units.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-7">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-black text-blueprint">Verkaufsmodus</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Wählen Sie, wie die Wohnungen vermarktet werden sollen
                  </p>
                </div>
                {savingMode && (
                  <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                )}
              </div>

              <div className="grid sm:grid-cols-3 gap-3 mb-6">
                {([
                  { value: "INDIVIDUAL" as SellingMode, label: "Einzelverkauf", sub: "Jede Wohnung einzeln vermarkten", icon: "person" },
                  { value: "BOTH" as SellingMode, label: "Beides", sub: "Einzeln und als Paket gleichzeitig", icon: "compare_arrows" },
                  { value: "BUNDLE" as SellingMode, label: "Paketverkauf", sub: "Alle Wohnungen als ein Paket", icon: "inventory_2" },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => saveSellingMode(opt.value)}
                    disabled={savingMode}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      sellingMode === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`material-symbols-outlined text-lg ${sellingMode === opt.value ? "text-primary" : "text-slate-400"}`}>
                        {opt.icon}
                      </span>
                      <span className={`text-sm font-black ${sellingMode === opt.value ? "text-blueprint" : "text-slate-600"}`}>
                        {opt.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">{opt.sub}</p>
                  </button>
                ))}
              </div>

              {/* Bundle info panel */}
              {(sellingMode === "BUNDLE" || sellingMode === "BOTH") && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-primary text-xl mt-0.5">inventory_2</span>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-blueprint mb-1">Paketverkauf aktiv</p>
                      <p className="text-xs text-slate-500 mb-3">
                        Das Gebäude-Inserat ({property.street} {property.houseNumber}) wird als Paket-Angebot für alle {property.units.length} Wohnungen verwendet.
                        {sellingMode === "BOTH" ? " Zusätzlich können einzelne Wohnungen eigene Inserate haben." : ""}
                      </p>
                      {!hasListing ? (
                        <button
                          onClick={createListing}
                          disabled={creating}
                          className="bg-primary hover:bg-primary-dark text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-all hover:scale-[1.01] shadow-lg shadow-primary/25 disabled:opacity-60 flex items-center gap-2"
                        >
                          <span className="material-symbols-outlined text-base">description</span>
                          {creating ? "Wird erstellt..." : "Paket-Inserat erstellen"}
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600">
                            Paket-Inserat vorhanden
                          </span>
                          <button
                            onClick={() => router.push(`/dashboard/listings/${property.listings[0].id}`)}
                            className="text-xs font-bold text-primary hover:text-primary-dark transition-colors"
                          >
                            Bearbeiten
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {sellingMode === "INDIVIDUAL" && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-slate-400 text-lg mt-0.5">info</span>
                    <p className="text-xs text-slate-500">
                      Jede Wohnung wird einzeln vermarktet. Erstellen Sie Inserate direkt bei den einzelnen Wohnungen oben.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

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
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-blueprint">Energieausweis</h2>
              {property.energyCert && !energyEditing && (
                <button
                  onClick={() => setEnergyEditing(true)}
                  className="text-xs font-bold text-primary hover:text-primary-dark transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                  Bearbeiten
                </button>
              )}
            </div>

            {property.energyCert && !energyEditing ? (
              <div className="grid sm:grid-cols-2 gap-y-5 gap-x-8">
                <Detail label="Typ" value={property.energyCert.type === "VERBRAUCH" ? "Verbrauchsausweis" : "Bedarfsausweis"} />
                <Detail label="Energieklasse" value={property.energyCert.energyClass} />
                <Detail label="Energieverbrauch" value={`${property.energyCert.energyValue} kWh/m²·a`} />
                <Detail label="Primärenergieträger" value={property.energyCert.primarySource} />
                <Detail label="Gültig bis" value={new Date(property.energyCert.validUntil).toLocaleDateString("de-DE")} />
              </div>
            ) : !energyEditing && !property.energyCert ? (
              <div className="text-center py-8">
                <span className="material-symbols-outlined text-4xl text-slate-300 mb-3 block">electric_bolt</span>
                <p className="text-sm text-slate-500 font-bold">Noch kein Energieausweis vorhanden</p>
                <p className="text-xs text-slate-400 mt-1 mb-4">Gesetzlich vorgeschrieben vor Veröffentlichung eines Inserats (GEG).</p>
                <button
                  onClick={() => setEnergyEditing(true)}
                  className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-all"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  Energieausweis hinzufügen
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Type selector */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3">Ausweistyp *</label>
                  <div className="flex gap-3">
                    {[
                      { v: "VERBRAUCH", l: "Verbrauchsausweis", sub: "Verbrauch" },
                      { v: "BEDARF", l: "Bedarfsausweis", sub: "Bedarf" },
                    ].map((t) => (
                      <button
                        key={t.v}
                        type="button"
                        onClick={() => setEnergyForm({ ...energyForm, type: t.v })}
                        className={`flex-1 p-3 rounded-xl border-2 transition-all text-left ${
                          energyForm.type === t.v
                            ? "border-primary bg-primary/5 text-blueprint"
                            : "border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <span className="text-sm font-bold block">{t.l}</span>
                        <span className="text-[10px] text-slate-400">{t.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  {/* Energy class */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Energieklasse *</label>
                    <div className="flex flex-wrap gap-2">
                      {["A+", "A", "B", "C", "D", "E", "F", "G", "H"].map((ec) => (
                        <button
                          key={ec}
                          type="button"
                          onClick={() => setEnergyForm({ ...energyForm, energyClass: ec })}
                          className={`w-10 h-10 rounded-lg border-2 text-xs font-black transition-all ${
                            energyForm.energyClass === ec
                              ? "border-primary bg-primary text-white"
                              : "border-slate-200 text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          {ec}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Energy value */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Energieverbrauch (kWh/m²·a) *</label>
                    <input
                      type="number"
                      value={energyForm.energyValue}
                      onChange={(e) => setEnergyForm({ ...energyForm, energyValue: e.target.value })}
                      placeholder="z.B. 125"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  {/* Primary source */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Primärenergieträger *</label>
                    <select
                      value={energyForm.primarySource}
                      onChange={(e) => setEnergyForm({ ...energyForm, primarySource: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    >
                      <option value="">Auswählen...</option>
                      <option value="Gas">Gas</option>
                      <option value="Öl">Öl</option>
                      <option value="Fernwärme">Fernwärme</option>
                      <option value="Strom">Strom</option>
                      <option value="Wärmepumpe">Wärmepumpe</option>
                      <option value="Solar">Solar</option>
                      <option value="Pellets">Pellets</option>
                    </select>
                  </div>

                  {/* Valid until */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Gültig bis *</label>
                    <input
                      type="date"
                      value={energyForm.validUntil}
                      onChange={(e) => setEnergyForm({ ...energyForm, validUntil: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                </div>

                {/* PDF upload */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Energieausweis-PDF (optional)</label>
                  {energyPdfName ? (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-primary/30 bg-primary/5">
                      <span className="material-symbols-outlined text-primary">picture_as_pdf</span>
                      <span className="text-sm text-blueprint font-medium flex-1 truncate">{energyPdfName}</span>
                      <button
                        type="button"
                        onClick={() => { setEnergyPdfName(null); setEnergyPdfAssetId(null); }}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">close</span>
                      </button>
                    </div>
                  ) : (
                    <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed transition-colors ${energyPdfUploading ? "border-primary/40 bg-primary/5" : "border-slate-200 hover:border-primary/40 cursor-pointer"}`}>
                      {energyPdfUploading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                          <span className="text-sm text-primary font-medium">Wird hochgeladen...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-slate-300">upload_file</span>
                          <span className="text-sm text-slate-400">PDF hochladen</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        disabled={energyPdfUploading}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setEnergyPdfUploading(true);
                          const form = new FormData();
                          form.append("file", file);
                          form.append("kind", "ENERGY_PDF");
                          const res = await fetch(`/api/properties/${id}/media`, { method: "POST", body: form });
                          if (res.ok) {
                            const asset = await res.json();
                            setEnergyPdfName(file.name);
                            setEnergyPdfAssetId(asset.id);
                          }
                          setEnergyPdfUploading(false);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={saveEnergyCert}
                    disabled={energySaving || !energyForm.energyClass || !energyForm.energyValue || !energyForm.primarySource || !energyForm.validUntil}
                    className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-all disabled:opacity-40 flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-base">check</span>
                    {energySaving ? "Wird gespeichert..." : "Speichern"}
                  </button>
                  <button
                    onClick={() => {
                      setEnergyEditing(false);
                      if (property.energyCert) {
                        setEnergyForm({
                          type: property.energyCert.type,
                          energyClass: property.energyCert.energyClass,
                          energyValue: String(property.energyCert.energyValue),
                          primarySource: property.energyCert.primarySource,
                          validUntil: property.energyCert.validUntil.slice(0, 10),
                        });
                      }
                    }}
                    className="text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Abbrechen
                  </button>
                  {property.energyCert && (
                    <button
                      onClick={deleteEnergyCert}
                      className="ml-auto text-xs font-bold text-red-500 hover:text-red-600 transition-colors flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                      Entfernen
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Expose details */}
          <TextImport propertyId={property.id} onImported={fetchProperty} />
          <ExposeFields
            propertyId={property.id}
            initialRooms={(property.roomProgram as { name: string; area: string }[] | null) || []}
            initialSpecs={(property.specifications as Record<string, Record<string, string>> | null) || {}}
            initialBuilding={(property.buildingInfo as Record<string, string> | null) || {}}
          />
        </div>

        {/* Right column — sticky sidebar */}
        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <div className="bg-blueprint rounded-2xl p-7 text-white">
            <h3 className="font-black mb-4">Status</h3>
            <div className="space-y-3">
              <StatusRow label="Immobilie gespeichert" done />
              <StatusRow label="Energieausweis" done={!!property.energyCert} />
              <StatusRow label="Fotos hochgeladen" done={photos.length >= 6} detail={`${photos.length}/6 mind.`} />
              {hasUnits ? (
                <>
                  <StatusRow label="Wohnungen angelegt" done={property.units.length > 0} detail={`${property.units.length} WE`} />
                  <StatusRow label="Verkaufsmodus gewählt" done={sellingMode !== "INDIVIDUAL" || property.units.some((u) => u.listings.length > 0)} />
                </>
              ) : (
                <StatusRow label="Inserat erstellt" done={hasListing} />
              )}
            </div>
          </div>

          {/* Unit listings overview for MFH */}
          {hasUnits && property.units.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-7">
              <h3 className="font-black text-blueprint mb-1">Inserate-Übersicht</h3>
              <p className="text-[10px] text-slate-400 mb-4">
                {sellingMode === "INDIVIDUAL" ? "Einzelverkauf" : sellingMode === "BUNDLE" ? "Paketverkauf" : "Einzel- & Paketverkauf"}
              </p>
              <div className="space-y-2">
                {(sellingMode === "BUNDLE" || sellingMode === "BOTH") && (
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm text-primary">inventory_2</span>
                      <span className="text-xs font-bold text-blueprint">Paket</span>
                    </div>
                    {hasListing ? (
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                        property.listings[0].status === "ACTIVE" ? "bg-emerald-50 text-emerald-600"
                        : property.listings[0].status === "DRAFT" ? "bg-amber-50 text-amber-600"
                        : "bg-slate-100 text-slate-500"
                      }`}>{property.listings[0].status}</span>
                    ) : (
                      <span className="text-[10px] text-slate-400">—</span>
                    )}
                  </div>
                )}
                {(sellingMode === "INDIVIDUAL" || sellingMode === "BOTH") && property.units.map((unit) => (
                  <div key={unit.id} className="flex items-center justify-between py-2">
                    <span className="text-xs font-bold text-blueprint">{unit.unitLabel || "WE"}</span>
                    {unit.listings[0] ? (
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                        unit.listings[0].status === "ACTIVE" ? "bg-emerald-50 text-emerald-600"
                        : unit.listings[0].status === "DRAFT" ? "bg-amber-50 text-amber-600"
                        : "bg-slate-100 text-slate-500"
                      }`}>{unit.listings[0].status}</span>
                    ) : (
                      <span className="text-[10px] text-slate-400">—</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Single property listings */}
          {!hasUnits && hasListing && (
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

      {/* Add Apartment Modal */}
      {addUnitOpen && (
        <div className="fixed inset-0 z-[200] overflow-y-auto">
          <div className="fixed inset-0 bg-blueprint/60 backdrop-blur-sm" onClick={() => setAddUnitOpen(false)} />
          <div className="relative flex justify-center p-4 min-h-full items-center">
            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-black text-blueprint">Wohnung hinzufügen</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Neue Wohneinheit unter {property.street} {property.houseNumber}
                  </p>
                </div>
                <button onClick={() => setAddUnitOpen(false)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                    Bezeichnung *
                  </label>
                  <input
                    type="text"
                    value={unitForm.unitLabel}
                    onChange={(e) => setUnitForm({ ...unitForm, unitLabel: e.target.value })}
                    placeholder="z.B. WE1, WE2, EG links"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                      Wohnfläche (m²) *
                    </label>
                    <input
                      type="number"
                      value={unitForm.livingArea}
                      onChange={(e) => setUnitForm({ ...unitForm, livingArea: e.target.value })}
                      placeholder="z.B. 95"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                      Zimmer
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={unitForm.rooms}
                      onChange={(e) => setUnitForm({ ...unitForm, rooms: e.target.value })}
                      placeholder="z.B. 3"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                      Badezimmer
                    </label>
                    <input
                      type="number"
                      value={unitForm.bathrooms}
                      onChange={(e) => setUnitForm({ ...unitForm, bathrooms: e.target.value })}
                      placeholder="1"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                      Etage
                    </label>
                    <input
                      type="number"
                      value={unitForm.floor}
                      onChange={(e) => setUnitForm({ ...unitForm, floor: e.target.value })}
                      placeholder="z.B. 0 = EG"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                </div>

                {/* Floor plan upload */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                    Grundriss (optional)
                  </label>
                  {unitFloorplan ? (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-primary/30 bg-primary/5">
                      <span className="material-symbols-outlined text-primary">description</span>
                      <span className="text-sm text-blueprint font-medium flex-1 truncate">{unitFloorplan.name}</span>
                      <button
                        type="button"
                        onClick={() => setUnitFloorplan(null)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">close</span>
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-slate-200 hover:border-primary/40 cursor-pointer transition-colors">
                      <span className="material-symbols-outlined text-slate-300">upload_file</span>
                      <span className="text-sm text-slate-400">PDF, JPG oder PNG</span>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && setUnitFloorplan(e.target.files[0])}
                      />
                    </label>
                  )}
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-primary text-xl mt-0.5">info</span>
                    <p className="text-xs text-slate-600">
                      Adresse, Ausstattung, Spezifikationen und Gebäudedaten werden automatisch vom Gebäude übernommen.
                      {property.roomProgram ? " Raumprogramm wird nach Bezeichnung gefiltert." : ""}
                    </p>
                  </div>
                </div>

                <button
                  onClick={createUnit}
                  disabled={unitCreating || !unitForm.unitLabel || !unitForm.livingArea}
                  className="w-full bg-primary hover:bg-primary-dark text-white py-3 rounded-xl font-black text-sm uppercase tracking-[0.18em] transition-all hover:scale-[1.01] shadow-lg shadow-primary/25 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">add_home</span>
                  {unitCreating ? "Wird erstellt..." : "Wohnung anlegen"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
