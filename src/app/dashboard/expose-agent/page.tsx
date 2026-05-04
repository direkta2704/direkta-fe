"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { WorkingMemory } from "@/lib/expose-agent";

function renderMarkdown(text: string) {
  return text.split("\n").map((line, i) => {
    if (line.startsWith("### ")) return <h4 key={i} className="font-bold text-sm mt-3 mb-1">{line.slice(4)}</h4>;
    if (line.startsWith("## ")) return <h3 key={i} className="font-bold text-base mt-3 mb-1">{line.slice(3)}</h3>;
    if (line.startsWith("- ") || line.startsWith("• ")) {
      const content = line.slice(2);
      return <div key={i} className="flex gap-1.5 ml-1"><span className="text-primary mt-0.5">•</span><span>{renderInline(content)}</span></div>;
    }
    if (line.startsWith("✓ ") || line.startsWith("✗ ")) return <div key={i} className="flex gap-1.5 ml-1"><span>{line[0]}</span><span>{renderInline(line.slice(2))}</span></div>;
    if (line.trim() === "") return <div key={i} className="h-2" />;
    return <p key={i}>{renderInline(line)}</p>;
  });
}
function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => p.startsWith("**") && p.endsWith("**") ? <strong key={i} className="font-bold">{p.slice(2, -2)}</strong> : p);
}

interface Turn {
  id?: string;
  role: string;
  content: string;
  createdAt?: string;
}

const PHASE_LABELS: Record<string, string> = {
  greet: "Begrüßung",
  basics: "Adresse",
  details: "Details",
  energy: "Energieausweis",
  photos: "Fotos",
  draft: "Entwurf",
  confirm: "Bestätigung",
};

