"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { WorkingMemory } from "@/lib/expose-agent";

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
  draft: "Zusammenfassung",
  confirm: "Bestätigung",
};

export default function ExposeAgentPage() {
  const router = useRouter();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [memory, setMemory] = useState<WorkingMemory | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [handing, setHanding] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  async function startConversation() {
    setStarting(true);
    try {
      const res = await fetch("/api/agents/expose/conversations", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConversationId(data.id);
      setTurns(data.turns);
      setMemory(data.memory);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Fehler beim Starten");
    }
    setStarting(false);
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !conversationId || loading) return;

    const userMessage = input.trim();
    setInput("");
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
      setTurns((prev) => [...prev, { role: "AGENT", content: data.content }]);
      if (data.memory) setMemory(data.memory);
    } catch (err) {
      setTurns((prev) => [...prev, { role: "AGENT", content: `Fehler: ${err instanceof Error ? err.message : "Unbekannt"}` }]);
    }
    setLoading(false);
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

  const readyForHandoff = memory && memory.type && memory.street && memory.city && memory.livingArea && memory.condition;

  // Start screen
  if (!conversationId) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-4xl">forum</span>
        </div>
        <h1 className="text-3xl font-black text-blueprint tracking-tight mb-3">
          Exposé-Assistent
        </h1>
        <p className="text-lg text-slate-500 mb-2">
          Erstellen Sie Ihr Inserat im Gespräch — Schritt für Schritt.
        </p>
        <p className="text-sm text-slate-400 mb-10 max-w-md mx-auto">
          Der Assistent führt Sie durch alle nötigen Angaben: Immobilientyp, Adresse,
          Details, Energieausweis. Am Ende erhalten Sie ein fertiges Inserat mit
          KI-generierter Beschreibung und Preisempfehlung.
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
    <div className="flex h-[calc(100vh-5rem)] gap-6">
      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">forum</span>
            </div>
            <div>
              <h1 className="font-black text-blueprint">Exposé-Assistent</h1>
              <p className="text-xs text-slate-400">{turns.length} Nachrichten</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/dashboard/properties/new")}
              className="text-xs font-bold text-slate-400 hover:text-blueprint transition-colors px-3 py-2"
            >
              Zum Formular
            </button>
            {readyForHandoff && (
              <button
                onClick={handleHandoff}
                disabled={handing}
                className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-all hover:scale-[1.02] shadow-lg shadow-primary/25 disabled:opacity-60 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">check_circle</span>
                {handing ? "Wird erstellt..." : "Inserat erstellen"}
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          {turns.map((turn, i) => (
            <div key={i} className={`flex ${turn.role === "USER" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-5 py-3 ${
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
                <p className="text-sm leading-relaxed whitespace-pre-line">{turn.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-5 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={sendMessage} className="pt-4 border-t border-slate-200">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ihre Antwort eingeben..."
              disabled={loading}
              className="flex-1 px-5 py-3.5 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-60"
              autoFocus
            />
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

      {/* Memory sidebar */}
      <div className="hidden lg:block w-72 flex-shrink-0">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sticky top-24">
          <h3 className="font-black text-blueprint text-sm mb-4">Fortschritt</h3>

          {/* Phase progress */}
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

          {/* Collected data */}
          {memory && (
            <div className="space-y-2 pt-4 border-t border-slate-100">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Erfasste Daten</div>
              {memory.type && <MemoryItem label="Typ" value={memory.type} />}
              {memory.street && <MemoryItem label="Adresse" value={`${memory.street} ${memory.houseNumber || ""}`} />}
              {memory.city && <MemoryItem label="Ort" value={`${memory.postcode || ""} ${memory.city}`} />}
              {memory.livingArea && <MemoryItem label="Fläche" value={`${memory.livingArea} m²`} />}
              {memory.rooms && <MemoryItem label="Zimmer" value={String(memory.rooms)} />}
              {memory.condition && <MemoryItem label="Zustand" value={memory.condition} />}
              {memory.energyClass && <MemoryItem label="Energie" value={memory.energyClass} />}
            </div>
          )}
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
