"use client";

import { useState } from "react";

export default function EnquiryForm({ listingId }: { listingId: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(
    "Guten Tag,\n\nich interessiere mich für diese Immobilie und würde gerne einen Besichtigungstermin vereinbaren.\n\nMit freundlichen Grüßen"
  );
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/public/enquire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, name, email, phone, message }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anfrage fehlgeschlagen");
    }
    setLoading(false);
  }

  if (success) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-7 text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-3xl">check_circle</span>
        </div>
        <h3 className="text-xl font-black text-blueprint mb-2">Anfrage gesendet</h3>
        <p className="text-sm text-slate-500">
          Vielen Dank für Ihr Interesse. Der Eigentümer wird sich in Kürze bei Ihnen melden.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-lg shadow-slate-200/50">
      <h3 className="text-lg font-black text-blueprint mb-1">Anfrage senden</h3>
      <p className="text-xs text-slate-500 mb-5">Kein Konto erforderlich. Antwort innerhalb von 24 Stunden.</p>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1.5">
            Name *
          </label>
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
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1.5">
            E-Mail *
          </label>
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
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1.5">
            Telefon <span className="text-slate-400 normal-case tracking-normal">(optional)</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+49 ..."
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1.5">
            Nachricht *
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            rows={5}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-y"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary hover:bg-primary-dark text-white py-3.5 rounded-xl font-black text-sm uppercase tracking-[0.18em] transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-primary/25 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">mail</span>
          {loading ? "Wird gesendet..." : "Anfrage senden"}
        </button>

        <p className="text-[10px] text-slate-400 text-center leading-relaxed">
          Mit dem Absenden stimmen Sie unserer <a href="#" className="underline">Datenschutzerklärung</a> zu.
          Ihre Daten werden nur an den Eigentümer weitergeleitet.
        </p>
      </form>
    </div>
  );
}
