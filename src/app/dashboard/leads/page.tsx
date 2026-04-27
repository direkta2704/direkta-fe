"use client";

import { useEffect, useState } from "react";

interface Lead {
  id: string;
  name: string | null;
  emailRaw: string;
  phone: string | null;
  message: string | null;
  budget: string | null;
  financingState: string | null;
  timing: string | null;
  qualityScore: number | null;
  status: string;
  source: string;
  createdAt: string;
  listing: {
    id: string;
    slug: string;
    property: {
      street: string;
      houseNumber: string;
      city: string;
    };
  };
}

const STATUS_DE: Record<string, string> = {
  NEW: "Neu",
  QUALIFYING: "Qualifizierung",
  QUALIFIED: "Qualifiziert",
  VIEWING_SCHEDULED: "Besichtigung geplant",
  OFFER_MADE: "Angebot abgegeben",
  DECLINED: "Abgelehnt",
};

const FINANCING_DE: Record<string, string> = {
  CASH: "Barzahlung",
  PRE_APPROVED: "Vorab genehmigt",
  IN_PROCESS: "In Bearbeitung",
  NONE: "Keine",
  UNKNOWN: "Unbekannt",
};

const TIMING_DE: Record<string, string> = {
  IMMEDIATELY: "Sofort",
  WITHIN_3M: "Innerhalb 3 Monate",
  WITHIN_6M: "Innerhalb 6 Monate",
  LATER: "Später",
  UNKNOWN: "Unbekannt",
};

function scoreColor(score: number | null): string {
  if (!score) return "bg-slate-100 text-slate-500";
  if (score >= 80) return "bg-emerald-50 text-emerald-600";
  if (score >= 50) return "bg-amber-50 text-amber-600";
  return "bg-slate-100 text-slate-500";
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    fetch("/api/leads")
      .then((r) => r.json())
      .then((data) => setLeads(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  async function updateLeadStatus(leadId: string, status: string) {
    await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status } : l))
    );
    if (selectedLead?.id === leadId) {
      setSelectedLead((prev) => (prev ? { ...prev, status } : null));
    }
  }

  const filtered = filter === "ALL" ? leads : leads.filter((l) => l.status === filter);

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-blueprint tracking-tight">Interessenten</h1>
          <p className="text-slate-500 mt-1">
            {leads.length} Interessent{leads.length !== 1 ? "en" : ""} · Qualifiziert und nach Bewertung sortiert.
          </p>
        </div>
      </div>

      {/* Score legend + filters */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Heiß (80–100)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Warm (50–79)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-300" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Kalt (0–49)</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {["ALL", "NEW", "QUALIFIED", "VIEWING_SCHEDULED", "DECLINED"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] transition-colors ${
                filter === f ? "bg-blueprint text-white" : "bg-white border border-slate-200 text-slate-500 hover:text-blueprint"
              }`}
            >
              {f === "ALL" ? "Alle" : STATUS_DE[f] || f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
          <span className="material-symbols-outlined text-5xl text-slate-300 mb-4 block">people</span>
          <h2 className="text-xl font-black text-blueprint mb-2">
            {filter === "ALL" ? "Noch keine Interessenten" : `Keine ${STATUS_DE[filter] || filter}-Interessenten`}
          </h2>
          <p className="text-sm text-slate-400">
            Interessenten erscheinen hier, sobald Käufer auf Ihre veröffentlichten Inserate anfragen.
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Lead list */}
          <div className="lg:col-span-2 space-y-3">
            {filtered
              .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))
              .map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  className={`w-full text-left bg-white rounded-2xl border p-5 transition-all hover:shadow-md ${
                    selectedLead?.id === lead.id ? "border-primary shadow-md" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-black px-2.5 py-1 rounded-full ${scoreColor(lead.qualityScore)}`}>
                        {lead.qualityScore ?? "–"}
                      </span>
                      <span className="font-black text-blueprint">{lead.name || "Unbekannt"}</span>
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                      lead.status === "NEW" ? "bg-blue-50 text-blue-600"
                      : lead.status === "QUALIFIED" ? "bg-emerald-50 text-emerald-600"
                      : lead.status === "DECLINED" ? "bg-red-50 text-red-500"
                      : "bg-slate-100 text-slate-500"
                    }`}>{STATUS_DE[lead.status] || lead.status}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{lead.emailRaw}</p>
                  <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-400">
                    <span>{lead.listing.property.street} {lead.listing.property.houseNumber}, {lead.listing.property.city}</span>
                    <span>·</span>
                    <span>{new Date(lead.createdAt).toLocaleDateString("de-DE")}</span>
                  </div>
                </button>
              ))}
          </div>

          {/* Lead detail panel */}
          <div>
            {selectedLead ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-7 sticky top-24">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-black text-blueprint text-lg">{selectedLead.name || "Unbekannt"}</h3>
                  <span className={`text-xs font-black px-3 py-1 rounded-full ${scoreColor(selectedLead.qualityScore)}`}>
                    Score: {selectedLead.qualityScore ?? "–"}
                  </span>
                </div>

                <div className="space-y-4 mb-6">
                  <InfoRow icon="mail" label="E-Mail" value={selectedLead.emailRaw} />
                  {selectedLead.phone && <InfoRow icon="phone" label="Telefon" value={selectedLead.phone} />}
                  <InfoRow icon="home_work" label="Immobilie" value={`${selectedLead.listing.property.street} ${selectedLead.listing.property.houseNumber}`} />
                  <InfoRow icon="event" label="Anfrage vom" value={new Date(selectedLead.createdAt).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })} />
                  {selectedLead.financingState && <InfoRow icon="credit_score" label="Finanzierung" value={FINANCING_DE[selectedLead.financingState] || selectedLead.financingState} />}
                  {selectedLead.timing && <InfoRow icon="schedule" label="Zeitrahmen" value={TIMING_DE[selectedLead.timing] || selectedLead.timing} />}
                  {selectedLead.budget && <InfoRow icon="payments" label="Budget" value={`€${Number(selectedLead.budget).toLocaleString("de-DE")}`} />}
                </div>

                {selectedLead.message && (
                  <div className="mb-6">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Nachricht</div>
                    <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                      {selectedLead.message}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {selectedLead.status !== "QUALIFIED" && selectedLead.status !== "DECLINED" && (
                    <button
                      onClick={() => updateLeadStatus(selectedLead.id, "QUALIFIED")}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-base">check</span>
                      Qualifizieren
                    </button>
                  )}
                  {selectedLead.status !== "DECLINED" && (
                    <button
                      onClick={() => updateLeadStatus(selectedLead.id, "DECLINED")}
                      className="w-full bg-white border border-red-200 hover:bg-red-50 text-red-600 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-base">close</span>
                      Ablehnen
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-7 text-center">
                <span className="material-symbols-outlined text-4xl text-slate-300 mb-3 block">person_search</span>
                <p className="text-sm text-slate-400">Wählen Sie einen Interessenten aus, um Details zu sehen.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="material-symbols-outlined text-slate-400 text-lg mt-0.5">{icon}</span>
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</div>
        <div className="text-sm font-medium text-blueprint">{value}</div>
      </div>
    </div>
  );
}
