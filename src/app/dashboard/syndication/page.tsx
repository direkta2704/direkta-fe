"use client";

import { useEffect, useState } from "react";

interface Credential {
  id: string;
  portal: string;
  username: string;
  status: string;
  consentedAt: string;
  lastVerifiedAt: string | null;
}

interface ListingForSync {
  id: string;
  status: string;
  titleShort: string | null;
  property: { street: string; houseNumber: string; city: string; media?: { storageKey: string }[] };
}

interface SyndicationTarget {
  id: string;
  portal: string;
  status: string;
  externalListingId: string | null;
  externalUrl: string | null;
  lastSyncedAt: string | null;
  stats: { date: string; impressions: number; detailViews: number; contactRequests: number; bookmarks: number }[];
}

export default function SyndicationPage() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [listings, setListings] = useState<ListingForSync[]>([]);
  const [syndicationMap, setSyndicationMap] = useState<Record<string, SyndicationTarget[]>>({});
  const [loading, setLoading] = useState(true);

  // Connect form
  const [showConnect, setShowConnect] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");

  // Publish state
  const [publishing, setPublishing] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [creds, listData] = await Promise.all([
      fetch("/api/portals/credentials").then((r) => r.json()),
      fetch("/api/listings").then((r) => r.json()),
    ]);
    setCredentials(Array.isArray(creds) ? creds : []);
    const activeListings = Array.isArray(listData) ? listData.filter((l: ListingForSync) => ["ACTIVE", "DRAFT", "REVIEW"].includes(l.status)) : [];
    setListings(activeListings);

    // Fetch syndication status for each listing
    const map: Record<string, SyndicationTarget[]> = {};
    await Promise.all(
      activeListings.map(async (l: ListingForSync) => {
        const targets = await fetch(`/api/listings/${l.id}/syndication`).then((r) => r.json());
        if (Array.isArray(targets)) map[l.id] = targets;
      })
    );
    setSyndicationMap(map);
    setLoading(false);
  }

  const is24Connected = credentials.some((c) => c.portal === "IMMOSCOUT24" && c.status === "ACTIVE");

  async function connectIS24() {
    setConnecting(true);
    setConnectError("");
    try {
      const res = await fetch("/api/portals/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portal: "IMMOSCOUT24", username, password, consent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCredentials((prev) => [...prev.filter((c) => c.portal !== "IMMOSCOUT24"), data]);
      setShowConnect(false);
      setUsername("");
      setPassword("");
      setConsent(false);
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Verbindung fehlgeschlagen");
    }
    setConnecting(false);
  }

  async function disconnectIS24() {
    const cred = credentials.find((c) => c.portal === "IMMOSCOUT24");
    if (!cred) return;
    await fetch(`/api/portals/credentials/${cred.id}`, { method: "DELETE" });
    setCredentials((prev) => prev.filter((c) => c.id !== cred.id));
  }

  async function publishToIS24(listingId: string) {
    setPublishing(listingId);
    const res = await fetch(`/api/listings/${listingId}/syndication`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portal: "IMMOSCOUT24" }),
    });
    if (res.ok) await loadData();
    setPublishing(null);
  }

  async function syndicationAction(listingId: string, portal: string, action: string) {
    await fetch(`/api/listings/${listingId}/syndication/${portal}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await loadData();
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-blueprint tracking-tight">Portal-Synchronisation</h1>
        <p className="text-slate-500 mt-1">Veröffentlichen Sie Ihre Inserate auf ImmobilienScout24 und verfolgen Sie die Reichweite.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* IS24 Connection Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-7">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#ff7500]/10 text-[#ff7500] flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">apartment</span>
                </div>
                <div>
                  <h2 className="font-black text-blueprint text-lg">ImmobilienScout24</h2>
                  <p className="text-xs text-slate-500">Hauptportal · Automatische Veröffentlichung</p>
                </div>
              </div>
              {is24Connected ? (
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Verbunden
                  </span>
                  <button
                    onClick={disconnectIS24}
                    className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors"
                  >
                    Trennen
                  </button>
                </div>
              ) : (
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                  Nicht verbunden
                </span>
              )}
            </div>

            {!is24Connected && !showConnect && (
              <div>
                <p className="text-sm text-slate-500 mb-4">
                  Verbinden Sie Ihr IS24-Konto, um Inserate automatisch zu veröffentlichen und
                  Aufrufe, Kontakte und Vormerkungen abzurufen.
                </p>
                <button
                  onClick={() => setShowConnect(true)}
                  className="bg-blueprint hover:bg-primary text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">link</span>
                  IS24-Konto verbinden
                </button>
              </div>
            )}

            {showConnect && (
              <div className="border-t border-slate-100 pt-5 mt-2 space-y-4">
                {connectError && (
                  <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">{connectError}</div>
                )}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1.5">IS24 Benutzername / E-Mail</label>
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ihre@email.de"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1.5">IS24 Passwort</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
                  </div>
                </div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20" />
                  <span className="text-xs text-slate-500 leading-relaxed">
                    Ich autorisiere Direkta, in meinem Namen auf mein ImmobilienScout24-Konto zuzugreifen,
                    um Inserate zu veröffentlichen, zu aktualisieren und Statistiken abzurufen.
                    Ich verstehe, dass automatisierter Zugriff möglicherweise gegen die IS24-Nutzungsbedingungen verstößt.
                  </span>
                </label>
                <div className="flex items-center gap-3">
                  <button onClick={connectIS24} disabled={connecting || !username || !password || !consent}
                    className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors disabled:opacity-60 flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">link</span>
                    {connecting ? "Wird verbunden..." : "Verbinden"}
                  </button>
                  <button onClick={() => setShowConnect(false)} className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors">Abbrechen</button>
                </div>
              </div>
            )}

            {is24Connected && (
              <div className="border-t border-slate-100 pt-5 mt-2">
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>Benutzer: <strong className="text-blueprint">{credentials.find((c) => c.portal === "IMMOSCOUT24")?.username}</strong></span>
                  <span>·</span>
                  <span>Verbunden seit: {new Date(credentials.find((c) => c.portal === "IMMOSCOUT24")?.consentedAt || "").toLocaleDateString("de-DE")}</span>
                </div>
              </div>
            )}
          </div>

          {/* Listings syndication */}
          {is24Connected && (
            <div>
              <h2 className="text-lg font-black text-blueprint mb-4">Ihre Inserate auf IS24</h2>
              {listings.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                  <p className="text-slate-400">Keine aktiven Inserate. Veröffentlichen Sie zuerst ein Inserat auf Direkta.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {listings.map((l) => {
                    const targets = syndicationMap[l.id] || [];
                    const is24Target = targets.find((t) => t.portal === "IMMOSCOUT24");
                    const latestStats = is24Target?.stats[0];

                    return (
                      <div key={l.id} className="bg-white rounded-2xl border border-slate-200 p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-4">
                            {l.property.media?.[0] ? (
                              <img
                                src={l.property.media[0].storageKey}
                                alt=""
                                className="w-16 h-12 rounded-lg object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-16 h-12 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                <span className="material-symbols-outlined text-slate-300 text-xl">home</span>
                              </div>
                            )}
                            <div>
                              <h3 className="font-black text-blueprint">{l.titleShort || `${l.property.street} ${l.property.houseNumber}`}</h3>
                              <p className="text-xs text-slate-500">{l.property.city}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {!is24Target || is24Target.status === "NONE" || is24Target.status === "WITHDRAWN" ? (
                              <button
                                onClick={() => publishToIS24(l.id)}
                                disabled={publishing === l.id}
                                className="bg-[#ff7500] hover:bg-[#e66a00] text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors disabled:opacity-60 flex items-center gap-1.5"
                              >
                                <span className="material-symbols-outlined text-sm">publish</span>
                                {publishing === l.id ? "Wird veröffentlicht..." : "Auf IS24 veröffentlichen"}
                              </button>
                            ) : is24Target.status === "LIVE" ? (
                              <div className="flex items-center gap-2">
                                <a href={is24Target.externalUrl || "#"} target="_blank" rel="noopener noreferrer"
                                  className="bg-white border border-slate-200 hover:border-slate-300 text-blueprint px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors">
                                  <span className="material-symbols-outlined text-sm">open_in_new</span>IS24
                                </a>
                                <button onClick={() => syndicationAction(l.id, "IMMOSCOUT24", "resync")}
                                  className="w-8 h-8 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 flex items-center justify-center transition-colors" title="Statistiken aktualisieren">
                                  <span className="material-symbols-outlined text-lg">sync</span>
                                </button>
                                <button onClick={() => syndicationAction(l.id, "IMMOSCOUT24", "pause")}
                                  className="w-8 h-8 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 flex items-center justify-center transition-colors" title="Pausieren">
                                  <span className="material-symbols-outlined text-lg">pause_circle</span>
                                </button>
                                <button onClick={() => syndicationAction(l.id, "IMMOSCOUT24", "withdraw")}
                                  className="w-8 h-8 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors" title="Zurückziehen">
                                  <span className="material-symbols-outlined text-lg">remove_circle</span>
                                </button>
                              </div>
                            ) : is24Target.status === "PAUSED" ? (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">Pausiert</span>
                                <button onClick={() => publishToIS24(l.id)} className="text-xs font-bold text-primary hover:text-primary-dark transition-colors">Fortsetzen</button>
                              </div>
                            ) : is24Target.status === "QUEUED" ? (
                              <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                                <div className="w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
                                In Warteschlange
                              </span>
                            ) : is24Target.status === "FAILED" ? (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-red-500 bg-red-50 px-2.5 py-1 rounded-full">Fehlgeschlagen</span>
                                <button onClick={() => publishToIS24(l.id)} className="text-xs font-bold text-primary hover:text-primary-dark transition-colors">Erneut versuchen</button>
                              </div>
                            ) : (
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">{is24Target.status}</span>
                            )}
                          </div>
                        </div>

                        {is24Target?.status === "LIVE" && latestStats && (
                          <div className="grid grid-cols-4 gap-3 pt-4 border-t border-slate-100">
                            <StatMini label="Aufrufe" value={latestStats.impressions} />
                            <StatMini label="Detailansichten" value={latestStats.detailViews} />
                            <StatMini label="Kontaktanfragen" value={latestStats.contactRequests} />
                            <StatMini label="Vormerkungen" value={latestStats.bookmarks} />
                          </div>
                        )}

                        {is24Target?.status === "LIVE" && is24Target.lastSyncedAt && (
                          <p className="text-[10px] text-slate-400 mt-3">
                            Letzte Synchronisation: {new Date(is24Target.lastSyncedAt).toLocaleString("de-DE")}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Future portals */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-7 opacity-60">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">domain</span>
                </div>
                <div>
                  <h3 className="font-black text-blueprint text-sm">Immowelt</h3>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Demnächst verfügbar</p>
                </div>
              </div>
              <p className="text-xs text-slate-400">Verfügbar nach Stabilisierung der IS24-Synchronisation.</p>
            </div>
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-7 opacity-60">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">storefront</span>
                </div>
                <div>
                  <h3 className="font-black text-blueprint text-sm">Kleinanzeigen</h3>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Demnächst verfügbar</p>
                </div>
              </div>
              <p className="text-xs text-slate-400">Geplant für eine zukünftige Version.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StatMini({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-0.5">{label}</div>
      <div className="text-lg font-black text-blueprint">{value.toLocaleString("de-DE")}</div>
    </div>
  );
}
