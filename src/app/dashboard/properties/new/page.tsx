"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trackEvent, EVENTS } from "@/lib/posthog";

const PROPERTY_TYPES = [
  { value: "ETW", label: "Eigentumswohnung", sub: "Wohnung / Apartment", icon: "apartment" },
  { value: "EFH", label: "Einfamilienhaus", sub: "Freistehendes Haus", icon: "house" },
  { value: "MFH", label: "Mehrfamilienhaus", sub: "Bis 4 Wohneinheiten", icon: "holiday_village" },
  { value: "DHH", label: "Doppelhaushälfte", sub: "Haushälfte", icon: "other_houses" },
  { value: "RH", label: "Reihenhaus", sub: "Reihen- / Endhaus", icon: "other_houses" },
  { value: "GRUNDSTUECK", label: "Grundstück", sub: "Bauland / Fläche", icon: "landscape" },
];

const CONDITIONS = [
  { value: "ERSTBEZUG", label: "Erstbezug", sub: "Erstmalig bezogen" },
  { value: "NEUBAU", label: "Neubau", sub: "Neuwertig" },
  { value: "GEPFLEGT", label: "Gepflegt", sub: "Guter Zustand" },
  { value: "RENOVIERUNGS_BEDUERFTIG", label: "Renovierungsbedürftig", sub: "Teilsanierung nötig" },
  { value: "SANIERUNGS_BEDUERFTIG", label: "Sanierungsbedürftig", sub: "Umfangreiche Arbeiten" },
  { value: "ROHBAU", label: "Rohbau", sub: "Nur Gebäudehülle" },
];

const ENERGY_CLASSES = ["A+", "A", "B", "C", "D", "E", "F", "G", "H"];

const ATTRIBUTES = [
  "Balkon", "Terrasse", "Garten", "Garage", "Stellplatz",
  "Keller", "Aufzug", "Kamin", "Fußbodenheizung", "Einbauküche",
  "Smart Home", "Elektr. Rollläden", "Wärmepumpe",
];

const STEPS = ["Typ & Adresse", "Details", "Energieausweis", "Überprüfung"];

type FormData = {
  type: string;
  street: string;
  houseNumber: string;
  postcode: string;
  city: string;
  livingArea: string;
  plotArea: string;
  yearBuilt: string;
  rooms: string;
  bathrooms: string;
  floor: string;
  condition: string;
  attributes: string[];
  numberOfUnits: string;
  outdoorParking: string;
  undergroundParking: string;
  hasEnergyCert: boolean;
  energyCertType: string;
  energyValidUntil: string;
  energyClass: string;
  energyValue: string;
  energySource: string;
};

const initialForm: FormData = {
  type: "",
  street: "",
  houseNumber: "",
  postcode: "",
  city: "",
  livingArea: "",
  plotArea: "",
  yearBuilt: "",
  rooms: "",
  bathrooms: "",
  floor: "",
  condition: "",
  attributes: [],
  numberOfUnits: "",
  outdoorParking: "",
  undergroundParking: "",
  hasEnergyCert: true,
  energyCertType: "VERBRAUCH",
  energyValidUntil: "",
  energyClass: "",
  energyValue: "",
  energySource: "",
};

