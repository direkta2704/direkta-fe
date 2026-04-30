"use client";

import { useEffect, useState } from "react";

interface AuditResponse {
  windowDays: number;
  totalTurns: number;
  totalConversations: number;
  multiQuestionTurns: number;
  multiQuestionRatePct: number;
  affectedConversations: number;
  flagged: Array<{
    turnId: string;
    conversationId: string;
    createdAt: string;
    content: string;
    audit: { questionMarkCount: number; interrogativeStemMatches: string[]; estimatedQuestionCount: number };
  }>;
}

export default function AgentAuditPage() {
  const [windowDays, setWindowDays] = useState(7);
  const [data, setData] = useState<AuditResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/agent-audit?windowDays=${windowDays}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Fehler");
        setData(json);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [windowDays]);

  return (
    <div className="max-w-5xl mx-auto py-10 px-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-blueprint tracking-tight">Frage-pro-Turn Audit</h1>
          <p className="text-sm text-slate-500 mt-1">F-M5-03 · Genau eine Frage pro Agent-Nachricht</p>
        </div>
        <select
          value={windowDays}
          onChange={(e) => setWindowDays(Number(e.target.value))}
          className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold"
        >
          <option value={1}>Letzte 24h</option>
          <option value={7}>Letzte 7 Tage</option>
          <option value={30}>Letzte 30 Tage</option>
        </select>
      </div>

      {loading && <p className="text-sm text-slate-400">Lädt...</p>}
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-4">{error}</p>}

      {data && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-blueprint">Übersicht</h2>
              <span className={`text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full ${
                data.multiQuestionTurns === 0 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
              }`}>
                {data.multiQuestionTurns === 0 ? "✓ Sauber" : `${data.multiQuestionTurns} Verstöße`}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <Stat label="Geprüfte Turns" value={String(data.totalTurns)} />
              <Stat label="Konversationen" value={String(data.totalConversations)} />
              <Stat label="Mehrfach-Fragen" value={String(data.multiQuestionTurns)} highlight={data.multiQuestionTurns > 0} />
              <Stat label="Rate %" value={`${data.multiQuestionRatePct}%`} />
            </div>
          </div>

          {data.flagged.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-lg font-black text-blueprint mb-4">Gemeldete Turns ({data.flagged.length})</h2>
              <div className="space-y-3">
                {data.flagged.map((f) => (
                  <div key={f.turnId} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <a
                        href={`/dashboard/expose-agent/conversations/${f.conversationId}`}
                        className="text-xs font-bold text-blueprint hover:text-primary"
                      >
                        Konversation: {f.conversationId.slice(0, 8)}…
                      </a>
                      <span className="text-[10px] text-slate-400">
                        {new Date(f.createdAt).toLocaleString("de-DE")}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-line mb-2">{f.content}</p>
                    <p className="text-[10px] text-amber-700">
                      ? × {f.audit.questionMarkCount} · Stems: {f.audit.interrogativeStemMatches.join(", ") || "—"} · Geschätzt {f.audit.estimatedQuestionCount} Fragen
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-4 ${highlight ? "bg-amber-50 border border-amber-200" : "bg-slate-50"}`}>
      <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`text-xl font-black mt-1 ${highlight ? "text-amber-700" : "text-blueprint"}`}>{value}</div>
    </div>
  );
}
