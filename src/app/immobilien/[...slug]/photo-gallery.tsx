"use client";

import { useState } from "react";
import Image from "next/image";

interface Photo {
  id: string;
  storageKey: string;
}

export default function PhotoGallery({ photos }: { photos: Photo[] }) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  if (photos.length === 0) return null;

  function next() {
    setLightbox((i) => (i !== null ? (i + 1) % photos.length : 0));
  }
  function prev() {
    setLightbox((i) => (i !== null ? (i - 1 + photos.length) % photos.length : 0));
  }

  return (
    <>
      {/* Grid */}
      <div className="max-w-6xl mx-auto px-6 pt-4">
        <div className="grid grid-cols-4 gap-2 rounded-2xl overflow-hidden max-h-[480px] cursor-pointer">
          <div
            className="col-span-2 row-span-2 relative aspect-[4/3]"
            onClick={() => setLightbox(0)}
          >
            <Image src={photos[0].storageKey} alt="" fill className="object-cover hover:brightness-90 transition" sizes="50vw" priority />
          </div>
          {photos.slice(1, 5).map((photo, i) => (
            <div
              key={photo.id}
              className="relative aspect-[4/3]"
              onClick={() => setLightbox(i + 1)}
            >
              <Image src={photo.storageKey} alt="" fill className="object-cover hover:brightness-90 transition" sizes="25vw" />
              {i === 3 && photos.length > 5 && (
                <div className="absolute inset-0 bg-blueprint/60 hover:bg-blueprint/50 transition flex items-center justify-center">
                  <span className="text-white font-black text-xl">+{photos.length - 5}</span>
                </div>
              )}
            </div>
          ))}
          {photos.length === 1 && (
            <>
              <div className="bg-slate-100" />
              <div className="bg-slate-100" />
              <div className="bg-slate-100" />
              <div className="bg-slate-100" />
            </>
          )}
        </div>
        {photos.length > 1 && (
          <button
            onClick={() => setLightbox(0)}
            className="mt-3 text-xs font-bold text-primary hover:text-primary-dark transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">photo_library</span>
            Alle {photos.length} Fotos anzeigen
          </button>
        )}
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div className="fixed inset-0 z-[300] bg-black/95 flex items-center justify-center" onClick={() => setLightbox(null)}>
          {/* Close */}
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors z-10"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>

          {/* Counter */}
          <div className="absolute top-6 left-6 text-white/60 text-sm font-bold z-10">
            {lightbox + 1} / {photos.length}
          </div>

          {/* Previous */}
          {photos.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors z-10"
            >
              <span className="material-symbols-outlined text-2xl">chevron_left</span>
            </button>
          )}

          {/* Image */}
          <div className="relative max-w-[90vw] max-h-[85vh] w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <Image
              src={photos[lightbox].storageKey}
              alt={`Foto ${lightbox + 1}`}
              fill
              className="object-contain"
              sizes="90vw"
              priority
            />
          </div>

          {/* Next */}
          {photos.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors z-10"
            >
              <span className="material-symbols-outlined text-2xl">chevron_right</span>
            </button>
          )}

          {/* Thumbnails */}
          {photos.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10 max-w-[80vw] overflow-x-auto no-scrollbar px-4">
              {photos.map((photo, i) => (
                <button
                  key={photo.id}
                  onClick={(e) => { e.stopPropagation(); setLightbox(i); }}
                  className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                    i === lightbox ? "border-primary scale-110" : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                >
                  <Image src={photo.storageKey} alt="" width={64} height={48} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