export default function ExposeAgentPage() {
  const router = useRouter();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [memory, setMemory] = useState<WorkingMemory | null>(null);
  const [costCents, setCostCents] = useState(0);
  const [maxCostCents, setMaxCostCents] = useState(200);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [handing, setHanding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editingTurnId, setEditingTurnId] = useState<string | null>(null);
  const [editingTurnContent, setEditingTurnContent] = useState("");
  const [resuming, setResuming] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const energyInputRef = useRef<HTMLInputElement>(null);
  const floorplanInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  // F-M5-02: resume the most recent ACTIVE conversation on mount so navigating
  // away and back doesn't lose the chat. Conversations older than 24h are
  // auto-closed server-side; we just pick whichever is still ACTIVE.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/agents/expose/conversations");
        if (!res.ok) return;
        const list: Array<{ id: string; status: string; startedAt: string }> = await res.json();
        if (!Array.isArray(list)) return;
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        const active = list.find((c) => c.status === "ACTIVE" && new Date(c.startedAt).getTime() > cutoff);
        if (!active || cancelled) return;

        const detailRes = await fetch(`/api/agents/expose/conversations/${active.id}`);
        if (!detailRes.ok || cancelled) return;
        const detail = await detailRes.json();
        if (cancelled || !detail?.id) return;
        setConversationId(detail.id);
        setTurns(detail.turns || []);
        setMemory(detail.memory);
        setCostCents(detail.costCents || 0);
        setMaxCostCents(detail.maxCostCents || 200);
      } catch {
        // ignore — fall through to start screen
      } finally {
        if (!cancelled) setResuming(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function startNewConversation() {
    if (!confirm("Aktuelles Gespräch verlassen und ein neues starten?")) return;
    setConversationId(null);
    setTurns([]);
    setMemory(null);
    setCostCents(0);
    setInput("");
    setEditingTurnId(null);
    setEditingTurnContent("");
    void startConversation();
  }

  async function startConversation() {
    setStarting(true);
    try {
      const res = await fetch("/api/agents/expose/conversations", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConversationId(data.id);
      setTurns(data.turns);
      setMemory(data.memory);
      setCostCents(data.costCents || 0);
      setMaxCostCents(data.maxCostCents || 200);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Fehler beim Starten");
    }
    setStarting(false);
  }

  async function sendText(text: string) {
    if (!text.trim() || !conversationId || loading) return;
    const userMessage = text.trim();
    const optimisticIdx = turns.length;
    setTurns((prev) => [...prev, { role: "USER", content: userMessage }]);
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/expose/conversations/${conversationId}/turns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMessage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTurns((prev) => {
        const next = [...prev];
        // Patch the optimistic user turn with its real id
        if (next[optimisticIdx] && next[optimisticIdx].role === "USER" && data.userTurnId) {
          next[optimisticIdx] = { ...next[optimisticIdx], id: data.userTurnId };
        }
        next.push({ id: data.agentTurnId, role: "AGENT", content: data.content });
        return next;
      });
      if (data.memory) setMemory(data.memory);
      if (typeof data.costCents === "number") setCostCents(data.costCents);
      if (data.finished && data.listingId) {
        router.push(`/dashboard/listings/${data.listingId}`);
      }
      // Auto-retry when agent indicates it wants to try again
      const retryPhrases = ["try again", "versuche", "nochmal", "Moment bitte", "erneut", "retry"];
      if (data.content && retryPhrases.some((p) => data.content.toLowerCase().includes(p.toLowerCase())) && !data.finished) {
        setTimeout(() => sendText("Bitte fortfahren."), 2000);
      }
    } catch (err) {
      setTurns((prev) => [...prev, { role: "AGENT", content: `Fehler: ${err instanceof Error ? err.message : "Unbekannt"}` }]);
    }
    setLoading(false);
  }

  function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const msg = input.trim();
    setInput("");
    sendText(msg);
  }

  function toggleVoiceInput() {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      alert("Ihr Browser unterstützt keine Spracheingabe. Bitte verwenden Sie Chrome.");
      return;
    }
    if (isRecording) {
      setIsRecording(false);
      return;
    }
    const SpeechRecognition = (window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SpeechRecognition as any)();
    recognition.lang = "de-DE";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setIsRecording(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => prev ? prev + " " + transcript : transcript);
      setIsRecording(false);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    recognition.start();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uploadOne = useCallback(
    async (file: File, kind: "PHOTO" | "FLOORPLAN" | "ENERGY_PDF", unitLabel?: string): Promise<any> => {
      if (!conversationId) return null;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      if (unitLabel) fd.append("unitLabel", unitLabel);
      const res = await fetch(`/api/agents/expose/conversations/${conversationId}/upload`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.memory) setMemory(data.memory);
      return data;
    },
    [conversationId],
  );

  const upload = useCallback(
    async (file: File, kind: "PHOTO" | "FLOORPLAN" | "ENERGY_PDF", unitLabel?: string) => {
      setUploading(true);
      try {
        const effectiveUnit = unitLabel || (kind !== "ENERGY_PDF" ? memory?.currentUnit : null) || undefined;
        const data = await uploadOne(file, kind, effectiveUnit);
        const label = kind === "ENERGY_PDF" ? "Energieausweis" : kind === "FLOORPLAN" ? "Grundriss" : "Foto";
        const key = data?.upload?.storageKey;
        const isImage = key && /\.(jpg|jpeg|png|webp)$/i.test(key);
        const msg = `${label} hochgeladen: ${file.name}${data?.message ? ` — ${data.message}` : ""}`;
        const content = isImage && kind !== "ENERGY_PDF"
          ? `__MEDIA__${key}__${kind}__${msg}`
          : msg;
        setTurns((prev) => [...prev, { role: "SYSTEM", content }]);
        if (kind === "FLOORPLAN") {
          setTimeout(() => sendText("Grundriss hochgeladen."), 800);
        } else if (kind === "ENERGY_PDF") {
          setTimeout(() => sendText("Energieausweis hochgeladen."), 800);
        } else if (data?.autoContinue) {
          setTimeout(() => sendText(`${data.photoCount} Fotos hochgeladen. Bitte Preis berechnen und Entwurf erstellen.`), 500);
        }
      } catch (err) {
        alert(err instanceof Error ? err.message : "Upload fehlgeschlagen");
      }
      setUploading(false);
    },
    [conversationId, uploadOne],
  );

  const handlePhotoFiles = useCallback(
    async (files: FileList) => {
      const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (!images.length) return;
      setUploading(true);
      const keys: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let lastData: any = null;
      try {
        const unitCtx = memory?.currentUnit || undefined;
        for (const file of images) {
          const data = await uploadOne(file, "PHOTO", unitCtx);
          if (data?.upload?.storageKey) keys.push(data.upload.storageKey);
          lastData = data;
        }
        const targetInfo = unitCtx ? ` für ${unitCtx}` : "";
        const label = `📷 ${keys.length} Foto${keys.length > 1 ? "s" : ""}${targetInfo} hochgeladen`;
        const content = keys.length > 0 ? `__PHOTOS__${JSON.stringify(keys)}__${label}` : label;
        setTurns((prev) => [...prev, { role: "SYSTEM", content }]);
        if (keys.length > 0) {
          setTimeout(() => sendText(`${keys.length} Fotos${targetInfo} hochgeladen.`), 800);
        }
      } catch (err) {
        alert(err instanceof Error ? err.message : "Upload fehlgeschlagen");
      }
      setUploading(false);
    },
    [uploadOne],
  );

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handlePhotoFiles(e.dataTransfer.files);
  }

  async function handleHandoff() {
    if (!conversationId) return;
    setHanding(true);
    try {
      const res = await fetch(`/api/agents/expose/conversations/${conversationId}/handoff`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/dashboard/listings/${data.listingId}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Übergabe fehlgeschlagen");
    }
    setHanding(false);
  }

  async function saveDraftEdit(titleShort: string, descriptionLong: string, askingPrice: number | null, priceOverride: boolean) {
    if (!conversationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/expose/conversations/${conversationId}/draft`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleShort, descriptionLong, askingPrice, priceOverride }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMemory(data.memory);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    }
    setLoading(false);
  }

  async function saveTurnEdit(turnId: string, content: string) {
    if (!conversationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/expose/conversations/${conversationId}/turns/${turnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.memory) setMemory(data.memory);
      setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, content } : t)));
      setEditingTurnId(null);
      setEditingTurnContent("");
      setTurns((prev) => [
        ...prev,
        { role: "SYSTEM", content: "✏️ Antwort korrigiert — der Assistent berücksichtigt die Änderung in der nächsten Nachricht." },
      ]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    }
    setLoading(false);
  }

  function switchToForm() {
    if (memory) {
      try {
        sessionStorage.setItem("expose-agent-prefill", JSON.stringify(memory));
      } catch { /* ignore */ }
    }
    router.push("/dashboard/properties/new?from=agent");
  }

  const photoCount = memory?.uploads.filter((u) => u.kind === "PHOTO").length || 0;
  const readyForHandoff = !!memory?.lastRubric?.passed && !!memory?.draft;
  const hasDraft = !!memory?.draft;
  const costPct = Math.min(100, Math.round((costCents / maxCostCents) * 100));

  if (resuming) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-6">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
        <p className="text-sm text-slate-400">Suche nach laufendem Gespräch...</p>
      </div>
    );
  }

  if (!conversationId) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-4xl">forum</span>
        </div>
        <h1 className="text-3xl font-black text-blueprint tracking-tight mb-3">Exposé-Assistent</h1>
        <p className="text-lg text-slate-500 mb-2">Erstellen Sie Ihr Inserat im Gespräch — Schritt für Schritt.</p>
        <p className="text-sm text-slate-400 mb-10 max-w-md mx-auto">
          Der Assistent führt Sie durch alle nötigen Angaben: Immobilientyp, Adresse, Details, Fotos,
          Energieausweis. Am Ende erhalten Sie ein fertiges Inserat mit KI-generierter Beschreibung
          und Preisempfehlung.
        </p>
        <button
          onClick={startConversation}
          disabled={starting}
          className="bg-primary hover:bg-primary-dark text-white px-8 py-4 rounded-xl text-sm font-black uppercase tracking-[0.18em] transition-all hover:scale-[1.02] shadow-lg shadow-primary/25 disabled:opacity-60 flex items-center gap-2 mx-auto"
        >
          <span className="material-symbols-outlined text-lg">chat</span>
          {starting ? "Wird gestartet..." : "Gespräch starten"}
        </button>
        <button
          onClick={() => router.push("/dashboard/properties/new")}
          className="mt-4 text-sm font-bold text-slate-400 hover:text-blueprint transition-colors"
        >
          Oder: Formular verwenden
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex h-[calc(100vh-5rem)] gap-6 relative"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      {dragOver && (
        <div className="absolute inset-0 z-50 bg-primary/10 border-4 border-dashed border-primary rounded-2xl flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-xl px-6 py-4 shadow-xl">
            <span className="material-symbols-outlined text-4xl text-primary block text-center">cloud_upload</span>
            <p className="text-sm font-bold text-blueprint mt-2">Bilder oder Energieausweis hier ablegen</p>
          </div>
        </div>
      )}

      {showPreview && memory && (
        <ExposePreview
          memory={memory}
          onClose={() => setShowPreview(false)}
          onSave={saveDraftEdit}
          onConfirm={async () => {
            setShowPreview(false);
            await handleHandoff();
          }}
          handing={handing}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">forum</span>
            </div>
            <div>
              <h1 className="font-black text-blueprint">Exposé-Assistent</h1>
              <p className="text-xs text-slate-400">{turns.length} Nachrichten · {costPct}% Budget</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={startNewConversation}
              disabled={starting}
              className="text-xs font-bold text-slate-400 hover:text-blueprint transition-colors px-3 py-2 disabled:opacity-50"
              title="Neues Gespräch starten"
            >
              {starting ? "Start..." : "+ Neu"}
            </button>
            <button
              onClick={switchToForm}
              className="text-xs font-bold text-slate-400 hover:text-blueprint transition-colors px-3 py-2"
              title="Daten ins Formular übernehmen"
            >
              Zum Formular
            </button>
            {hasDraft && (
              <button
                onClick={() => setShowPreview(true)}
                className="bg-white border border-slate-200 hover:border-primary text-blueprint px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">visibility</span>
                Vorschau
              </button>
            )}
            {readyForHandoff && (
              <button
                onClick={() => setShowPreview(true)}
                disabled={handing}
                className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-all hover:scale-[1.02] shadow-lg shadow-primary/25 disabled:opacity-60 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">check_circle</span>
                {handing ? "Wird erstellt..." : "Inserat prüfen & erstellen"}
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          {turns.map((turn, i) => {
            if (turn.role === "SYSTEM") {
              // Photo batch grid (__PHOTOS__[keys]__label)
              const photosMatch = turn.content.match(/^__PHOTOS__(\[.*?\])__(.*)/);
              if (photosMatch) {
                const keys = JSON.parse(photosMatch[1]) as string[];
                const label = photosMatch[2];
                return (
                  <div key={i} className="flex justify-center my-1">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 w-full max-w-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span>
                        <span className="text-xs font-bold text-slate-600">{label}</span>
                      </div>
                      <div className={`grid gap-1.5 ${keys.length === 1 ? "grid-cols-1" : keys.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                        {keys.slice(0, 9).map((key, j) => (
                          <div key={j} className="aspect-[4/3] rounded-lg overflow-hidden bg-slate-200">
                            <img src={key} alt="" className="w-full h-full object-cover" loading="lazy" />
                          </div>
                        ))}
                      </div>
                      {keys.length > 9 && <p className="text-center text-[10px] text-slate-400 mt-1.5">+{keys.length - 9} weitere</p>}
                    </div>
                  </div>
                );
              }
              // Single media preview (__MEDIA__key__kind__label)
              const mediaMatch = turn.content.match(/^__MEDIA__(.+?)__(.+?)__(.*)/);
              if (mediaMatch) {
                const [, mKey, mKind, mLabel] = mediaMatch;
                const isImg = /\.(jpg|jpeg|png|webp)$/i.test(mKey);
                return (
                  <div key={i} className="flex justify-center my-1">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-w-xs">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`material-symbols-outlined text-sm ${mKind === "FLOORPLAN" ? "text-blue-500" : "text-emerald-500"}`}>
                          {mKind === "FLOORPLAN" ? "floor" : "check_circle"}
                        </span>
                        <span className="text-xs font-bold text-slate-600">{mLabel}</span>
                      </div>
                      {isImg && (
                        <div className="aspect-[4/3] rounded-lg overflow-hidden bg-slate-200">
                          <img src={mKey} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              // Default system message (energy cert, text-only, etc.)
              const isPhotoUpload = turn.content.includes("Foto") && turn.content.includes("hochgeladen");
              return (
                <div key={i} className="flex justify-center">
                  <div className="bg-slate-100 text-slate-600 rounded-full px-4 py-1.5 text-xs font-bold flex items-center gap-2">
                    {isPhotoUpload && <span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span>}
                    {turn.content.includes("Grundriss") && <span className="material-symbols-outlined text-blue-500 text-sm">floor</span>}
                    {turn.content.includes("Energieausweis") && <span className="material-symbols-outlined text-amber-500 text-sm">electric_bolt</span>}
                    {turn.content}
                  </div>
                </div>
              );
            }
            const isEditing = turn.role === "USER" && editingTurnId && editingTurnId === turn.id;
            return (
              <div key={i} className={`flex group ${turn.role === "USER" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-5 py-3 relative ${
                  turn.role === "USER"
                    ? "bg-blueprint text-white rounded-br-md"
                    : "bg-white border border-slate-200 text-blueprint rounded-bl-md"
                }`}>
                  {turn.role === "AGENT" && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-primary text-sm">smart_toy</span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary">Assistent</span>
                    </div>
                  )}
                  {isEditing ? (
                    <div>
                      <textarea
                        value={editingTurnContent}
                        onChange={(e) => setEditingTurnContent(e.target.value)}
                        className="w-full bg-white/10 text-white rounded p-2 text-sm border border-white/30 outline-none"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex gap-2 mt-2 justify-end">
                        <button
                          onClick={() => { setEditingTurnId(null); setEditingTurnContent(""); }}
                          className="text-[10px] font-bold uppercase tracking-wider opacity-70 hover:opacity-100"
                        >
                          Abbrechen
                        </button>
                        <button
                          onClick={() => turn.id && saveTurnEdit(turn.id, editingTurnContent)}
                          disabled={!editingTurnContent.trim() || loading}
                          className="bg-white text-blueprint text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded disabled:opacity-50"
                        >
                          Speichern
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm leading-relaxed space-y-1">{turn.role === "AGENT" ? renderMarkdown(turn.content) : <p className="whitespace-pre-line">{turn.content}</p>}</div>
                  )}
                  {turn.role === "USER" && turn.id && !isEditing && (
                    <button
                      onClick={() => { setEditingTurnId(turn.id!); setEditingTurnContent(turn.content); }}
                      className="absolute -left-8 top-2 opacity-0 group-hover:opacity-100 w-7 h-7 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-500 hover:text-blueprint transition-all"
                      title="Korrigieren"
                    >
                      <span className="material-symbols-outlined text-sm">edit</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {(loading || uploading) && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span className="text-xs text-slate-400">{uploading ? "Wird hochgeladen..." : "Assistent denkt nach..."}</span>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={sendMessage} className="pt-4 border-t border-slate-200">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={uploading || loading}
              className="w-12 h-12 bg-slate-100 hover:bg-slate-200 text-blueprint rounded-xl flex items-center justify-center transition-colors disabled:opacity-40"
              title="Fotos hochladen"
            >
              <span className="material-symbols-outlined">add_photo_alternate</span>
            </button>
            <button
              type="button"
              onClick={() => energyInputRef.current?.click()}
              disabled={uploading || loading}
              className="w-12 h-12 bg-slate-100 hover:bg-slate-200 text-blueprint rounded-xl flex items-center justify-center transition-colors disabled:opacity-40"
              title="Energieausweis hochladen"
            >
              <span className="material-symbols-outlined text-lg">electric_bolt</span>
            </button>
            <button
              type="button"
              onClick={() => floorplanInputRef.current?.click()}
              disabled={uploading || loading}
              className="w-12 h-12 bg-slate-100 hover:bg-slate-200 text-blueprint rounded-xl flex items-center justify-center transition-colors disabled:opacity-40"
              title="Grundriss hochladen"
            >
              <span className="material-symbols-outlined text-lg">floor</span>
            </button>
            {memory?.currentUnit && (
              <div className="h-10 bg-primary/10 text-primary text-xs font-bold rounded-lg px-3 flex items-center gap-1.5 border border-primary/20">
                <span className="material-symbols-outlined text-sm">home</span>
                {memory.currentUnit}
              </div>
            )}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) handlePhotoFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <input
              ref={energyInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              hidden
              onChange={(e) => {
                if (e.target.files?.[0]) upload(e.target.files[0], "ENERGY_PDF");
                e.target.value = "";
              }}
            />
            <input
              ref={floorplanInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              hidden
              onChange={(e) => {
                if (e.target.files?.[0]) upload(e.target.files[0], "FLOORPLAN");
                e.target.value = "";
              }}
            />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                !memory?.type ? "z.B. Mehrfamilienhaus, Marktstraße 12, 76571 Gaggenau, 250 m²..." :
                !memory?.street ? "z.B. Marktstraße 12" :
                !memory?.livingArea ? "z.B. 250" :
                !memory?.condition ? "z.B. Gepflegt" :
                photoCount < 1 ? "Fotos mit dem 📷-Button links hochladen oder Nachricht eingeben..." :
                "Ihre Antwort eingeben..."
              }
              disabled={loading}
              className="flex-1 px-5 py-3.5 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-60"
              autoFocus
            />
            <button
              type="button"
              onClick={toggleVoiceInput}
              disabled={loading}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                isRecording
                  ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
                  : "bg-slate-100 hover:bg-slate-200 text-blueprint disabled:opacity-40"
              }`}
              title={isRecording ? "Aufnahme stoppen" : "Spracheingabe"}
            >
              <span className="material-symbols-outlined">{isRecording ? "stop" : "mic"}</span>
            </button>
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="w-12 h-12 bg-primary hover:bg-primary-dark text-white rounded-xl flex items-center justify-center transition-colors disabled:opacity-40"
            >
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
        </form>
      </div>

      <div className="hidden lg:block w-72 flex-shrink-0">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
          <h3 className="font-black text-blueprint text-sm mb-4">Fortschritt</h3>
          <div className="space-y-2 mb-6">
            {(["greet", "basics", "details", "energy", "photos", "draft"] as const).map((phase) => {
              const phases = ["greet", "basics", "details", "energy", "photos", "draft"];
              const currentIdx = phases.indexOf(memory?.phase || "greet");
              const phaseIdx = phases.indexOf(phase);
              const isDone = phaseIdx < currentIdx;
              const isCurrent = phaseIdx === currentIdx;
              return (
                <div key={phase} className="flex items-center gap-2">
                  <span className={`material-symbols-outlined text-base ${
                    isDone ? "text-primary" : isCurrent ? "text-amber-500" : "text-slate-300"
                  }`}>
                    {isDone ? "check_circle" : isCurrent ? "pending" : "radio_button_unchecked"}
                  </span>
                  <span className={`text-xs ${isDone ? "text-slate-400 line-through" : isCurrent ? "text-blueprint font-bold" : "text-slate-400"}`}>
                    {PHASE_LABELS[phase]}
                  </span>
                </div>
              );
            })}
          </div>

          {memory && (
            <div className="space-y-1.5 pt-4 border-t border-slate-100">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Erfasste Daten</div>
              {memory.type && <MemoryItem label="Typ" value={memory.type} />}
              {memory.street && <MemoryItem label="Adresse" value={`${memory.street} ${memory.houseNumber || ""}`} />}
              {memory.city && <MemoryItem label="Ort" value={`${memory.postcode || ""} ${memory.city}`} />}
              {memory.livingArea && <MemoryItem label="Wohnfläche" value={`${memory.livingArea} m²`} />}
              {memory.plotArea && <MemoryItem label="Grundstück" value={`${memory.plotArea} m²`} />}
              {memory.rooms && <MemoryItem label="Zimmer" value={String(memory.rooms)} />}
              {memory.bathrooms && <MemoryItem label="Bäder" value={String(memory.bathrooms)} />}
              {memory.yearBuilt && <MemoryItem label="Baujahr" value={String(memory.yearBuilt)} />}
              {memory.floor != null && <MemoryItem label="Etage" value={String(memory.floor)} />}
              {memory.condition && <MemoryItem label="Zustand" value={memory.condition} />}
              {memory.attributes.length > 0 && <MemoryItem label="Ausstattung" value={memory.attributes.join(", ")} />}
              {memory.unitCount && <MemoryItem label="Einheiten" value={`${memory.unitCount} WE`} />}
              {memory.sellingMode && <MemoryItem label="Verkauf" value={memory.sellingMode === "BOTH" ? "Beides" : memory.sellingMode === "BUNDLE" ? "Paket" : "Einzeln"} />}
              {memory.hasEnergyCert !== null && <MemoryItem label="Energieausweis" value={memory.hasEnergyCert ? "Ja" : "Nein"} />}
              {memory.energyCertType && <MemoryItem label="Ausweis-Typ" value={memory.energyCertType} />}
              {memory.energyClass && <MemoryItem label="Klasse" value={memory.energyClass} />}
              {memory.energyValue && <MemoryItem label="Verbrauch" value={`${memory.energyValue} kWh`} />}
              {memory.energySource && <MemoryItem label="Energieträger" value={memory.energySource} />}
              <MemoryItem label="Fotos" value={`${photoCount} / 6`} />
              {memory.hasFloorPlan && <MemoryItem label="Grundriss" value="✓" />}
              {memory.priceBand && <MemoryItem label="Preisband" value={`€${(memory.priceBand.low / 1000).toFixed(0)}k–${(memory.priceBand.high / 1000).toFixed(0)}k`} />}
              {memory.askingPrice && <MemoryItem label="Wunschpreis" value={`€${memory.askingPrice.toLocaleString("de-DE")}`} />}
              {memory.draft && <MemoryItem label="Entwurf" value="✓ vorhanden" />}
              {memory.lastRubric && <MemoryItem label="Qualität" value={memory.lastRubric.passed ? "✓ bestanden" : `✗ ${memory.lastRubric.failures.length} Fehler`} />}
            </div>
          )}

          {/* Photo thumbnails */}
          {memory && memory.uploads.filter((u) => u.kind === "PHOTO").length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                Fotos ({memory.uploads.filter((u) => u.kind === "PHOTO").length})
              </div>
              <div className="grid grid-cols-3 gap-1">
                {memory.uploads.filter((u) => u.kind === "PHOTO").slice(0, 12).map((u, j) => (
                  <div key={j} className="aspect-square rounded overflow-hidden bg-slate-100">
                    <img src={u.storageKey} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                ))}
              </div>
              {memory.uploads.filter((u) => u.kind === "PHOTO").length > 12 && (
                <p className="text-[10px] text-slate-400 text-center mt-1">+{memory.uploads.filter((u) => u.kind === "PHOTO").length - 12} weitere</p>
              )}
            </div>
          )}

          {/* Floorplan thumbnails */}
          {memory && memory.uploads.filter((u) => u.kind === "FLOORPLAN").length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                Grundrisse ({memory.uploads.filter((u) => u.kind === "FLOORPLAN").length})
              </div>
              <div className="grid grid-cols-2 gap-1">
                {memory.uploads.filter((u) => u.kind === "FLOORPLAN").map((u, j) => (
                  <div key={j} className="aspect-[4/3] rounded overflow-hidden bg-slate-100 flex items-center justify-center">
                    {/\.(jpg|jpeg|png|webp)$/i.test(u.storageKey)
                      ? <img src={u.storageKey} alt="" className="w-full h-full object-cover" loading="lazy" />
                      : <span className="material-symbols-outlined text-2xl text-slate-300">floor</span>
                    }
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MFH Unit cards */}
          {memory && memory.units.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Wohneinheiten</div>
              <div className="space-y-2">
                {memory.units.map((unit, j) => {
                  const uPhotos = memory.uploads.filter((u) => u.kind === "PHOTO" && u.unitLabel === unit.label).length;
                  const uPlans = memory.uploads.filter((u) => u.kind === "FLOORPLAN" && u.unitLabel === unit.label).length;
                  const meta = [unit.livingArea && `${unit.livingArea}m²`, unit.rooms && `${unit.rooms}Zi`, unit.bathrooms && `${unit.bathrooms}Bad`].filter(Boolean);
                  return (
                    <div key={j} className="bg-slate-50 rounded-lg p-2.5">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-bold text-blueprint">{unit.label}</span>
                        {unit.floor != null && <span className="text-[10px] text-slate-400">{unit.floor === 0 ? "EG" : `${unit.floor}. OG`}</span>}
                      </div>
                      <div className="text-[10px] text-slate-500">{meta.join(" · ")}</div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                        <span className="flex items-center gap-0.5"><span className="material-symbols-outlined text-xs">photo_camera</span> {uPhotos}</span>
                        <span className="flex items-center gap-0.5"><span className="material-symbols-outlined text-xs">floor</span> {uPlans}</span>
                        {unit.askingPrice && <span className="font-bold text-blueprint">{Number(unit.askingPrice).toLocaleString("de-DE")} €</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {memory.sellingMode && (
                <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">sell</span>
                  {memory.sellingMode === "BOTH" ? "Einzeln & Paket" : memory.sellingMode === "BUNDLE" ? "Paketverkauf" : "Einzelverkauf"}
                </div>
              )}
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Budget</div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${costPct > 80 ? "bg-red-500" : costPct > 50 ? "bg-amber-500" : "bg-primary"}`}
                style={{ width: `${costPct}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-400 mt-1">{(costCents / 100).toFixed(2)} € / {(maxCostCents / 100).toFixed(2)} €</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MemoryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-400">{label}</span>
      <span className="font-bold text-blueprint">{value}</span>
    </div>
  );
}

function ExposePreview({
  memory,
  onClose,
  onSave,
  onConfirm,
  handing,
}: {
  memory: WorkingMemory;
  onClose: () => void;
  onSave: (titleShort: string, descriptionLong: string, askingPrice: number | null, priceOverride: boolean) => Promise<void>;
  onConfirm: () => void | Promise<void>;
  handing: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [titleShort, setTitleShort] = useState(memory.draft?.titleShort || "");
  const [descriptionLong, setDescriptionLong] = useState(memory.draft?.descriptionLong || "");
  const [askingPrice, setAskingPrice] = useState<string>(memory.askingPrice ? String(memory.askingPrice) : "");
  const [priceOverride, setPriceOverride] = useState(memory.priceOverride);
  const [saving, setSaving] = useState(false);

  const photos = memory.uploads.filter((u) => u.kind === "PHOTO");
  const passed = memory.lastRubric?.passed === true;
  const failures = memory.lastRubric?.failures || [];

  async function save() {
    setSaving(true);
    const askPrice = askingPrice ? Number(askingPrice) : null;
    await onSave(titleShort, descriptionLong, askPrice, priceOverride);
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-2xl">description</span>
            <div>
              <h2 className="font-black text-blueprint">Exposé-Vorschau</h2>
              <p className="text-xs text-slate-400">Prüfen Sie Inhalt und Annahmen, bevor Sie das Inserat erstellen.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-blueprint">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Quality status */}
          <div className={`rounded-xl p-4 ${passed ? "bg-green-50 border border-green-200" : "bg-amber-50 border border-amber-200"}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`material-symbols-outlined ${passed ? "text-green-600" : "text-amber-600"}`}>
                {passed ? "verified" : "warning"}
              </span>
              <span className={`text-sm font-black ${passed ? "text-green-700" : "text-amber-700"}`}>
                {passed ? "Quality Rubric bestanden" : "Quality Rubric noch nicht bestanden"}
              </span>
            </div>
            {failures.length > 0 && (
              <ul className="text-xs text-amber-800 space-y-1 ml-7 list-disc">
                {failures.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            )}
          </div>

          {/* Title */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Titel (max. 160)</label>
              {!editing && (
                <button onClick={() => setEditing(true)} className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">edit</span>
                  Bearbeiten
                </button>
              )}
            </div>
            {editing ? (
              <input
                value={titleShort}
                onChange={(e) => setTitleShort(e.target.value.slice(0, 160))}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                maxLength={160}
              />
            ) : (
              <h3 className="text-lg font-black text-blueprint">{titleShort}</h3>
            )}
          </div>

          {/* Photos */}
          {photos.length > 0 && (
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Fotos ({photos.length})</div>
              <div className="grid grid-cols-3 gap-2">
                {photos.slice(0, 6).map((p, i) => (
                  <div key={i} className="aspect-[4/3] bg-slate-100 rounded-lg overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.storageKey} alt={p.fileName} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 block mb-2">Beschreibung</label>
            {editing ? (
              <textarea
                value={descriptionLong}
                onChange={(e) => setDescriptionLong(e.target.value)}
                rows={14}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none font-mono leading-relaxed"
              />
            ) : (
              <div className="prose prose-sm max-w-none text-blueprint whitespace-pre-wrap leading-relaxed">{descriptionLong}</div>
            )}
            <p className="text-xs text-slate-400 mt-1">
              {descriptionLong.split(/\s+/).filter(Boolean).length} Wörter ·{" "}
              {descriptionLong.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length} Absätze
            </p>
          </div>

          {/* Price + override */}
          {memory.priceBand && (
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Preis</div>
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <PriceCell label="Schnellverkauf" value={memory.priceBand.strategyQuick} />
                  <PriceCell label="Realistisch" value={memory.priceBand.strategyReal} highlight />
                  <PriceCell label="Maximum" value={memory.priceBand.strategyMax} />
                </div>
                <div className="text-xs text-slate-500 mb-2">
                  Empfohlenes Band: {memory.priceBand.low.toLocaleString("de-DE")} – {memory.priceBand.high.toLocaleString("de-DE")} € · Konfidenz: {memory.priceBand.confidence}
                </div>
                {editing && (
                  <div className="flex items-center gap-3 mt-2">
                    <input
                      type="number"
                      value={askingPrice}
                      onChange={(e) => setAskingPrice(e.target.value)}
                      placeholder="Wunschpreis"
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                    <label className="flex items-center gap-1 text-xs text-slate-600">
                      <input type="checkbox" checked={priceOverride} onChange={(e) => setPriceOverride(e.target.checked)} />
                      außerhalb Band ok
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Assumptions (confidence flag) */}
          {memory.assumptions.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-amber-600 text-base">info</span>
                <span className="text-xs font-black uppercase tracking-wider text-amber-700">Annahmen des Assistenten</span>
              </div>
              <ul className="text-xs text-amber-800 space-y-1 list-disc ml-5">
                {memory.assumptions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}

          {/* Key facts (GEG) */}
          {memory.energyClass && (
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Energieausweis (GEG)</div>
              <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-1 text-slate-700">
                <div>Typ: {memory.energyCertType === "BEDARF" ? "Bedarfsausweis" : "Verbrauchsausweis"}</div>
                <div>Klasse: <span className="font-black">{memory.energyClass}</span></div>
                <div>Kennwert: {memory.energyValue} kWh/(m²·a)</div>
                <div>Energieträger: {memory.energySource}</div>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between gap-3">
          {editing ? (
            <>
              <button
                onClick={() => {
                  setEditing(false);
                  setTitleShort(memory.draft?.titleShort || "");
                  setDescriptionLong(memory.draft?.descriptionLong || "");
                }}
                className="text-sm font-bold text-slate-500 px-4 py-2"
              >
                Abbrechen
              </button>
              <button
                onClick={save}
                disabled={saving || !titleShort.trim() || !descriptionLong.trim()}
                className="bg-primary text-white px-6 py-3 rounded-xl text-sm font-black uppercase tracking-wider disabled:opacity-50 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">save</span>
                {saving ? "Speichern..." : "Speichern & neu prüfen"}
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="text-sm font-bold text-slate-500 px-4 py-2">
                Zurück zum Chat
              </button>
              <button
                onClick={onConfirm}
                disabled={!passed || handing}
                className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl text-sm font-black uppercase tracking-wider transition-all hover:scale-[1.02] shadow-lg shadow-primary/25 disabled:opacity-50 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">check_circle</span>
                {handing ? "Wird erstellt..." : "Bestätigen & Inserat erstellen"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PriceCell({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-3 ${highlight ? "bg-primary/10 border border-primary/30" : "bg-white border border-slate-200"}`}>
      <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`text-sm font-black mt-1 ${highlight ? "text-primary" : "text-blueprint"}`}>
        {value.toLocaleString("de-DE")} €
      </div>
    </div>
  );
}
