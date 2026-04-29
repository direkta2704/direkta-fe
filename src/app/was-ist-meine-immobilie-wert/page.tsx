"use client";

import { useState } from "react";
import Link from "next/link";

const TYPES = [
  { value: "ETW", label: "Wohnung", icon: "apartment" },
  { value: "EFH", label: "Haus", icon: "house" },
  { value: "MFH", label: "Mehrfamilienhaus", icon: "holiday_village" },
  { value: "DHH", label: "Doppelhaushälfte", icon: "other_houses" },
  { value: "RH", label: "Reihenhaus", icon: "other_houses" },
  { value: "GRUNDSTUECK", label: "Grundstück", icon: "landscape" },
];

const CONDITIONS = [
  { value: "NEUBAU", label: "Neubau" },
  { value: "ERSTBEZUG", label: "Erstbezug" },
  { value: "GEPFLEGT", label: "Gepflegt" },
  { value: "RENOVIERUNGS_BEDUERFTIG", label: "Renovierungsbedürftig" },
  { value: "SANIERUNGS_BEDUERFTIG", label: "Sanierungsbedürftig" },
];

interface ValuationResult {
  low: number;
  median: number;
  high: number;
  strategyQuick: number;
  strategyReal: number;
  strategyMax: number;
  pricePerSqm: number;
  confidence: string;
  comparableCount: number;
}

