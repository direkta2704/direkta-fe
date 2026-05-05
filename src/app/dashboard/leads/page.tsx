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
  const [awayMode, setAwayMode] = useState(false);
  const [awayMessage, setAwayMessage] = useState("Vielen Dank für Ihre Anfrage. Ich bin derzeit nicht erreichbar und melde mich schnellstmöglich bei Ihnen zurück.");

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
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAwayMode(!awayMode)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors flex items-center gap-2 ${
              awayMode
                ? "bg-amber-50 border border-amber-200 text-amber-700"
                : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300"
            }`}
          >
            <span className="material-symbols-outlined text-base">{awayMode ? "flight" : "notifications_active"}</span>
            {awayMode ? "Abwesend" : "Verfügbar"}
          </button>
        </div>
      </div>

      {/* Away mode banner */}
      {awayMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-amber-500 text-xl mt-0.5">flight</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-800 mb-2">Abwesenheitsmodus aktiv</p>
              <p className="text-xs text-amber-700 mb-3">Neue Anfragen erhalten automatisch folgende Nachricht:</p>
              <textarea
                value={awayMessage}
                onChange={(e) => setAwayMessage(e.target.value)}
                className="w-full text-xs text-amber-900 bg-white border border-amber-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-amber-400"
                rows={3}
              />
            </div>
          </div>
        </div>
      )}

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
              <div key={selectedLead.id} className="bg-white rounded-2xl border border-slate-200 p-7 sticky top-24">
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

                {/* Quick-reply templates */}
                <div className="mb-6">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Schnellantwort</div>
                  <div className="space-y-1.5">
                    {[
                      { label: "Danke & Besichtigung", icon: "calendar_month", text: `Guten Tag ${selectedLead.name || ""},\n\nvielen Dank für Ihr Interesse an unserer Immobilie in ${selectedLead.listing.property.street} ${selectedLead.listing.property.houseNumber}, ${selectedLead.listing.property.city}.\n\nGerne möchte ich Ihnen die Möglichkeit einer Besichtigung anbieten. Bitte teilen Sie mir mit, wann es Ihnen zeitlich passt.\n\nMit freundlichen Grüßen` },
                      { label: "Unterlagen anfordern", icon: "description", text: `Guten Tag ${selectedLead.name || ""},\n\nvielen Dank für Ihre Anfrage. Um Ihnen weitere Informationen zur Immobilie zukommen zu lassen, benötige ich folgende Angaben:\n\n- Finanzierungsnachweis oder Budgetrahmen\n- Gewünschter Einzugstermin\n- Kurze Vorstellung (Selbstnutzer/Kapitalanleger)\n\nMit freundlichen Grüßen` },
                      { label: "Absage (freundlich)", icon: "close", text: `Guten Tag ${selectedLead.name || ""},\n\nvielen Dank für Ihr Interesse an unserer Immobilie. Leider können wir Ihre Anfrage derzeit nicht berücksichtigen.\n\nWir wünschen Ihnen viel Erfolg bei der weiteren Suche.\n\nMit freundlichen Grüßen` },
                    ].map((tpl) => (
                      <button
                        key={tpl.label}
                        onClick={() => {
                          const subject = `Re: Anfrage ${selectedLead.listing.property.street} ${selectedLead.listing.property.houseNumber}`;
                          window.open(`mailto:${selectedLead.emailRaw}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(tpl.text)}`, "_self");
                        }}
                        className="w-full text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-xs transition-colors flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-sm text-slate-400">{tpl.icon}</span>
                        <span className="font-bold text-slate-600">{tpl.label}</span>
                        <span className="material-symbols-outlined text-xs text-slate-300 ml-auto">mail</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  {selectedLead.status !== "QUALIFIED" && selectedLead.status !== "DECLINED" && selectedLead.status !== "VIEWING_SCHEDULED" && (
                    <button
                      onClick={() => updateLeadStatus(selectedLead.id, "QUALIFIED")}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-base">check</span>
                      Qualifizieren
                    </button>
                  )}
                  {(selectedLead.status === "QUALIFIED" || selectedLead.status === "NEW") && (
                    <a
                      href="/dashboard/viewings"
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-base">calendar_month</span>
                      Besichtigung planen
                    </a>
                  )}
                  {selectedLead.status !== "DECLINED" && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/immobilien/${selectedLead.listing.slug}#anfrage`;
                          navigator.clipboard.writeText(url);
                          alert("Besichtigungslink kopiert!");
                        }}
                        className="flex-1 bg-white border border-slate-200 hover:border-primary text-blueprint py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-base">link</span>
                        Link kopieren
                      </button>
                      <a
                        href={`https://wa.me/${selectedLead.phone ? selectedLead.phone.replace(/[^0-9+]/g, "") : ""}?text=${encodeURIComponent(
                          `Hallo ${selectedLead.name || ""},\n\nvielen Dank fuer Ihr Interesse an unserer Immobilie in ${selectedLead.listing.property.street} ${selectedLead.listing.property.houseNumber}, ${selectedLead.listing.property.city}.\n\nSie koennen hier einen Besichtigungstermin buchen:\n${typeof window !== "undefined" ? window.location.origin : ""}/immobilien/${selectedLead.listing.slug}#anfrage\n\nMit freundlichen Gruessen`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 bg-[#25D366] hover:bg-[#1fb855] text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        WhatsApp
                      </a>
                    </div>
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
