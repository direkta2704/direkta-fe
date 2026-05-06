"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";



interface PhotoClassification {
  roomType?: string;
  caption?: string;
  description?: string;
  lighting?: string;
  estimatedArea?: number;
  qualityScore?: number;
  features?: string[];
}

interface MediaItem {
  id: string;
  storageKey: string;
  fileName: string | null;
  kind: string;
  ordering: number;
  classification?: PhotoClassification | null;
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
  listings: { id: string; status: string; slug: string; askingPrice?: string | null }[];
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
  extras: unknown;
  tagline: string | null;
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
  listings: { id: string; status: string; slug: string; askingPrice?: string | null }[];
  media: MediaItem[];
  parent: { id: string; street: string; houseNumber: string; city: string } | null;
  units: UnitSummary[];
}

const TYPE_DE: Record<string, string> = {
  ETW: "Eigentumswohnung", EFH: "Einfamilienhaus", MFH: "Mehrfamilienhaus",
  DHH: "Doppelhaushälfte", RH: "Reihenhaus", GRUNDSTUECK: "Grundstück",
};

const CONDITION_DE: Record<string, string> = {
  ERSTBEZUG: "Erstbezug",
  NEUBAU: "Neubau",
  GEPFLEGT: "Gepflegt",
  RENOVIERUNGS_BEDUERFTIG: "Renovierungsbedürftig",
  SANIERUNGS_BEDUERFTIG: "Sanierungsbedürftig",
  ROHBAU: "Rohbau",
  KERNSANIERT: "Kernsaniert",
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
  const [modeProgress, setModeProgress] = useState("");
  const [pendingMode, setPendingMode] = useState<SellingMode | null>(null);
  const [unitListingCreating, setUnitListingCreating] = useState<string | null>(null);
  const [energyEditing, setEnergyEditing] = useState(false);
  const [detailsEditing, setDetailsEditing] = useState(false);
  const [editLivingArea, setEditLivingArea] = useState("");
  const [editPlotArea, setEditPlotArea] = useState("");
  const [editRooms, setEditRooms] = useState("");
  const [editBathrooms, setEditBathrooms] = useState("");
  const [editYearBuilt, setEditYearBuilt] = useState("");
  const [energySaving, setEnergySaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<MediaItem | null>(null);
  const [photoForm, setPhotoForm] = useState({ caption: "", description: "", roomType: "other" });
  const [photoSaving, setPhotoSaving] = useState(false);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [lightboxPhoto, setLightboxPhoto] = useState<MediaItem | null>(null);
  const [dragPhotoId, setDragPhotoId] = useState<string | null>(null);
  const [saveToast, setSaveToast] = useState(false);
  const [undoDelete, setUndoDelete] = useState<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const [showActivity, setShowActivity] = useState(false);
  const [showMobileQR, setShowMobileQR] = useState(false);
  const [extrasEditing, setExtrasEditing] = useState(false);
  const [extraForm, setExtraForm] = useState({ name: "", quantity: "1", pricePerUnit: "", description: "" });
  const [extrasSaving, setExtrasSaving] = useState(false);
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
    if (property) {
      setEditLivingArea(String(property.livingArea));
      setEditPlotArea(property.plotArea ? String(property.plotArea) : "");
      setEditRooms(property.rooms ? String(property.rooms) : "");
      setEditBathrooms(property.bathrooms ? String(property.bathrooms) : "");
      setEditYearBuilt(property.yearBuilt ? String(property.yearBuilt) : "");
    }
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

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        const listing = property?.listings?.[0];
        if (listing) downloadPdf(listing.id);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [property]);

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

  function requestSellingMode(mode: SellingMode) {
    setPendingMode(mode);
  }

  async function confirmSellingMode() {
    const mode = pendingMode;
    if (!mode) return;
    setPendingMode(null);
    setSellingMode(mode);
    setSavingMode(true);
    const existing = (property?.buildingInfo as Record<string, string>) || {};
    await fetch(`/api/properties/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buildingInfo: { ...existing, _sellingMode: mode } }),
    });

    if (!property) { setSavingMode(false); return; }

    const unitsToCreate = property.units.filter((u) => !u.listings.length);
    const needsPackage = (mode === "BUNDLE" || mode === "BOTH") && !property.listings.some((l) => l.status !== "CLOSED");
    const needsIndividual = (mode === "INDIVIDUAL" || mode === "BOTH") && unitsToCreate.length > 0;
    const totalListings = (needsPackage ? 1 : 0) + (needsIndividual ? unitsToCreate.length : 0);

    if (totalListings === 0) {
      setSavingMode(false);
      fetchProperty();
      return;
    }

    let created = 0;

    // Auto-create package listing if BUNDLE or BOTH
    if (needsPackage) {
      setModeProgress(`Paket-Inserat wird erstellt (${++created}/${totalListings})...`);
      await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: id }),
      });
    }

    // Auto-create individual listings if INDIVIDUAL or BOTH
    if (needsIndividual) {
      for (const unit of unitsToCreate) {
        setModeProgress(`Inserat für ${unit.unitLabel || "Wohnung"} wird erstellt (${++created}/${totalListings})...`);
        await fetch("/api/listings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ propertyId: unit.id }),
        });
      }
    }

    setModeProgress(created > 0 ? `✓ ${created} Inserat(e) erfolgreich erstellt` : "");
    setSavingMode(false);
    fetchProperty();
    if (created > 0) setTimeout(() => setModeProgress(""), 5000);
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
    // Soft-delete with 5 second undo window
    if (undoDelete) {
      clearTimeout(undoDelete.timer);
      await fetch(`/api/media/${undoDelete.id}`, { method: "DELETE" });
    }
    // Hide it immediately in UI
    if (property) {
      setProperty({ ...property, media: property.media.filter(m => m.id !== mediaId) });
    }
    const timer = setTimeout(async () => {
      await fetch(`/api/media/${mediaId}`, { method: "DELETE" });
      setUndoDelete(null);
      fetchProperty();
    }, 5000);
    setUndoDelete({ id: mediaId, timer });
  }

  function undoLastDelete() {
    if (!undoDelete) return;
    clearTimeout(undoDelete.timer);
    setUndoDelete(null);
    fetchProperty();
  }

  function showSaveToast() {
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  }

  function calcProgress(): number {
    if (!property) return 0;
    const checks = [
      !!property.type,
      !!(property.street && property.houseNumber && property.postcode && property.city),
      !!property.livingArea,
      !!property.condition,
      property.rooms != null,
      property.yearBuilt != null,
      !!property.energyCert,
      photos.length >= 1,
      property.media.some(m => m.kind === "FLOORPLAN"),
      hasListing,
    ];
    return Math.round(checks.filter(Boolean).length / checks.length * 100);
  }

  async function duplicateProperty() {
    if (!property) return;
    const res = await fetch("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: property.type,
        street: property.street,
        houseNumber: property.houseNumber,
        postcode: property.postcode,
        city: property.city,
        livingArea: property.livingArea,
        plotArea: property.plotArea,
        yearBuilt: property.yearBuilt,
        rooms: property.rooms,
        bathrooms: property.bathrooms,
        floor: property.floor,
        condition: property.condition,
        attributes: property.attributes,
      }),
    });
    if (res.ok) {
      const newProp = await res.json();
      router.push(`/dashboard/properties/${newProp.id}`);
    }
  }

  async function smartOrderPhotos() {
    if (photos.length < 2) return;
    const sorted = [...photos].sort((a, b) => {
      const typeOrder: Record<string, number> = { exterior: 0, living: 1, kitchen: 2, bedroom: 3, bathroom: 4, office: 5, balcony: 6, garden: 7, hallway: 8, garage: 9, basement: 10, other: 11 };
      const aType = typeOrder[a.classification?.roomType || "other"] ?? 11;
      const bType = typeOrder[b.classification?.roomType || "other"] ?? 11;
      if (aType !== bType) return aType - bType;
      return (b.classification?.qualityScore || 0) - (a.classification?.qualityScore || 0);
    });
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].ordering !== i) {
        await fetch(`/api/media/${sorted[i].id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ordering: i }),
        });
      }
    }
    fetchProperty();
    showSaveToast();
  }

  async function bulkDeletePhotos() {
    if (selectedPhotos.size === 0) return;
    if (!confirm(`${selectedPhotos.size} Foto${selectedPhotos.size > 1 ? "s" : ""} löschen?`)) return;
    for (const photoId of selectedPhotos) {
      await fetch(`/api/media/${photoId}`, { method: "DELETE" });
    }
    setSelectedPhotos(new Set());
    setBulkSelectMode(false);
    fetchProperty();
  }

  function togglePhotoSelect(photoId: string) {
    setSelectedPhotos(prev => {
      const next = new Set(prev);
      if (next.has(photoId)) next.delete(photoId); else next.add(photoId);
      return next;
    });
  }

  async function reorderPhotos(fromId: string, toId: string) {
    if (fromId === toId || !property) return;
    const currentPhotos = property.media.filter((m) => m.kind === "PHOTO");
    const fromIdx = currentPhotos.findIndex(p => p.id === fromId);
    const toIdx = currentPhotos.findIndex(p => p.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const reordered = [...currentPhotos];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].ordering !== i) {
        await fetch(`/api/media/${reordered[i].id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ordering: i }),
        });
      }
    }
    fetchProperty();
  }

  function getBestCoverPhoto(): string | null {
    const exteriors = photos.filter(p => p.classification?.roomType === "exterior");
    if (exteriors.length === 0) return null;
    return exteriors.sort((a, b) => (b.classification?.qualityScore || 0) - (a.classification?.qualityScore || 0))[0].id;
  }

  function qualityColor(score?: number): string {
    if (score == null) return "bg-slate-300";
    if (score >= 80) return "bg-emerald-500";
    if (score >= 60) return "bg-amber-500";
    return "bg-red-500";
  }

  function openPhotoEdit(photo: MediaItem) {
    const cls = photo.classification || {};
    setPhotoForm({
      caption: cls.caption || "",
      description: cls.description || "",
      roomType: cls.roomType || "other",
    });
    setEditingPhoto(photo);
  }

  async function savePhotoDescription() {
    if (!editingPhoto) return;
    setPhotoSaving(true);
    const existing = editingPhoto.classification || {};
    const updated = {
      ...existing,
      caption: photoForm.caption || undefined,
      description: photoForm.description || undefined,
      roomType: photoForm.roomType,
    };
    await fetch(`/api/media/${editingPhoto.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classification: updated }),
    });
    setPhotoSaving(false);
    setEditingPhoto(null);
    fetchProperty();
  }

  async function addExtra() {
    if (!extraForm.name) return;
    setExtrasSaving(true);
    const currentExtras = (property?.extras as { name: string; quantity: number; pricePerUnit: number; description: string }[]) || [];
    const newExtra = {
      name: extraForm.name,
      quantity: parseInt(extraForm.quantity) || 1,
      pricePerUnit: parseFloat(extraForm.pricePerUnit) || 0,
      description: extraForm.description,
    };
    await fetch(`/api/properties/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extras: [...currentExtras, newExtra] }),
    });
    setExtraForm({ name: "", quantity: "1", pricePerUnit: "", description: "" });
    setExtrasSaving(false);
    fetchProperty();
  }

  async function removeExtra(idx: number) {
    const currentExtras = (property?.extras as { name: string; quantity: number; pricePerUnit: number; description: string }[]) || [];
    const updated = currentExtras.filter((_, i) => i !== idx);
    await fetch(`/api/properties/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extras: updated }),
    });
    fetchProperty();
  }

  async function downloadPdf(listingId: string) {
    setPdfDownloading(true);
    try {
      const res = await fetch(`/api/listings/${listingId}/pdf`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = property?.unitLabel
          ? `Expose_${property.unitLabel.replace(/\s+/g, "_")}.pdf`
          : `Expose_${property?.street || ""}_${property?.houseNumber || ""}_${property?.city || ""}.pdf`.replace(/\s+/g, "_");
        a.click();
        URL.revokeObjectURL(url);
      } else {
        alert("PDF-Erstellung fehlgeschlagen.");
      }
    } catch {
      alert("PDF-Erstellung fehlgeschlagen.");
    }
    setPdfDownloading(false);
  }

  async function analyzePhotos() {
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/properties/${id}/analyze-photos`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        alert(`${data.analyzed} Fotos analysiert — Beschreibungen wurden generiert.`);
        fetchProperty();
      } else {
        alert("Analyse fehlgeschlagen.");
      }
    } catch {
      alert("Analyse fehlgeschlagen.");
    }
    setAnalyzing(false);
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

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vollständigkeit</span>
          <span className="text-[10px] font-black text-primary">{calcProgress()}%</span>
        </div>
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${calcProgress()}%` }} />
        </div>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-blueprint tracking-tight">
            {isUnit && property.unitLabel ? `${property.unitLabel} — ` : ""}{property.street} {property.houseNumber}
          </h1>
          <p className="text-slate-500 mt-1">
            {property.postcode} {property.city}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <select
              className="text-xs font-bold text-primary bg-primary/5 border border-primary/20 rounded-lg px-2.5 py-1.5 cursor-pointer hover:bg-primary/10 transition-colors focus:outline-none focus:ring-1 focus:ring-primary"
              value={property.type}
              onChange={async (e) => {
                await fetch(`/api/properties/${id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ type: e.target.value }),
                });
                fetchProperty();
                showSaveToast();
              }}
            >
              {Object.entries(TYPE_DE).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              className="text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 cursor-pointer hover:bg-slate-100 transition-colors focus:outline-none focus:ring-1 focus:ring-primary"
              value={property.condition}
              onChange={async (e) => {
                await fetch(`/api/properties/${id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ condition: e.target.value }),
                });
                fetchProperty();
                showSaveToast();
              }}
            >
              {Object.entries(CONDITION_DE).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-slate-400">format_quote</span>
            <input
              className="text-sm italic text-slate-600 bg-transparent border-b border-dashed border-slate-200 focus:border-primary focus:outline-none px-1 py-0.5 min-w-[200px] max-w-[500px] placeholder:text-slate-300"
              placeholder="Tagline eingeben (z.B. Drei Wohnungen. Ein Standard.)"
              defaultValue={property.tagline || ""}
              onBlur={async (e) => {
                const val = e.target.value.trim();
                if (val !== (property.tagline || "")) {
                  await fetch(`/api/properties/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tagline: val || null }),
                  });
                  fetchProperty();
                  showSaveToast();
                }
              }}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <button
            onClick={duplicateProperty}
            className="bg-white border border-slate-200 hover:border-slate-300 text-slate-500 px-3 py-3 rounded-xl text-sm transition-colors flex items-center gap-1.5"
            title="Immobilie duplizieren"
          >
            <span className="material-symbols-outlined text-lg">content_copy</span>
          </button>
          {hasListing && (
            <a
              href={`/immobilien/${property.listings[0].slug}`}
              target="_blank"
              className="bg-white border border-slate-200 hover:border-slate-300 text-slate-500 px-3 py-3 rounded-xl text-sm transition-colors flex items-center gap-1.5"
              title="Vorschau als Käufer"
            >
              <span className="material-symbols-outlined text-lg">visibility</span>
            </a>
          )}
          <button
            onClick={analyzePhotos}
            disabled={analyzing}
            className="bg-white border border-slate-200 hover:border-primary text-blueprint px-5 py-3 rounded-xl text-sm font-black uppercase tracking-[0.18em] transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-lg text-primary">{analyzing ? "hourglass_top" : "auto_awesome"}</span>
            {analyzing ? "Analysiert..." : "Fotos analysieren"}
          </button>
          {hasListing && (
            <>
              <button
                onClick={() => {
                  const hasAnalyzed = photos.some(p => p.classification?.caption);
                  if (!hasAnalyzed) {
                    if (!confirm("Die Fotos wurden noch nicht analysiert und die Texte nicht geprüft. Trotzdem PDF erstellen?")) return;
                  }
                  downloadPdf(property.listings[0].id);
                }}
                disabled={pdfDownloading}
                className="bg-white border border-slate-200 hover:border-primary text-blueprint px-5 py-3 rounded-xl text-sm font-black uppercase tracking-[0.18em] transition-colors flex items-center gap-2 disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-lg text-primary">{pdfDownloading ? "hourglass_top" : "download"}</span>
                {pdfDownloading ? "Wird erstellt..." : "PDF"}
              </button>
              <button
                onClick={() => {
                  const url = `${window.location.origin}/immobilien/${property.listings[0].slug}`;
                  const text = `${property.street} ${property.houseNumber}, ${property.postcode} ${property.city} — Exposé ansehen: ${url}`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                }}
                className="bg-[#25D366] hover:bg-[#20BD5A] text-white px-3 py-3 rounded-xl transition-colors flex items-center"
                title="Per WhatsApp teilen"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </button>
              <button
                onClick={() => {
                  const url = `${window.location.origin}/immobilien/${property.listings[0].slug}`;
                  const subject = `Exposé: ${property.street} ${property.houseNumber}, ${property.city}`;
                  const body = `Guten Tag,\n\nanbei das Exposé für die Immobilie ${property.street} ${property.houseNumber}, ${property.postcode} ${property.city}.\n\nOnline ansehen: ${url}\n\nMit freundlichen Grüßen`;
                  window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_self");
                }}
                className="bg-white border border-slate-200 hover:border-slate-300 text-slate-500 px-3 py-3 rounded-xl transition-colors flex items-center"
                title="Per E-Mail teilen"
              >
                <span className="material-symbols-outlined text-lg">mail</span>
              </button>
            </>
          )}
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
                <button
                  onClick={() => router.push(`/dashboard/listings/${property.listings[0].id}`)}
                  className="bg-blueprint hover:bg-primary text-white px-5 py-3 rounded-xl text-sm font-black uppercase tracking-[0.18em] transition-colors flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">description</span>
                  Inserat bearbeiten
                </button>
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
              <div>
                <h2 className="text-lg font-black text-blueprint">
                  Fotos ({photos.length}/30)
                </h2>
                {photos.length > 0 && <p className="text-[10px] text-slate-400 mt-0.5">Ziehen zum Sortieren · Klick zum Bearbeiten</p>}
              </div>
              <div className="flex items-center gap-2">
                {photos.length > 1 && (
                  <button
                    onClick={() => { setBulkSelectMode(!bulkSelectMode); setSelectedPhotos(new Set()); }}
                    className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors flex items-center gap-1.5 ${bulkSelectMode ? "bg-red-50 text-red-600 border border-red-200" : "bg-slate-50 text-slate-500 border border-slate-200 hover:border-slate-300"}`}
                  >
                    <span className="material-symbols-outlined text-sm">{bulkSelectMode ? "close" : "check_box"}</span>
                    {bulkSelectMode ? "Abbrechen" : "Auswählen"}
                  </button>
                )}
                {bulkSelectMode && selectedPhotos.size > 0 && (
                  <button
                    onClick={bulkDeletePhotos}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    {selectedPhotos.size} löschen
                  </button>
                )}
                {photos.length > 1 && photos.some(p => p.classification?.roomType) && (
                  <button
                    onClick={smartOrderPhotos}
                    className="bg-white border border-slate-200 hover:border-slate-300 text-slate-500 px-2.5 py-2 rounded-xl transition-colors flex items-center"
                    title="KI-optimierte Reihenfolge"
                  >
                    <span className="material-symbols-outlined text-base">auto_fix_high</span>
                  </button>
                )}
                <button
                  onClick={() => setShowMobileQR(true)}
                  className="bg-white border border-slate-200 hover:border-slate-300 text-slate-500 px-2.5 py-2 rounded-xl transition-colors flex items-center"
                  title="Vom Handy hochladen"
                >
                  <span className="material-symbols-outlined text-base">qr_code_2</span>
                </button>
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
                      oder klicken Sie auf &quot;Fotos hinzufügen&quot; · JPEG/PNG · max. 25 MB
                    </p>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {photos.map((photo, idx) => {
                    const isCoverSuggestion = getBestCoverPhoto() === photo.id;
                    const isSelected = selectedPhotos.has(photo.id);
                    const isDragTarget = dragPhotoId !== null && dragPhotoId !== photo.id;
                    return (
                      <div
                        key={photo.id}
                        draggable={!bulkSelectMode}
                        onDragStart={() => setDragPhotoId(photo.id)}
                        onDragEnd={() => setDragPhotoId(null)}
                        onDragOver={(e) => { e.preventDefault(); }}
                        onDrop={(e) => { e.preventDefault(); if (dragPhotoId) reorderPhotos(dragPhotoId, photo.id); setDragPhotoId(null); }}
                        onClick={() => {
                          if (bulkSelectMode) { togglePhotoSelect(photo.id); return; }
                          setLightboxPhoto(photo);
                        }}
                        className={`relative group rounded-xl overflow-hidden bg-slate-100 aspect-[4/3] cursor-pointer transition-all ${
                          isDragTarget ? "ring-2 ring-primary ring-offset-2" : ""
                        } ${isSelected ? "ring-2 ring-red-500 ring-offset-2" : ""
                        } ${dragPhotoId === photo.id ? "opacity-40" : ""}`}
                      >
                        <Image
                          src={photo.storageKey}
                          alt={photo.fileName || "Foto"}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 50vw, 33vw"
                        />

                        {/* Quality dot */}
                        <div className={`absolute top-2 left-2 w-3 h-3 rounded-full border-2 border-white shadow ${qualityColor(photo.classification?.qualityScore)}`} title={photo.classification?.qualityScore != null ? `Qualität: ${photo.classification.qualityScore}/100` : "Nicht analysiert"} />

                        {/* Cover suggestion badge */}
                        {isCoverSuggestion && idx !== 0 && (
                          <div className="absolute top-2 left-7 bg-amber-500 text-white text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shadow">Cover</div>
                        )}
                        {idx === 0 && (
                          <div className="absolute top-2 left-7 bg-primary text-white text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shadow">1.</div>
                        )}

                        {/* Bulk select checkbox */}
                        {bulkSelectMode && (
                          <div className={`absolute top-2 right-2 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${isSelected ? "bg-red-500 border-red-500" : "bg-white/80 border-slate-300"}`}>
                            {isSelected && <span className="material-symbols-outlined text-xs text-white">check</span>}
                          </div>
                        )}

                        {/* Caption + edit overlay on hover (non-bulk mode) */}
                        {!bulkSelectMode && (
                          <>
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 py-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <p className="text-[10px] text-white font-bold truncate">{photo.classification?.caption || photo.classification?.roomType || "Klick zum Bearbeiten"}</p>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteMedia(photo.id); }}
                              className="absolute top-2 right-2 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}

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

                {photos.length === 0 && (
                  <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">warning</span>
                    Mindestens 1 Foto erforderlich zum Veröffentlichen
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

                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!confirm(`Wohnung "${unit.unitLabel || "Wohnung"}" wirklich löschen? Alle Fotos und Inserate dieser Wohnung werden ebenfalls gelöscht.`)) return;
                              await fetch(`/api/properties/${unit.id}`, { method: "DELETE" });
                              fetchProperty();
                            }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Wohnung löschen"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>

                          <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors">
                            chevron_right
                          </span>
                        </div>

                        {/* Unit readiness indicators */}
                        <div className="px-4 pb-3 flex items-center gap-3 flex-wrap">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${unitPhotos.length >= 1 ? "text-emerald-600" : "text-amber-600"}`}>
                            <span className="material-symbols-outlined text-xs">{unitPhotos.length >= 1 ? "check_circle" : "warning"}</span>
                            {unitPhotos.length} Fotos
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

          {/* Extras & Stellplätze */}
          <div className="bg-white rounded-2xl border border-slate-200 p-7">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-black text-blueprint">Extras & Stellplätze</h2>
                <p className="text-xs text-slate-500 mt-0.5">Zusätzliche Leistungen mit separater Bepreisung</p>
              </div>
              <button
                onClick={() => setExtrasEditing(!extrasEditing)}
                className="text-xs font-black uppercase tracking-widest text-primary hover:text-primary-dark transition-colors"
              >
                {extrasEditing ? "Fertig" : "Bearbeiten"}
              </button>
            </div>

            {(() => {
              const extras = (property?.extras as { name: string; quantity: number; pricePerUnit: number; description: string }[]) || [];
              return extras.length === 0 && !extrasEditing ? (
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
                  <span className="material-symbols-outlined text-2xl text-slate-300 mb-1 block">local_parking</span>
                  <p className="text-sm text-slate-500 font-bold">Keine Extras angelegt</p>
                  <p className="text-xs text-slate-400 mt-1">z.B. Tiefgaragen-Stellplätze, Außenstellplätze, Kellerabteile</p>
                  <button
                    onClick={() => setExtrasEditing(true)}
                    className="mt-3 text-xs font-black uppercase tracking-widest text-primary hover:text-primary-dark"
                  >
                    Extra hinzufügen
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {extras.map((extra, idx) => (
                    <div key={idx} className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-lg text-primary">
                          {extra.name.toLowerCase().includes("garage") || extra.name.toLowerCase().includes("stellplatz") || extra.name.toLowerCase().includes("parking")
                            ? "local_parking"
                            : extra.name.toLowerCase().includes("keller")
                              ? "warehouse"
                              : "add_box"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-blueprint">{extra.name}</span>
                          <span className="text-[10px] text-slate-400">× {extra.quantity}</span>
                        </div>
                        {extra.description && <p className="text-xs text-slate-500 mt-0.5">{extra.description}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        {extra.pricePerUnit > 0 && (
                          <span className="text-sm font-black text-blueprint">
                            {extra.pricePerUnit.toLocaleString("de-DE")} € <span className="text-[10px] font-normal text-slate-400">/ Stk.</span>
                          </span>
                        )}
                        {extra.pricePerUnit > 0 && extra.quantity > 1 && (
                          <p className="text-[10px] text-slate-400">
                            Gesamt: {(extra.pricePerUnit * extra.quantity).toLocaleString("de-DE")} €
                          </p>
                        )}
                      </div>
                      {extrasEditing && (
                        <button
                          onClick={() => removeExtra(idx)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      )}
                    </div>
                  ))}

                  {extrasEditing && (
                    <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-white">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Neues Extra hinzufügen</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                        <input
                          className="col-span-2 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                          placeholder="Name (z.B. TG-Stellplatz)"
                          value={extraForm.name}
                          onChange={(e) => setExtraForm({ ...extraForm, name: e.target.value })}
                        />
                        <input
                          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                          placeholder="Anzahl"
                          type="number"
                          min="1"
                          value={extraForm.quantity}
                          onChange={(e) => setExtraForm({ ...extraForm, quantity: e.target.value })}
                        />
                        <input
                          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                          placeholder="Preis pro Stk. (€)"
                          type="number"
                          value={extraForm.pricePerUnit}
                          onChange={(e) => setExtraForm({ ...extraForm, pricePerUnit: e.target.value })}
                        />
                      </div>
                      <input
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary mb-3"
                        placeholder="Beschreibung (optional)"
                        value={extraForm.description}
                        onChange={(e) => setExtraForm({ ...extraForm, description: e.target.value })}
                      />
                      <button
                        onClick={addExtra}
                        disabled={!extraForm.name || extrasSaving}
                        className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-colors disabled:opacity-60"
                      >
                        {extrasSaving ? "Wird gespeichert..." : "Hinzufügen"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

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
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    {modeProgress && <span className="text-xs text-primary font-bold">{modeProgress}</span>}
                  </div>
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
                    onClick={() => requestSellingMode(opt.value)}
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
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-blueprint">Immobiliendetails</h2>
              {!detailsEditing ? (
                <button
                  onClick={() => setDetailsEditing(true)}
                  className="text-xs font-bold text-primary hover:text-primary-dark transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                  Bearbeiten
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={() => setDetailsEditing(false)} className="text-xs font-bold text-slate-400 hover:text-slate-600">Abbrechen</button>
                  <button
                    onClick={async () => {
                      await fetch(`/api/properties/${id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          livingArea: parseFloat(editLivingArea) || property.livingArea,
                          plotArea: editPlotArea ? parseFloat(editPlotArea) : property.plotArea,
                          rooms: editRooms ? parseFloat(editRooms) : property.rooms,
                          bathrooms: editBathrooms ? parseInt(editBathrooms) : property.bathrooms,
                          yearBuilt: editYearBuilt ? parseInt(editYearBuilt) : property.yearBuilt,
                        }),
                      });
                      setDetailsEditing(false);
                      fetchProperty();
                    }}
                    className="bg-primary hover:bg-primary-dark text-white px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-[0.15em]"
                  >
                    Speichern
                  </button>
                </div>
              )}
            </div>
            {detailsEditing ? (
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Wohnfläche (m²)</label>
                  <input type="number" value={editLivingArea} onChange={(e) => setEditLivingArea(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-blueprint outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Grundstück (m²)</label>
                  <input type="number" value={editPlotArea} onChange={(e) => setEditPlotArea(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-blueprint outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Zimmer</label>
                  <input type="number" value={editRooms} onChange={(e) => setEditRooms(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-blueprint outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Badezimmer</label>
                  <input type="number" value={editBathrooms} onChange={(e) => setEditBathrooms(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-blueprint outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Baujahr</label>
                  <input type="number" value={editYearBuilt} onChange={(e) => setEditYearBuilt(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-blueprint outline-none focus:border-primary" />
                </div>
              </div>
            ) : (
              <>
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
              </>
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
              <div className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-y-5 gap-x-8">
                  <Detail label="Typ" value={property.energyCert.type === "VERBRAUCH" ? "Verbrauchsausweis" : "Bedarfsausweis"} />
                  <Detail label="Energieklasse" value={property.energyCert.energyClass} />
                  <Detail label="Energieverbrauch" value={`${property.energyCert.energyValue} kWh/m²·a`} />
                  <Detail label="Primärenergieträger" value={property.energyCert.primarySource} />
                  <Detail label="Gültig bis" value={new Date(property.energyCert.validUntil).toLocaleDateString("de-DE")} />
                </div>
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">PDF-Dokument</p>
                {property.media.filter((m) => m.kind === "ENERGY_PDF").length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {property.media.filter((m) => m.kind === "ENERGY_PDF").map((pdf) => (
                        <div key={pdf.id} className="group/pdf relative inline-flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 transition-colors">
                          <a
                            href={pdf.storageKey}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-xs font-bold text-blueprint"
                          >
                            <span className="material-symbols-outlined text-base text-red-500">picture_as_pdf</span>
                            {pdf.fileName || "Energieausweis.pdf"}
                          </a>
                          <button
                            onClick={() => deleteMedia(pdf.id)}
                            className="w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-md flex items-center justify-center opacity-0 group-hover/pdf:opacity-100 transition-opacity"
                          >
                            <span className="material-symbols-outlined text-xs">close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-amber-300 bg-amber-50">
                    <span className="material-symbols-outlined text-amber-500">warning</span>
                    <span className="text-sm text-amber-700">Kein PDF hochgeladen — für die Veröffentlichung empfohlen</span>
                    <label className="ml-auto cursor-pointer bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                      Hochladen
                      <input type="file" accept=".pdf" hidden onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const form = new FormData();
                        form.append("file", file);
                        form.append("kind", "ENERGY_PDF");
                        await fetch(`/api/properties/${id}/media`, { method: "POST", body: form });
                        fetchProperty();
                      }} />
                    </label>
                  </div>
                )}
                </div>
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

        </div>

        {/* Right column — sticky sidebar */}
        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <div className="bg-blueprint rounded-2xl p-7 text-white">
            <h3 className="font-black mb-4">Status</h3>
            <div className="space-y-3">
              <StatusRow label="Immobilie gespeichert" done />
              <StatusRow label="Energieausweis" done={!!property.energyCert} />
              <StatusRow label="Fotos hochgeladen" done={photos.length >= 1} detail={`${photos.length} Fotos`} />
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

          {/* Listing Health Score */}
          {hasListing && (() => {
            const descWords = (property.listings[0] as unknown as { descriptionLong?: string }).descriptionLong?.split(/\s+/).length || 0;
            const titleLen = (property.listings[0] as unknown as { titleShort?: string }).titleShort?.length || 0;
            const items = [
              { label: "Titel", ok: titleLen >= 20, pts: titleLen >= 40 ? 10 : titleLen >= 20 ? 7 : 0, max: 10 },
              { label: "Beschreibung", ok: descWords >= 150, pts: descWords >= 250 ? 20 : descWords >= 150 ? 15 : descWords >= 50 ? 10 : 0, max: 20 },
              { label: "Preis", ok: !!property.listings[0].askingPrice, pts: property.listings[0].askingPrice ? 10 : 0, max: 10 },
              { label: "Fotos", ok: photos.length >= 3, pts: Math.min(25, Math.round((photos.length / 12) * 25)), max: 25 },
              { label: "Energieausweis", ok: !!property.energyCert, pts: property.energyCert ? 10 : 0, max: 10 },
              { label: "Grundriss", ok: property.media.some(m => m.kind === "FLOORPLAN"), pts: property.media.some(m => m.kind === "FLOORPLAN") ? 5 : 0, max: 5 },
              { label: "Ausstattung", ok: (property.attributes as string[] || []).length >= 3, pts: Math.min(10, ((property.attributes as string[] || []).length) * 2), max: 10 },
            ];
            const score = items.reduce((s, i) => s + i.pts, 0);
            const maxScore = items.reduce((s, i) => s + i.max, 0);
            const pct = Math.round(score / maxScore * 100);
            const color = pct >= 80 ? "text-emerald-500" : pct >= 50 ? "text-amber-500" : "text-red-500";
            const bgColor = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
            const weakest = items.filter(i => !i.ok).slice(0, 2);

            return (
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-black text-blueprint flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">health_and_safety</span>
                    Inserat-Gesundheit
                  </h3>
                  <span className={`text-2xl font-black ${color}`}>{pct}</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
                  <div className={`h-full rounded-full transition-all ${bgColor}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="space-y-1.5">
                  {items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px]">
                      <span className={`flex items-center gap-1 ${item.ok ? "text-slate-400" : "text-amber-600 font-bold"}`}>
                        <span className="material-symbols-outlined text-xs">{item.ok ? "check_circle" : "warning"}</span>
                        {item.label}
                      </span>
                      <span className="text-slate-400">{item.pts}/{item.max}</span>
                    </div>
                  ))}
                </div>
                {weakest.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-[10px] text-amber-700 font-bold">Verbessern: {weakest.map(w => w.label).join(", ")}</p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Activity log */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <button
              onClick={() => setShowActivity(!showActivity)}
              className="w-full flex items-center justify-between"
            >
              <h3 className="text-sm font-black text-blueprint flex items-center gap-2">
                <span className="material-symbols-outlined text-base">history</span>
                Aktivitäten
              </h3>
              <span className="material-symbols-outlined text-slate-400 text-sm">{showActivity ? "expand_less" : "expand_more"}</span>
            </button>
            {showActivity && (
              <div className="mt-4 space-y-3">
                {[
                  ...(property.createdAt ? [{ icon: "add_home", text: "Immobilie erstellt", date: property.createdAt }] : []),
                  ...(property.energyCert ? [{ icon: "bolt", text: "Energieausweis hinzugefügt", date: property.createdAt }] : []),
                  ...photos.slice(0, 3).map(p => ({ icon: "photo_camera", text: `Foto hochgeladen: ${p.fileName || "Foto"}`, date: p.ordering === 0 ? property.createdAt : property.createdAt })),
                  ...(hasListing ? [{ icon: "description", text: "Inserat erstellt", date: property.listings[0]?.slug ? property.createdAt : property.createdAt }] : []),
                  ...(property.units.length > 0 ? [{ icon: "apartment", text: `${property.units.length} Wohnungen angelegt`, date: property.createdAt }] : []),
                ].slice(0, 8).map((event, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="material-symbols-outlined text-xs text-slate-400">{event.icon}</span>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">{event.text}</p>
                      <p className="text-[10px] text-slate-400">{new Date(event.date).toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" })}</p>
                    </div>
                  </div>
                ))}
                {photos.length === 0 && !property.energyCert && !hasListing && (
                  <p className="text-xs text-slate-400">Noch keine Aktivitäten.</p>
                )}
              </div>
            )}
          </div>

          {/* Price consistency warning */}
          {hasUnits && sellingMode === "BOTH" && (() => {
            const packagePrice = property.listings[0]?.askingPrice ? Number(property.listings[0].askingPrice) : 0;
            const individualTotal = property.units.reduce((sum, u) => {
              const unitPrice = u.listings[0]?.askingPrice ? Number(u.listings[0].askingPrice) : 0;
              return sum + unitPrice;
            }, 0);
            if (packagePrice > 0 && individualTotal > 0 && individualTotal <= packagePrice) {
              return (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-0">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-amber-600 text-lg mt-0.5">warning</span>
                    <div>
                      <p className="text-sm font-bold text-amber-800">Preiswarnung</p>
                      <p className="text-xs text-amber-700 mt-1">
                        Einzelverkauf gesamt (€{individualTotal.toLocaleString("de-DE")}) ≤ Paketpreis (€{packagePrice.toLocaleString("de-DE")}).
                        Der Einzelverkauf sollte in Summe mehr ergeben als der Paketpreis, sonst gibt es keinen Anreiz für Einzelkäufer.
                      </p>
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Unit listings overview for MFH */}
          {hasUnits && property.units.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-7">
              <h3 className="font-black text-blueprint mb-1">Inserate-Übersicht</h3>
              <p className="text-[10px] text-slate-400 mb-4">
                {sellingMode === "INDIVIDUAL" ? "Einzelverkauf" : sellingMode === "BUNDLE" ? "Paketverkauf" : "Einzel- & Paketverkauf"}
              </p>
              <div className="space-y-2">
                {(sellingMode === "BUNDLE" || sellingMode === "BOTH") && (
                  <div className="group/listing flex items-center justify-between py-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm text-primary">inventory_2</span>
                      <span className="text-xs font-bold text-blueprint">Paket</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasListing ? (
                        <>
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                            property.listings[0].status === "ACTIVE" ? "bg-emerald-50 text-emerald-600"
                            : property.listings[0].status === "DRAFT" ? "bg-amber-50 text-amber-600"
                            : "bg-slate-100 text-slate-500"
                          }`}>{property.listings[0].status}</span>
                          {property.listings[0].status !== "ACTIVE" && (
                            <button
                              onClick={async () => {
                                if (!confirm("Paket-Inserat wirklich löschen?")) return;
                                await fetch(`/api/listings/${property.listings[0].id}`, { method: "DELETE" });
                                fetchProperty();
                              }}
                              className="opacity-0 group-hover/listing:opacity-100 transition-opacity text-red-400 hover:text-red-600"
                              title="Inserat löschen"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="text-[10px] text-slate-400">—</span>
                      )}
                    </div>
                  </div>
                )}
                {(sellingMode === "INDIVIDUAL" || sellingMode === "BOTH") && property.units.map((unit) => (
                  <div key={unit.id} className="group/listing flex items-center justify-between py-2">
                    <span className="text-xs font-bold text-blueprint">{unit.unitLabel || "WE"}</span>
                    <div className="flex items-center gap-2">
                      {unit.listings[0] ? (
                        <>
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                            unit.listings[0].status === "ACTIVE" ? "bg-emerald-50 text-emerald-600"
                            : unit.listings[0].status === "DRAFT" ? "bg-amber-50 text-amber-600"
                            : "bg-slate-100 text-slate-500"
                          }`}>{unit.listings[0].status}</span>
                          {unit.listings[0].status !== "ACTIVE" && (
                            <button
                              onClick={async () => {
                                if (!confirm(`Inserat für ${unit.unitLabel} wirklich löschen?`)) return;
                                await fetch(`/api/listings/${unit.listings[0].id}`, { method: "DELETE" });
                                fetchProperty();
                              }}
                              className="opacity-0 group-hover/listing:opacity-100 transition-opacity text-red-400 hover:text-red-600"
                              title="Inserat löschen"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="text-[10px] text-slate-400">—</span>
                      )}
                    </div>
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
      {/* Mobile QR Upload Modal */}
      {showMobileQR && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="fixed inset-0 bg-blueprint/60 backdrop-blur-sm" onClick={() => setShowMobileQR(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
            <button onClick={() => setShowMobileQR(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <span className="material-symbols-outlined">close</span>
            </button>
            <span className="material-symbols-outlined text-4xl text-primary mb-3 block">phone_iphone</span>
            <h3 className="text-lg font-black text-blueprint mb-2">Vom Handy hochladen</h3>
            <p className="text-sm text-slate-500 mb-5">Scannen Sie den QR-Code mit Ihrem Handy, um direkt Fotos hochzuladen.</p>
            <div className="bg-white p-3 rounded-xl border border-slate-200 inline-block mb-4">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${typeof window !== "undefined" ? window.location.origin : ""}/dashboard/properties/${id}`)}`}
                alt="QR Code"
                width={200}
                height={200}
              />
            </div>
            <p className="text-[10px] text-slate-400">Öffnet diese Seite auf Ihrem Handy — dort können Sie Fotos direkt von der Kamera hochladen.</p>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxPhoto && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90" onClick={() => setLightboxPhoto(null)}>
          <button onClick={() => setLightboxPhoto(null)} className="absolute top-4 right-4 text-white/60 hover:text-white z-10">
            <span className="material-symbols-outlined text-3xl">close</span>
          </button>
          {/* Prev */}
          {(() => { const idx = photos.findIndex(p => p.id === lightboxPhoto.id); return idx > 0 ? (
            <button onClick={(e) => { e.stopPropagation(); setLightboxPhoto(photos[idx - 1]); }} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white z-10">
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
          ) : null; })()}
          {/* Next */}
          {(() => { const idx = photos.findIndex(p => p.id === lightboxPhoto.id); return idx < photos.length - 1 ? (
            <button onClick={(e) => { e.stopPropagation(); setLightboxPhoto(photos[idx + 1]); }} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white z-10">
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          ) : null; })()}
          <div onClick={(e) => e.stopPropagation()} className="relative max-w-[90vw] max-h-[85vh]">
            <img src={lightboxPhoto.storageKey} alt="" className="max-w-full max-h-[85vh] object-contain rounded-lg" />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 rounded-b-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-bold text-sm">{lightboxPhoto.classification?.caption || "Kein Titel"}</p>
                  <p className="text-white/60 text-xs mt-0.5">
                    {photos.findIndex(p => p.id === lightboxPhoto.id) + 1} / {photos.length}
                    {lightboxPhoto.classification?.qualityScore != null && ` · Qualität: ${lightboxPhoto.classification.qualityScore}/100`}
                  </p>
                </div>
                <button
                  onClick={() => { openPhotoEdit(lightboxPhoto); setLightboxPhoto(null); }}
                  className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                  Bearbeiten
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo Edit Modal */}
      {editingPhoto && (
        <div className="fixed inset-0 z-[200] overflow-y-auto">
          <div className="fixed inset-0 bg-blueprint/60 backdrop-blur-sm" onClick={() => setEditingPhoto(null)} />
          <div className="relative flex justify-center p-4 min-h-full items-center">
            <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-8">
              <button onClick={() => setEditingPhoto(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
              <div className="rounded-xl overflow-hidden bg-slate-100 aspect-[4/3] mb-6 relative">
                <Image src={editingPhoto.storageKey} alt="" fill className="object-cover" sizes="500px" />
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1.5">Raumtyp</label>
                  <select
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                    value={photoForm.roomType}
                    onChange={(e) => setPhotoForm({ ...photoForm, roomType: e.target.value })}
                  >
                    <option value="exterior">Außenansicht</option>
                    <option value="living">Wohnzimmer</option>
                    <option value="kitchen">Küche</option>
                    <option value="bathroom">Badezimmer</option>
                    <option value="bedroom">Schlafzimmer</option>
                    <option value="office">Arbeitszimmer</option>
                    <option value="hallway">Flur</option>
                    <option value="balcony">Balkon</option>
                    <option value="garden">Garten</option>
                    <option value="garage">Garage / Stellplatz</option>
                    <option value="basement">Keller</option>
                    <option value="other">Sonstiges</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1.5">Titel / Caption</label>
                  <input
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                    placeholder="z.B. Wohn-/Essbereich mit Küchenanschlüssen"
                    value={photoForm.caption}
                    onChange={(e) => setPhotoForm({ ...photoForm, caption: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1.5">Beschreibung</label>
                  <textarea
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none"
                    rows={3}
                    placeholder="Beschreiben Sie, was in diesem Foto zu sehen ist..."
                    value={photoForm.description}
                    onChange={(e) => setPhotoForm({ ...photoForm, description: e.target.value })}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setEditingPhoto(null)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={savePhotoDescription}
                    disabled={photoSaving}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-black uppercase tracking-widest transition-colors disabled:opacity-60"
                  >
                    {photoSaving ? "Speichert..." : "Speichern"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
      {/* Sales mode confirmation dialog */}
      {pendingMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPendingMode(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-8" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-black text-blueprint mb-2">
              {pendingMode === "INDIVIDUAL" ? "Einzelverkauf" : pendingMode === "BUNDLE" ? "Paketverkauf" : "Einzel- & Paketverkauf"}
            </h3>
            <div className="bg-slate-50 rounded-xl p-4 mb-5 space-y-2 text-sm text-slate-600">
              {pendingMode === "INDIVIDUAL" && (
                <>
                  <p>Jede Wohnung wird <strong>einzeln vermarktet</strong> mit eigenem Inserat, eigener Beschreibung und eigenem Preis.</p>
                  <p>Es werden <strong>{property?.units.filter((u) => !u.listings.length).length || 0} Inserate</strong> automatisch erstellt — jeweils mit KI-Beschreibung und Preisempfehlung.</p>
                  <p className="text-xs text-slate-400">Ideal wenn Sie verschiedene Käufer für die einzelnen Wohnungen suchen.</p>
                </>
              )}
              {pendingMode === "BUNDLE" && (
                <>
                  <p>Alle Wohnungen werden <strong>als ein Paket</strong> angeboten. Ein Inserat für das gesamte Gebäude.</p>
                  <p>Es wird <strong>1 Paket-Inserat</strong> automatisch erstellt — mit KI-Beschreibung und Preisempfehlung.</p>
                  <p className="text-xs text-slate-400">Ideal für Investoren die das gesamte Objekt kaufen möchten.</p>
                </>
              )}
              {pendingMode === "BOTH" && (
                <>
                  <p>Das Gebäude wird <strong>gleichzeitig als Paket und einzeln</strong> angeboten — maximale Reichweite.</p>
                  <p>Es werden <strong>{(property?.units.filter((u) => !u.listings.length).length || 0) + (property?.listings.some((l) => l.status !== "CLOSED") ? 0 : 1)} Inserate</strong> automatisch erstellt — jeweils mit KI-Beschreibung und Preisempfehlung.</p>
                  <p className="text-xs text-slate-400">Wer zuerst kauft: Ein Investor nimmt das Paket, oder einzelne Käufer kaufen die Wohnungen.</p>
                </>
              )}
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setPendingMode(null)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:text-blueprint transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={confirmSellingMode}
                className="bg-primary hover:bg-primary-dark text-white px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-[0.15em] transition-all hover:scale-[1.02] shadow-lg shadow-primary/25 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">check</span>
                Bestätigen & Inserate erstellen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-save toast */}
      {saveToast && (
        <div className="fixed bottom-6 right-6 z-[300] bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <span className="material-symbols-outlined text-base">check_circle</span>
          <span className="text-sm font-bold">Gespeichert</span>
        </div>
      )}

      {/* Undo delete toast */}
      {undoDelete && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] bg-blueprint text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3">
          <span className="material-symbols-outlined text-base">delete</span>
          <span className="text-sm">Foto gelöscht</span>
          <button
            onClick={undoLastDelete}
            className="text-sm font-black text-primary hover:text-white underline underline-offset-2 transition-colors"
          >
            Rückgängig
          </button>
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