export default function NewPropertyPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isMFH = form.type === "MFH";

  function update(fields: Partial<FormData>) {
    setForm((prev) => ({ ...prev, ...fields }));
  }

  function toggleAttribute(attr: string) {
    setForm((prev) => ({
      ...prev,
      attributes: prev.attributes.includes(attr)
        ? prev.attributes.filter((a) => a !== attr)
        : [...prev.attributes, attr],
    }));
  }

  function canProceed() {
    if (step === 0) return form.type && form.street && form.houseNumber && form.postcode && form.city;
    if (step === 1) return form.livingArea && form.condition;
    if (step === 2) return !form.hasEnergyCert || (form.energyClass && form.energyValue && form.energySource && form.energyValidUntil);
    return true;
  }

  async function handleSubmit() {
    setError("");
    setLoading(true);

    try {
      const payload: Record<string, unknown> = {
        type: form.type,
        street: form.street,
        houseNumber: form.houseNumber,
        postcode: form.postcode,
        city: form.city,
        livingArea: parseFloat(form.livingArea),
        plotArea: form.plotArea ? parseFloat(form.plotArea) : null,
        yearBuilt: form.yearBuilt ? parseInt(form.yearBuilt) : null,
        rooms: form.rooms ? parseFloat(form.rooms) : null,
        bathrooms: form.bathrooms ? parseInt(form.bathrooms) : null,
        floor: form.floor ? parseInt(form.floor) : null,
        condition: form.condition,
        attributes: form.attributes.length > 0 ? form.attributes : null,
      };

      if (isMFH) {
        const buildingInfo: Record<string, string> = {};
        if (form.numberOfUnits) buildingInfo["Wohneinheiten"] = form.numberOfUnits;
        if (form.outdoorParking) buildingInfo["Außenstellplätze"] = form.outdoorParking;
        if (form.undergroundParking) buildingInfo["Tiefgaragenstellplätze"] = form.undergroundParking;
        if (Object.keys(buildingInfo).length > 0) {
          payload.buildingInfo = buildingInfo;
        }
      }

      if (form.hasEnergyCert && form.energyClass) {
        payload.energyCert = {
          type: form.energyCertType,
          validUntil: form.energyValidUntil,
          energyClass: form.energyClass,
          energyValue: parseFloat(form.energyValue),
          primarySource: form.energySource,
        };
      }

      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Immobilie konnte nicht erstellt werden");
      }

      const property = await res.json();
      trackEvent(EVENTS.PROPERTY_CREATED, { type: form.type, city: form.city, livingArea: form.livingArea });
      router.push(`/dashboard/properties/${property.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push("/dashboard/properties")}
          className="flex items-center gap-1 text-slate-400 hover:text-blueprint text-sm font-bold mb-4 transition-colors"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Zurück zu Immobilien
        </button>
        <h1 className="text-3xl font-black text-blueprint tracking-tight">
          Immobilie hinzufügen
        </h1>
        <p className="text-slate-500 mt-1">
          Geben Sie die Daten Ihrer Immobilie ein, um loszulegen.
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-10">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1">
            <div
              className={`h-1.5 rounded-full transition-colors ${
                i <= step ? "bg-primary" : "bg-slate-200"
              }`}
            />
            <p
              className={`text-[10px] font-black uppercase tracking-[0.15em] mt-2 ${
                i <= step ? "text-primary" : "text-slate-400"
              }`}
            >
              {label}
            </p>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 font-medium">
          {error}
        </div>
      )}

      <div>
        {/* Step 0: Type & Address */}
        {step === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-8">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">
                Immobilientyp
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {PROPERTY_TYPES.map((pt) => (
                  <button
                    key={pt.value}
                    type="button"
                    onClick={() => update({ type: pt.value })}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                      form.type === pt.value
                        ? "border-primary bg-primary/5 text-blueprint"
                        : "border-slate-200 hover:border-slate-300 text-slate-600"
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl">
                      {pt.icon}
                    </span>
                    <div>
                      <span className="text-sm font-bold block">{pt.label}</span>
                      <span className="text-[10px] text-slate-400">{pt.sub}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">
                Adresse
              </label>
              <div className="grid sm:grid-cols-4 gap-4">
                <div className="sm:col-span-3">
                  <input
                    type="text"
                    value={form.street}
                    onChange={(e) => update({ street: e.target.value })}
                    placeholder="Straße"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={form.houseNumber}
                    onChange={(e) => update({ houseNumber: e.target.value })}
                    placeholder="Nr."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-4 mt-4">
                <div>
                  <input
                    type="text"
                    value={form.postcode}
                    onChange={(e) => update({ postcode: e.target.value })}
                    placeholder="PLZ"
                    maxLength={5}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => update({ city: e.target.value })}
                    placeholder="Ort"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Details */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-6">
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                  {isMFH ? "Gesamtwohnfläche (m²) *" : "Wohnfläche (m²) *"}
                </label>
                <input
                  type="number"
                  value={form.livingArea}
                  onChange={(e) => update({ livingArea: e.target.value })}
                  placeholder={isMFH ? "z.B. 245" : "z.B. 85"}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                  Grundstücksfläche (m²)
                </label>
                <input
                  type="number"
                  value={form.plotArea}
                  onChange={(e) => update({ plotArea: e.target.value })}
                  placeholder="z.B. 450"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                  {isMFH ? "Zimmer (gesamt)" : "Zimmer"}
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={form.rooms}
                  onChange={(e) => update({ rooms: e.target.value })}
                  placeholder={isMFH ? "z.B. 8" : "z.B. 3"}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                  {isMFH ? "Badezimmer (gesamt)" : "Badezimmer"}
                </label>
                <input
                  type="number"
                  value={form.bathrooms}
                  onChange={(e) => update({ bathrooms: e.target.value })}
                  placeholder={isMFH ? "z.B. 3" : "z.B. 1"}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                  Baujahr
                </label>
                <input
                  type="number"
                  value={form.yearBuilt}
                  onChange={(e) => update({ yearBuilt: e.target.value })}
                  placeholder="z.B. 2000"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              {form.type === "ETW" && (
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                    Etage
                  </label>
                  <input
                    type="number"
                    value={form.floor}
                    onChange={(e) => update({ floor: e.target.value })}
                    placeholder="z.B. 2"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              )}
            </div>

            {/* MFH-specific fields */}
            {isMFH && (
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">
                  Mehrfamilienhaus-Details
                </label>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1.5">
                      Wohneinheiten
                    </label>
                    <input
                      type="number"
                      value={form.numberOfUnits}
                      onChange={(e) => update({ numberOfUnits: e.target.value })}
                      placeholder="z.B. 3"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1.5">
                      Außenstellplätze
                    </label>
                    <input
                      type="number"
                      value={form.outdoorParking}
                      onChange={(e) => update({ outdoorParking: e.target.value })}
                      placeholder="z.B. 10"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1.5">
                      Tiefgaragenplätze
                    </label>
                    <input
                      type="number"
                      value={form.undergroundParking}
                      onChange={(e) => update({ undergroundParking: e.target.value })}
                      placeholder="z.B. 6"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">
                Zustand *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {CONDITIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => update({ condition: c.value })}
                    className={`p-3 rounded-xl border-2 transition-all text-left ${
                      form.condition === c.value
                        ? "border-primary bg-primary/5 text-blueprint"
                        : "border-slate-200 hover:border-slate-300 text-slate-600"
                    }`}
                  >
                    <span className="text-sm font-bold block">{c.label}</span>
                    <span className="text-[10px] text-slate-400">{c.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">
                Ausstattung
              </label>
              <div className="flex flex-wrap gap-2">
                {ATTRIBUTES.map(
                  (attr) => (
                    <button
                      key={attr}
                      type="button"
                      onClick={() => toggleAttribute(attr)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        form.attributes.includes(attr)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-slate-200 text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      {attr}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Energy Certificate */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-blueprint">Energieausweis</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Gesetzlich vorgeschrieben für die Veröffentlichung eines Inserats (GEG).
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs font-bold text-slate-500">
                  {form.hasEnergyCert ? "Vorhanden" : "Nicht vorhanden"}
                </span>
                <input
                  type="checkbox"
                  checked={form.hasEnergyCert}
                  onChange={(e) => update({ hasEnergyCert: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20"
                />
              </label>
            </div>

            {form.hasEnergyCert && (
              <>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3">
                    Ausweistyp
                  </label>
                  <div className="flex gap-3">
                    {[
                      { v: "VERBRAUCH", l: "Verbrauchsausweis", sub: "Nach Verbrauch" },
                      { v: "BEDARF", l: "Bedarfsausweis", sub: "Nach Bedarf" },
                    ].map((t) => (
                      <button
                        key={t.v}
                        type="button"
                        onClick={() => update({ energyCertType: t.v })}
                        className={`flex-1 p-3 rounded-xl border-2 transition-all text-left ${
                          form.energyCertType === t.v
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
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                      Energieklasse
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {ENERGY_CLASSES.map((ec) => (
                        <button
                          key={ec}
                          type="button"
                          onClick={() => update({ energyClass: ec })}
                          className={`w-10 h-10 rounded-lg border-2 text-xs font-black transition-all ${
                            form.energyClass === ec
                              ? "border-primary bg-primary text-white"
                              : "border-slate-200 text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          {ec}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                      Energieverbrauch (kWh/m²·a)
                    </label>
                    <input
                      type="number"
                      value={form.energyValue}
                      onChange={(e) => update({ energyValue: e.target.value })}
                      placeholder="z.B. 125"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                      Primärenergieträger
                    </label>
                    <select
                      value={form.energySource}
                      onChange={(e) => update({ energySource: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    >
                      <option value="">Auswählen...</option>
                      <option value="gas">Gas</option>
                      <option value="oil">Öl</option>
                      <option value="district_heating">Fernwärme</option>
                      <option value="electricity">Strom</option>
                      <option value="heat_pump">Wärmepumpe</option>
                      <option value="solar">Solar</option>
                      <option value="pellets">Pellets</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                      Gültig bis
                    </label>
                    <input
                      type="date"
                      value={form.energyValidUntil}
                      onChange={(e) =>
                        update({ energyValidUntil: e.target.value })
                      }
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-6">
            <h3 className="font-black text-blueprint text-lg">
              Ihre Immobilie überprüfen
            </h3>

            <div className="grid sm:grid-cols-2 gap-6">
              <ReviewBlock label="Immobilientyp" value={`${PROPERTY_TYPES.find((t) => t.value === form.type)?.label || form.type} (${PROPERTY_TYPES.find((t) => t.value === form.type)?.sub || ""})`} />
              <ReviewBlock label="Adresse" value={`${form.street} ${form.houseNumber}, ${form.postcode} ${form.city}`} />
              <ReviewBlock label={isMFH ? "Gesamtwohnfläche" : "Wohnfläche"} value={`${form.livingArea} m²`} />
              {form.plotArea && <ReviewBlock label="Grundstücksfläche" value={`${form.plotArea} m²`} />}
              {form.rooms && <ReviewBlock label={isMFH ? "Zimmer (gesamt)" : "Zimmer"} value={form.rooms} />}
              {form.bathrooms && <ReviewBlock label={isMFH ? "Badezimmer (gesamt)" : "Badezimmer"} value={form.bathrooms} />}
              {form.yearBuilt && <ReviewBlock label="Baujahr" value={form.yearBuilt} />}
              <ReviewBlock label="Zustand" value={`${CONDITIONS.find((c) => c.value === form.condition)?.label || form.condition} (${CONDITIONS.find((c) => c.value === form.condition)?.sub || ""})`} />
              {isMFH && form.numberOfUnits && (
                <ReviewBlock label="Wohneinheiten" value={form.numberOfUnits} />
              )}
              {isMFH && (form.outdoorParking || form.undergroundParking) && (
                <ReviewBlock
                  label="Stellplätze"
                  value={[
                    form.outdoorParking ? `${form.outdoorParking} Außen` : "",
                    form.undergroundParking ? `${form.undergroundParking} Tiefgarage` : "",
                  ].filter(Boolean).join(", ")}
                />
              )}
              {form.hasEnergyCert && form.energyClass && (
                <ReviewBlock label="Energieklasse" value={`${form.energyClass} · ${form.energyValue} kWh/m²·a`} />
              )}
              {form.attributes.length > 0 && (
                <ReviewBlock label="Ausstattung" value={form.attributes.join(", ")} />
              )}
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-xl mt-0.5">
                  info
                </span>
                <div>
                  <p className="text-sm font-bold text-blueprint">
                    Nächste Schritte nach dem Speichern
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {isMFH
                      ? "Laden Sie Fotos hoch, legen Sie einzelne Wohnungen an und erstellen Sie Inserate — einzeln oder als Paket."
                      : "Laden Sie Fotos hoch (mind. 6), dann erstellen Sie ein Inserat mit KI-generierter Beschreibung und Preisstrategien."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blueprint disabled:opacity-30 disabled:hover:text-slate-500 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">
              arrow_back
            </span>
            Zurück
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed()}
              className="bg-blueprint hover:bg-primary text-white px-6 py-3 rounded-xl text-sm font-black uppercase tracking-[0.15em] transition-colors disabled:opacity-40 disabled:hover:bg-blueprint flex items-center gap-2"
            >
              Weiter
              <span className="material-symbols-outlined text-lg">
                arrow_forward
              </span>
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-primary hover:bg-primary-dark text-white px-8 py-3 rounded-xl text-sm font-black uppercase tracking-[0.18em] transition-all hover:scale-[1.02] shadow-lg shadow-primary/25 disabled:opacity-60 flex items-center gap-2"
            >
              {loading ? "Wird gespeichert..." : "Immobilie speichern"}
              <span className="material-symbols-outlined text-lg">check</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">
        {label}
      </div>
      <div className="text-sm font-bold text-blueprint">{value}</div>
    </div>
  );
}