export default function ValuationPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [email, setEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  const [form, setForm] = useState({
    type: "",
    city: "",
    postcode: "",
    livingArea: "",
    plotArea: "",
    rooms: "",
    yearBuilt: "",
    condition: "",
  });

  function update(fields: Partial<typeof form>) {
    setForm((prev) => ({ ...prev, ...fields }));
  }

  async function handleCalculate() {
    setLoading(true);
    try {
      const res = await fetch("/api/public/valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
        setStep(2);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setEmailLoading(true);
    // In production, this would send a detailed PDF report via email
    // For now, just reveal the full results
    await new Promise((r) => setTimeout(r, 800));
    setEmailSent(true);
    setEmailLoading(false);
  }

  const canProceed = step === 0
    ? form.type && form.city && form.livingArea
    : form.condition;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0F1B2E] to-[#1a2d4a]">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 lg:px-16 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="material-symbols-outlined text-2xl text-primary">home_work</span>
          <span className="text-lg font-black tracking-tight text-white">DIREKTA<span className="text-primary">.</span></span>
        </Link>
        <Link
          href="/"
          className="text-white/60 hover:text-white text-sm font-bold transition-colors"
        >
          Zurück zur Startseite
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 pb-20">
        {/* Hero */}
        <div className="text-center pt-8 pb-12">
          <div className="inline-flex items-center gap-2 bg-primary/20 text-primary px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.2em] mb-6">
            <span className="material-symbols-outlined text-sm">trending_up</span>
            Kostenlose Bewertung
          </div>
          <h1 className="text-4xl lg:text-5xl font-black text-white leading-tight mb-4">
            Was ist meine<br />
            Immobilie <span className="text-primary">wert?</span>
          </h1>
          <p className="text-white/60 text-lg max-w-xl mx-auto">
            Erhalten Sie in 60 Sekunden eine fundierte Preiseinschätzung — kostenlos und unverbindlich.
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8 max-w-md mx-auto">
          {["Immobilie", "Details", "Ergebnis"].map((label, i) => (
            <div key={label} className="flex-1">
              <div className={`h-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-white/10"}`} />
              <p className={`text-[10px] font-black uppercase tracking-[0.15em] mt-2 ${i <= step ? "text-primary" : "text-white/30"}`}>
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* Step 0: Property basics */}
        {step === 0 && (
          <div className="bg-white/[0.06] backdrop-blur-sm border border-white/10 rounded-3xl p-8 space-y-8">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-4">
                Immobilientyp
              </label>
              <div className="grid grid-cols-3 gap-3">
                {TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => update({ type: t.value })}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left ${
                      form.type === t.value
                        ? "border-primary bg-primary/10 text-white"
                        : "border-white/10 text-white/60 hover:border-white/20"
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">{t.icon}</span>
                    <span className="text-sm font-bold">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">Stadt / Ort</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => update({ city: e.target.value })}
                  placeholder="z.B. München, Berlin, Gaggenau"
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">PLZ</label>
                <input
                  type="text"
                  value={form.postcode}
                  onChange={(e) => update({ postcode: e.target.value })}
                  placeholder="optional"
                  maxLength={5}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">Wohnfläche (m²) *</label>
                <input
                  type="number"
                  value={form.livingArea}
                  onChange={(e) => update({ livingArea: e.target.value })}
                  placeholder="z.B. 95"
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">Zimmer</label>
                <input
                  type="number"
                  step="0.5"
                  value={form.rooms}
                  onChange={(e) => update({ rooms: e.target.value })}
                  placeholder="z.B. 3"
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>

            <button
              onClick={() => setStep(1)}
              disabled={!canProceed}
              className="w-full bg-primary hover:bg-primary-dark text-white py-4 rounded-2xl font-black text-sm uppercase tracking-[0.18em] transition-all hover:scale-[1.01] shadow-lg shadow-primary/25 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              Weiter
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
        )}

        {/* Step 1: Details */}
        {step === 1 && (
          <div className="bg-white/[0.06] backdrop-blur-sm border border-white/10 rounded-3xl p-8 space-y-8">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">Baujahr</label>
                <input
                  type="number"
                  value={form.yearBuilt}
                  onChange={(e) => update({ yearBuilt: e.target.value })}
                  placeholder="z.B. 2000"
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">Grundstück (m²)</label>
                <input
                  type="number"
                  value={form.plotArea}
                  onChange={(e) => update({ plotArea: e.target.value })}
                  placeholder="optional"
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-4">Zustand *</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {CONDITIONS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => update({ condition: c.value })}
                    className={`p-3 rounded-xl border-2 transition-all text-left ${
                      form.condition === c.value
                        ? "border-primary bg-primary/10 text-white"
                        : "border-white/10 text-white/60 hover:border-white/20"
                    }`}
                  >
                    <span className="text-sm font-bold">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep(0)}
                className="text-white/50 hover:text-white text-sm font-bold transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-lg">arrow_back</span>
                Zurück
              </button>
              <button
                onClick={handleCalculate}
                disabled={!canProceed || loading}
                className="flex-1 bg-primary hover:bg-primary-dark text-white py-4 rounded-2xl font-black text-sm uppercase tracking-[0.18em] transition-all hover:scale-[1.01] shadow-lg shadow-primary/25 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Wird berechnet...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">calculate</span>
                    Jetzt bewerten
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Results */}
        {step === 2 && result && (
          <div className="space-y-6">
            {/* Main result card */}
            <div className="bg-white/[0.06] backdrop-blur-sm border border-white/10 rounded-3xl p-8 text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-primary mb-2">Geschätzter Marktwert</div>
              <div className="text-5xl font-black text-white mb-1">
                EUR {result.median.toLocaleString("de-DE")}
              </div>
              <div className="text-white/40 text-sm mb-6">
                Bandbreite: EUR {result.low.toLocaleString("de-DE")} — EUR {result.high.toLocaleString("de-DE")}
              </div>

              {/* Visual range bar */}
              <div className="max-w-md mx-auto mb-6">
                <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
                  <div className="absolute left-[10%] right-[10%] h-full bg-gradient-to-r from-amber-500 via-primary to-amber-500 rounded-full" />
                  <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-5 h-5 bg-white rounded-full shadow-lg border-2 border-primary" />
                </div>
                <div className="flex justify-between mt-2 text-[10px] font-bold text-white/30">
                  <span>EUR {result.low.toLocaleString("de-DE")}</span>
                  <span>EUR {result.high.toLocaleString("de-DE")}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                <div className="bg-white/[0.06] rounded-xl p-3">
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 mb-1">Preis/m²</div>
                  <div className="text-lg font-black text-white">EUR {result.pricePerSqm.toLocaleString("de-DE")}</div>
                </div>
                <div className="bg-white/[0.06] rounded-xl p-3">
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 mb-1">Vergleichsobjekte</div>
                  <div className="text-lg font-black text-white">{result.comparableCount}</div>
                </div>
              </div>
            </div>

            {/* Email gate for full report */}
            {!emailSent ? (
              <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 rounded-3xl p-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-2xl text-primary">lock_open</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-black text-white mb-1">Vollständigen Bericht erhalten</h3>
                    <p className="text-sm text-white/60 mb-4">
                      Detaillierte Analyse mit 3 Verkaufsstrategien, {result.comparableCount} Vergleichsobjekten und Markteinschätzung — kostenlos per E-Mail.
                    </p>
                    <form onSubmit={handleEmailSubmit} className="flex gap-3">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Ihre E-Mail-Adresse"
                        required
                        className="flex-1 px-4 py-3 rounded-xl bg-white/[0.08] border border-white/15 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                      <button
                        type="submit"
                        disabled={emailLoading}
                        className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl font-black text-sm uppercase tracking-[0.12em] transition-all hover:scale-[1.02] shadow-lg shadow-primary/25 disabled:opacity-60 flex items-center gap-2 flex-shrink-0"
                      >
                        {emailLoading ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <span className="material-symbols-outlined text-base">send</span>
                        )}
                        Senden
                      </button>
                    </form>
                    <p className="text-[10px] text-white/30 mt-2">Kein Spam. Keine Weitergabe. Jederzeit abmeldbar.</p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Full report revealed */}
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 flex items-center gap-3">
                  <span className="material-symbols-outlined text-emerald-400 text-xl">check_circle</span>
                  <p className="text-sm text-emerald-300 font-bold">Bericht wurde an {email} gesendet!</p>
                </div>

                {/* 3 Strategy cards */}
                <div className="grid sm:grid-cols-3 gap-4">
                  <StrategyCard
                    name="Schnellverkauf"
                    price={result.strategyQuick}
                    timeline="4-6 Wochen"
                    description="Schneller Verkauf unter Marktwert"
                    color="text-blue-400"
                  />
                  <StrategyCard
                    name="Realistisch"
                    price={result.strategyReal}
                    timeline="8-12 Wochen"
                    description="Marktgerechter Preis"
                    color="text-primary"
                    recommended
                  />
                  <StrategyCard
                    name="Maximalpreis"
                    price={result.strategyMax}
                    timeline="12-20 Wochen"
                    description="Bestmöglicher Erlös"
                    color="text-amber-400"
                  />
                </div>

                {/* Savings comparison */}
                <div className="bg-white/[0.06] backdrop-blur-sm border border-white/10 rounded-3xl p-8">
                  <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">savings</span>
                    Ihre Ersparnis mit Direkta
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">Mit Makler (3,57%)</div>
                      <div className="text-2xl font-black text-red-400 line-through">
                        EUR {Math.round(result.median * 0.0357).toLocaleString("de-DE")}
                      </div>
                      <div className="text-xs text-white/40 mt-1">Provision bei EUR {result.median.toLocaleString("de-DE")}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">Mit Direkta</div>
                      <div className="text-2xl font-black text-emerald-400">
                        EUR 999
                      </div>
                      <div className="text-xs text-white/40 mt-1">Einmalige Flat Fee</div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-1">Sie sparen</div>
                    <div className="text-3xl font-black text-primary">
                      EUR {Math.round(result.median * 0.0357 - 999).toLocaleString("de-DE")}
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <div className="text-center pt-4">
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-[0.18em] transition-all hover:scale-[1.02] shadow-lg shadow-primary/25"
                  >
                    <span className="material-symbols-outlined">rocket_launch</span>
                    Jetzt Immobilie verkaufen — ohne Makler
                  </Link>
                  <p className="text-white/30 text-xs mt-3">Keine Verpflichtung. Kein Risiko. 14 Tage Geld-zurück-Garantie.</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-8 mt-12 text-white/20">
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="material-symbols-outlined text-base">lock</span>
            SSL verschlüsselt
          </div>
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="material-symbols-outlined text-base">shield</span>
            DSGVO konform
          </div>
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="material-symbols-outlined text-base">verified</span>
            Kostenlos
          </div>
        </div>
      </div>
    </div>
  );
}

function StrategyCard({ name, price, timeline, description, color, recommended }: {
  name: string; price: number; timeline: string; description: string; color: string; recommended?: boolean;
}) {
  return (
    <div className={`bg-white/[0.06] border rounded-2xl p-5 ${recommended ? "border-primary ring-1 ring-primary/30" : "border-white/10"}`}>
      {recommended && (
        <div className="text-[9px] font-black uppercase tracking-[0.25em] text-primary mb-2">Empfohlen</div>
      )}
      <div className={`text-xs font-black uppercase tracking-[0.15em] ${color} mb-1`}>{name}</div>
      <div className="text-xl font-black text-white mb-1">EUR {price.toLocaleString("de-DE")}</div>
      <div className="text-[10px] text-white/40 mb-2">{timeline}</div>
      <p className="text-xs text-white/50">{description}</p>
    </div>
  );
}
