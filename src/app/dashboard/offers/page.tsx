"use client";

import { useEffect, useState } from "react";

interface Offer {
  id: string;
  amount: string;
  status: string;
  scoreAmount: number | null;
  scoreFinance: number | null;
  scoreTiming: number | null;
  scoreRisk: number | null;
  scoreComposite: number | null;
  conditions: string | null;
  desiredClosingAt: string | null;
  createdAt: string;
  buyer: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    idVerifiedAt: string | null;
  };
  transactionId: string | null;
  listing: {
    id: string;
    askingPrice: string;
    property: { street: string; houseNumber: string; city: string };
  };
}

const STATUS_DE: Record<string, { label: string; color: string }> = {
  SUBMITTED: { label: "Eingereicht", color: "bg-blue-50 text-blue-600" },
  UNDER_REVIEW: { label: "In Prüfung", color: "bg-amber-50 text-amber-600" },
  ACCEPTED: { label: "Angenommen", color: "bg-emerald-50 text-emerald-600" },
  REJECTED: { label: "Abgelehnt", color: "bg-red-50 text-red-500" },
  WITHDRAWN: { label: "Zurückgezogen", color: "bg-slate-100 text-slate-500" },
  COUNTERED: { label: "Gegenangebot", color: "bg-violet-50 text-violet-600" },
};

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState<string[]>([]);
  const [accepting, setAccepting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/offers")
      .then((r) => r.json())
      .then((data) => setOffers(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  function toggleCompare(id: string) {
    setComparing((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  }

  async function handleAccept(id: string) {
    if (!confirm("Angebot wirklich annehmen? Alle anderen Angebote werden abgelehnt und das Inserat wird reserviert.")) return;
    setAccepting(id);
    const res = await fetch(`/api/offers/${id}/accept`, { method: "POST" });
    if (res.ok) {
      setOffers((prev) =>
        prev.map((o) => ({
          ...o,
          status: o.id === id ? "ACCEPTED" : o.status === "SUBMITTED" || o.status === "UNDER_REVIEW" ? "REJECTED" : o.status,
        }))
      );
    }
    setAccepting(null);
  }

  async function handleReject(id: string) {
    await fetch(`/api/offers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "REJECTED" }),
    });
    setOffers((prev) => prev.map((o) => (o.id === id ? { ...o, status: "REJECTED" } : o)));
  }

  const [counterOfferId, setCounterOfferId] = useState<string | null>(null);
  const [counterAmount, setCounterAmount] = useState("");

  async function handleCounter(id: string) {
    if (!counterAmount) return;
    await fetch(`/api/offers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COUNTERED", counterAmount: parseFloat(counterAmount) }),
    });
    setOffers((prev) => prev.map((o) => (o.id === id ? { ...o, status: "COUNTERED" } : o)));
    setCounterOfferId(null);
    setCounterAmount("");
  }

  const activeOffers = offers.filter((o) => o.status === "SUBMITTED" || o.status === "UNDER_REVIEW");
  const compareOffers = offers.filter((o) => comparing.includes(o.id));

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-blueprint tracking-tight">Angebote</h1>
          <p className="text-slate-500 mt-1">
            {offers.length} Angebot{offers.length !== 1 ? "e" : ""} · Bewertet und sortiert nach Gesamtscore.
          </p>
        </div>
        {comparing.length >= 2 && (
          <button
            onClick={() => document.getElementById("compare-section")?.scrollIntoView({ behavior: "smooth" })}
            className="bg-primary hover:bg-primary-dark text-white px-5 py-3 rounded-xl text-sm font-black uppercase tracking-[0.18em] transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">compare</span>
            {comparing.length} vergleichen
          </button>
        )}
      </div>

      {/* Score weights info */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        <WeightCard label="Betrag" weight="30%" icon="payments" />
        <WeightCard label="Finanzierung" weight="30%" icon="credit_score" />
        <WeightCard label="Zeitrahmen" weight="20%" icon="schedule" />
        <WeightCard label="Risiko" weight="20%" icon="shield" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : offers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
          <span className="material-symbols-outlined text-5xl text-slate-300 mb-4 block">handshake</span>
          <h2 className="text-xl font-black text-blueprint mb-2">Noch keine Angebote</h2>
          <p className="text-slate-500 max-w-md mx-auto">
            Wenn Käufer Angebote für Ihr Inserat abgeben, erscheinen diese hier mit automatischer Bewertung.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Offer cards */}
          <div className="space-y-4">
            {offers.map((offer) => {
              const asking = Number(offer.listing.askingPrice);
              const amt = Number(offer.amount);
              const pctDiff = ((amt - asking) / asking) * 100;
              const status = STATUS_DE[offer.status] || { label: offer.status, color: "bg-slate-100 text-slate-500" };
              const isActive = offer.status === "SUBMITTED" || offer.status === "UNDER_REVIEW";

              return (
                <div
                  key={offer.id}
                  className={`bg-white rounded-2xl border p-6 transition-all ${
                    comparing.includes(offer.id) ? "border-primary ring-2 ring-primary/20" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${status.color}`}>
                          {status.label}
                        </span>
                        <span className={`text-sm font-black ${pctDiff >= 0 ? "text-emerald-600" : pctDiff >= -5 ? "text-amber-600" : "text-red-500"}`}>
                          {pctDiff >= 0 ? "+" : ""}{pctDiff.toFixed(1)}% vom Angebotspreis
                        </span>
                      </div>
                      <div className="text-2xl font-black text-blueprint">€{amt.toLocaleString("de-DE")}</div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-slate-500">von <strong>{offer.buyer.name}</strong></span>
                        {/* Contact buttons */}
                        {offer.buyer.phone && (
                          <a href={`tel:${offer.buyer.phone}`} className="w-6 h-6 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100" title="Anrufen">
                            <span className="material-symbols-outlined text-xs">call</span>
                          </a>
                        )}
                        <a href={`mailto:${offer.buyer.email}`} className="w-6 h-6 rounded bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100" title="E-Mail">
                          <span className="material-symbols-outlined text-xs">mail</span>
                        </a>
                        {offer.buyer.phone && (
                          <a href={`https://wa.me/${offer.buyer.phone.replace(/[^0-9+]/g, "")}`} target="_blank" className="w-6 h-6 rounded bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100" title="WhatsApp">
                            <span className="material-symbols-outlined text-xs">chat</span>
                          </a>
                        )}
                        {/* Verification badges */}
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${offer.buyer.idVerifiedAt ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
                          {offer.buyer.idVerifiedAt ? "✓ ID verifiziert" : "✗ ID nicht verifiziert"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                        <span>Eingereicht {new Date(offer.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                        {offer.desiredClosingAt && <span>· Abschluss bis {new Date(offer.desiredClosingAt).toLocaleDateString("de-DE")}</span>}
                        <span>· {offer.listing.property.street} {offer.listing.property.houseNumber}, {offer.listing.property.city}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-black text-primary">{offer.scoreComposite ?? "–"}</div>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Gesamtscore</div>
                    </div>
                  </div>

                  {/* Sub-scores */}
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    <ScoreBar label="Betrag" score={offer.scoreAmount} />
                    <ScoreBar label="Finanzierung" score={offer.scoreFinance} />
                    <ScoreBar label="Zeitrahmen" score={offer.scoreTiming} />
                    <ScoreBar label="Risiko" score={offer.scoreRisk} />
                  </div>

                  {offer.conditions && (
                    <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 mb-4">
                      <strong>Bedingungen:</strong> {offer.conditions}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                    {isActive && (
                      <>
                        <button
                          onClick={() => handleAccept(offer.id)}
                          disabled={accepting === offer.id}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-[0.15em] transition-colors flex items-center gap-1.5 disabled:opacity-60"
                        >
                          <span className="material-symbols-outlined text-sm">check</span>
                          {accepting === offer.id ? "Wird angenommen..." : "Annehmen"}
                        </button>
                        <button
                          onClick={() => setCounterOfferId(counterOfferId === offer.id ? null : offer.id)}
                          className="bg-white border border-violet-200 hover:bg-violet-50 text-violet-600 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-[0.15em] transition-colors flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-sm">swap_horiz</span>
                          Gegenangebot
                        </button>
                        <button
                          onClick={() => handleReject(offer.id)}
                          className="bg-white border border-red-200 hover:bg-red-50 text-red-600 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-[0.15em] transition-colors flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-sm">close</span>
                          Ablehnen
                        </button>
                      </>
                    )}
                    {/* Counter-offer input */}
                    {counterOfferId === offer.id && (
                      <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-200">
                        <span className="text-xs text-slate-400">€</span>
                        <input
                          type="number"
                          value={counterAmount}
                          onChange={(e) => setCounterAmount(e.target.value)}
                          placeholder="Ihr Preis"
                          className="w-32 px-3 py-2 rounded-lg border border-slate-200 text-sm text-blueprint outline-none focus:border-violet-400"
                          autoFocus
                        />
                        <button
                          onClick={() => handleCounter(offer.id)}
                          disabled={!counterAmount}
                          className="bg-violet-500 hover:bg-violet-600 text-white px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-40"
                        >
                          Senden
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => toggleCompare(offer.id)}
                      className={`ml-auto px-4 py-2 rounded-lg text-xs font-black uppercase tracking-[0.15em] transition-colors flex items-center gap-1.5 ${
                        comparing.includes(offer.id)
                          ? "bg-primary/10 text-primary border border-primary/30"
                          : "bg-slate-50 border border-slate-200 text-slate-500 hover:text-blueprint"
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">compare</span>
                      {comparing.includes(offer.id) ? "Ausgewählt" : "Vergleichen"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Side-by-side comparison */}
          {compareOffers.length >= 2 && (
            <div id="compare-section" className="bg-white rounded-2xl border border-primary/30 p-7">
              <h2 className="text-lg font-black text-blueprint mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">compare</span>
                Angebotsvergleich
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 pr-6 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 w-40"></th>
                      {compareOffers.map((o) => (
                        <th key={o.id} className="text-center py-3 px-4 min-w-[160px]">
                          <div className="font-black text-blueprint">{o.buyer.name}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <CompareRow label="Betrag" values={compareOffers.map((o) => `€${Number(o.amount).toLocaleString("de-DE")}`)} />
                    <CompareRow label="Abweichung" values={compareOffers.map((o) => {
                      const pct = ((Number(o.amount) - Number(o.listing.askingPrice)) / Number(o.listing.askingPrice)) * 100;
                      return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
                    })} />
                    <CompareRow label="Gesamtscore" values={compareOffers.map((o) => String(o.scoreComposite ?? "–"))} highlight />
                    <CompareRow label="Betrag-Score" values={compareOffers.map((o) => String(o.scoreAmount ?? "–"))} />
                    <CompareRow label="Finanzierung" values={compareOffers.map((o) => String(o.scoreFinance ?? "–"))} />
                    <CompareRow label="Zeitrahmen" values={compareOffers.map((o) => String(o.scoreTiming ?? "–"))} />
                    <CompareRow label="Risiko" values={compareOffers.map((o) => String(o.scoreRisk ?? "–"))} />
                    <CompareRow label="Abschluss" values={compareOffers.map((o) => o.desiredClosingAt ? new Date(o.desiredClosingAt).toLocaleDateString("de-DE") : "–")} />
                    <CompareRow label="Bedingungen" values={compareOffers.map((o) => o.conditions || "Keine")} />
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Reservation agreement + Notary checklist for accepted offers */}
          {offers.some((o) => o.status === "ACCEPTED") && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-7">
              {/* Reservierungsvereinbarung download */}
              {offers.find((o) => o.status === "ACCEPTED")?.transactionId && (
                <div className="bg-white rounded-xl p-5 mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-emerald-800 flex items-center gap-2">
                      <span className="material-symbols-outlined">description</span>
                      Reservierungsvereinbarung
                    </h3>
                    <p className="text-xs text-emerald-700 mt-1">
                      PDF mit Kaufpreis, Parteien, Bedingungen und Notar-Checkliste
                    </p>
                  </div>
                  <a
                    href={`/api/transactions/${offers.find((o) => o.status === "ACCEPTED")!.transactionId}/reservation-pdf`}
                    target="_blank"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-base">download</span>
                    PDF herunterladen
                  </a>
                </div>
              )}

              {/* Commission savings */}
              {(() => {
                const accepted = offers.find((o) => o.status === "ACCEPTED");
                if (!accepted) return null;
                const price = Number(accepted.amount);
                const saved = Math.round(price * 0.0357);
                return (
                  <div className="bg-white rounded-xl p-5 mb-6 flex items-center justify-between">
                    <div>
                      <h3 className="font-black text-emerald-800 flex items-center gap-2">
                        <span className="material-symbols-outlined">savings</span>
                        Maklerkosten gespart
                      </h3>
                      <p className="text-xs text-emerald-700 mt-1">
                        Bei einem traditionellen Makler (3,57%) hätten Sie Provision gezahlt.
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-emerald-600">€{saved.toLocaleString("de-DE")}</div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500">gespart</div>
                    </div>
                  </div>
                );
              })()}

              <h2 className="text-lg font-black text-emerald-800 mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined">gavel</span>
                Notar-Übergabe
              </h2>
              <p className="text-sm text-emerald-700 mb-5">
                Ein Angebot wurde angenommen. Bereiten Sie folgende Unterlagen für den Notartermin vor:
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  "Grundbuchauszug (aktuell)",
                  "Flurkarte / Lageplan",
                  "Teilungserklärung (bei WEG)",
                  "Energieausweis",
                  "Wohnflächenberechnung",
                  "Nebenkostenabrechnungen (letzte 3 Jahre)",
                  "Protokolle der Eigentümerversammlungen",
                  "Personalausweis (Verkäufer)",
                ].map((doc) => (
                  <div key={doc} className="flex items-center gap-2 text-sm text-emerald-800">
                    <span className="material-symbols-outlined text-emerald-600 text-base">task_alt</span>
                    {doc}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function WeightCard({ label, weight, icon }: { label: string; weight: string; icon: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3">
      <span className="material-symbols-outlined text-primary text-lg">{icon}</span>
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</div>
        <div className="text-lg font-black text-blueprint">{weight}</div>
      </div>
    </div>
  );
}

function ScoreBar({ label, score }: { label: string; score: number | null }) {
  const s = score ?? 0;
  const color = s >= 70 ? "bg-emerald-500" : s >= 40 ? "bg-amber-500" : "bg-red-400";
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold text-slate-400">{label}</span>
        <span className="text-xs font-black text-blueprint">{s}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${s}%` }} />
      </div>
    </div>
  );
}

function CompareRow({ label, values, highlight }: { label: string; values: string[]; highlight?: boolean }) {
  return (
    <tr className={`border-b border-slate-100 ${highlight ? "bg-primary/5" : ""}`}>
      <td className="py-3 pr-6 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</td>
      {values.map((v, i) => (
        <td key={i} className={`text-center py-3 px-4 ${highlight ? "font-black text-primary text-lg" : "font-medium text-blueprint"}`}>
          {v}
        </td>
      ))}
    </tr>
  );
}
