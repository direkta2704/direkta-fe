"use client";

import { useState } from "react";

interface Room { name: string; area: string }
interface SpecEntry { key: string; value: string }

interface Props {
  propertyId: string;
  initialRooms: Room[];
  initialSpecs: Record<string, Record<string, string>>;
  initialBuilding: Record<string, string>;
}

const SPEC_CATEGORIES = [
  "Boden", "Waende & Decke", "Sanitaer", "Heizung & Warmwasser",
  "Elektro & Smart Home", "Kueche", "Tueren & Fenster",
];

export default function ExposeFields({ propertyId, initialRooms, initialSpecs, initialBuilding }: Props) {
  const [rooms, setRooms] = useState<Room[]>(initialRooms.length > 0 ? initialRooms : [{ name: "", area: "" }]);
  const [specs, setSpecs] = useState<Record<string, SpecEntry[]>>(() => {
    const result: Record<string, SpecEntry[]> = {};
    for (const cat of SPEC_CATEGORIES) {
      const existing = initialSpecs[cat];
      result[cat] = existing
        ? Object.entries(existing).map(([key, value]) => ({ key, value }))
        : [{ key: "", value: "" }];
    }
    return result;
  });
  const [building, setBuilding] = useState<SpecEntry[]>(() => {
    return Object.keys(initialBuilding).length > 0
      ? Object.entries(initialBuilding).map(([key, value]) => ({ key, value }))
      : [{ key: "", value: "" }];
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);

  function addRoom() { setRooms([...rooms, { name: "", area: "" }]); }
  function removeRoom(i: number) { setRooms(rooms.filter((_, idx) => idx !== i)); }
  function updateRoom(i: number, field: "name" | "area", value: string) {
    const updated = [...rooms]; updated[i] = { ...updated[i], [field]: value }; setRooms(updated);
  }

  function addSpec(cat: string) { setSpecs({ ...specs, [cat]: [...specs[cat], { key: "", value: "" }] }); }
  function removeSpec(cat: string, i: number) { setSpecs({ ...specs, [cat]: specs[cat].filter((_, idx) => idx !== i) }); }
  function updateSpec(cat: string, i: number, field: "key" | "value", value: string) {
    const updated = { ...specs, [cat]: [...specs[cat]] }; updated[cat][i] = { ...updated[cat][i], [field]: value }; setSpecs(updated);
  }

  function addBuilding() { setBuilding([...building, { key: "", value: "" }]); }
  function removeBuilding(i: number) { setBuilding(building.filter((_, idx) => idx !== i)); }
  function updateBuilding(i: number, field: "key" | "value", value: string) {
    const updated = [...building]; updated[i] = { ...updated[i], [field]: value }; setBuilding(updated);
  }

  async function handleSave() {
    setSaving(true); setSaved(false);

    const roomProgram = rooms.filter((r) => r.name && r.area).map((r) => ({ name: r.name, area: parseFloat(r.area) }));

    const specifications: Record<string, Record<string, string>> = {};
    for (const [cat, entries] of Object.entries(specs)) {
      const filtered = entries.filter((e) => e.key && e.value);
      if (filtered.length > 0) specifications[cat] = Object.fromEntries(filtered.map((e) => [e.key, e.value]));
    }

    const buildingInfo = Object.fromEntries(building.filter((e) => e.key && e.value).map((e) => [e.key, e.value]));

    await fetch(`/api/properties/${propertyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomProgram, specifications, buildingInfo }),
    });

    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function toggle(section: string) { setOpenSection(openSection === section ? null : section); }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-blueprint">Expose-Details</h2>
          <p className="text-xs text-slate-500 mt-0.5">Detaillierte Angaben fuer das Expose PDF</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blueprint hover:bg-primary text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors disabled:opacity-60 flex items-center gap-2"
        >
          {saving ? "Wird gespeichert..." : saved ? "Gespeichert!" : "Speichern"}
        </button>
      </div>

      {/* Room Program */}
      <Section title="Raumprogramm" subtitle="Raeume mit Flaeche in m²" open={openSection === "rooms"} onToggle={() => toggle("rooms")}>
        <div className="space-y-2">
          {rooms.map((r, i) => (
            <div key={i} className="flex items-center gap-3">
              <input type="text" value={r.name} onChange={(e) => updateRoom(i, "name", e.target.value)} placeholder="z.B. Wohnen/Essen" className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm text-blueprint outline-none focus:border-primary transition-colors" />
              <input type="number" value={r.area} onChange={(e) => updateRoom(i, "area", e.target.value)} placeholder="m²" step="0.01" className="w-24 px-3 py-2 rounded-lg border border-slate-200 text-sm text-blueprint outline-none focus:border-primary transition-colors" />
              <button onClick={() => removeRoom(i)} className="w-8 h-8 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
          ))}
          <button onClick={addRoom} className="text-xs font-bold text-primary hover:text-primary-dark flex items-center gap-1 transition-colors">
            <span className="material-symbols-outlined text-sm">add</span> Raum hinzufuegen
          </button>
        </div>
      </Section>

      {/* Specifications by category */}
      {SPEC_CATEGORIES.map((cat) => (
        <Section key={cat} title={cat} subtitle="Material / Ausfuehrung" open={openSection === cat} onToggle={() => toggle(cat)}>
          <div className="space-y-2">
            {specs[cat].map((entry, i) => (
              <div key={i} className="flex items-center gap-3">
                <input type="text" value={entry.key} onChange={(e) => updateSpec(cat, i, "key", e.target.value)} placeholder="z.B. Wohnbereich" className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm text-blueprint outline-none focus:border-primary transition-colors" />
                <input type="text" value={entry.value} onChange={(e) => updateSpec(cat, i, "value", e.target.value)} placeholder="z.B. Eichenparkett, geoelt" className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm text-blueprint outline-none focus:border-primary transition-colors" />
                <button onClick={() => removeSpec(cat, i)} className="w-8 h-8 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors">
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
            ))}
            <button onClick={() => addSpec(cat)} className="text-xs font-bold text-primary hover:text-primary-dark flex items-center gap-1 transition-colors">
              <span className="material-symbols-outlined text-sm">add</span> Eintrag hinzufuegen
            </button>
          </div>
        </Section>
      ))}

      {/* Building Info */}
      <Section title="Gebaeude-Informationen" subtitle="Allgemeine Angaben zum Gebaeude" open={openSection === "building"} onToggle={() => toggle("building")}>
        <div className="space-y-2">
          {building.map((entry, i) => (
            <div key={i} className="flex items-center gap-3">
              <input type="text" value={entry.key} onChange={(e) => updateBuilding(i, "key", e.target.value)} placeholder="z.B. Stellplaetze" className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm text-blueprint outline-none focus:border-primary transition-colors" />
              <input type="text" value={entry.value} onChange={(e) => updateBuilding(i, "value", e.target.value)} placeholder="z.B. 10 Aussen, 6 Tiefgarage" className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm text-blueprint outline-none focus:border-primary transition-colors" />
              <button onClick={() => removeBuilding(i)} className="w-8 h-8 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
          ))}
          <button onClick={addBuilding} className="text-xs font-bold text-primary hover:text-primary-dark flex items-center gap-1 transition-colors">
            <span className="material-symbols-outlined text-sm">add</span> Eintrag hinzufuegen
          </button>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, subtitle, open, onToggle, children }: {
  title: string; subtitle: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50/50 transition-colors">
        <div>
          <h3 className="font-black text-blueprint text-sm">{title}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        <span className={`material-symbols-outlined text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}>
          expand_more
        </span>
      </button>
      {open && <div className="px-5 pb-5 border-t border-slate-100 pt-4">{children}</div>}
    </div>
  );
}
