"use client";

import { useState } from "react";

export default function OfferForm({
  listingId,
  askingPrice,
}: {
  listingId: string;
  askingPrice: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState(askingPrice ? String(askingPrice) : "");
  const [financingState, setFinancingState] = useState("UNKNOWN");
  const [desiredClosingAt, setDesiredClosingAt] = useState("");
  const [conditions, setConditions] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/public/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          name,
          email,
          phone,
          amount: Number(amount),
          financingState,
          desiredClosingAt: desiredClosingAt || null,
          conditions: conditions || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Angebot fehlgeschlagen");
    }
    setLoading(false);
  }

  if (success) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-7 text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-3xl">check_circle</span>
        </div>
        <h3 className="text-xl font-black text-blueprint mb-2">Angebot eingereicht</h3>
        <p className="text-sm text-slate-500">
          Vielen Dank. Der Eigentümer wird Ihr Angebot prüfen und sich bei Ihnen melden.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-blueprint hover:bg-primary text-white py-3.5 rounded-xl font-black text-sm uppercase tracking-[0.18em] transition-colors flex items-center justify-center gap-2"
      >
        <span className="material-symbols-outlined text-lg">gavel</span>
        Angebot abgeben
      </button>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-lg shadow-slate-200/50">
      <h3 className="text-lg font-black text-blueprint mb-1">Angebot abgeben</h3>
      <p className="text-xs text-slate-500 mb-5">
        Geben Sie Ihr verbindliches Kaufangebot ab.
        {askingPrice && (
          <span className="block mt-1">
            Angebotspreis: <strong className="text-primary">€{askingPrice.toLocaleString("de-DE")}</strong>
          </span>
        )}
      </p>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1.5">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Ihr vollständiger Name"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1.5">E-Mail *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="ihre@email.de"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1.5">Telefon</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+49 ..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1.5">Angebotsbetrag (€) *</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">€</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="z.B. 450000"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1.5">Finanzierung *</label>
          <select
            value={financingState}
            onChange={(e) => setFinancingState(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          >
            <option value="UNKNOWN">Bitte auswählen</option>
            <option value="CASH">Barzahlung / Eigenkapital</option>
            <option value="PRE_APPROVED">Finanzierung vorab genehmigt</option>
            <option value="IN_PROCESS">Finanzierung in Bearbeitung</option>
            <option value="NONE">Noch keine Finanzierung</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1.5">Gewünschter Abschluss</label>
          <input
            type="date"
            value={desiredClosingAt}
            onChange={(e) => setDesiredClosingAt(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1.5">Bedingungen <span className="normal-case tracking-normal text-slate-400">(optional)</span></label>
          <textarea
            value={conditions}
            onChange={(e) => setConditions(e.target.value)}
            rows={3}
            placeholder="z.B. Vorbehalt Finanzierungszusage, gewünschter Einzugstermin..."
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-y"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary hover:bg-primary-dark text-white py-3.5 rounded-xl font-black text-sm uppercase tracking-[0.18em] transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-primary/25 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">gavel</span>
          {loading ? "Wird eingereicht..." : "Angebot verbindlich abgeben"}
        </button>

        <p className="text-[10px] text-slate-400 text-center leading-relaxed">
          Mit der Abgabe bestätigen Sie, dass Ihr Angebot verbindlich ist.
        </p>
      </form>
    </div>
  );
}
