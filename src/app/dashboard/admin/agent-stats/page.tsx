"use client";

import { useEffect, useState } from "react";

interface Stats {
  windowDays: number;
  since: string;
  latencyMs: {
    samples: number;
    p50: number;
    p95: number;
    p99: number;
    max: number;
    mean: number;
    sloLiveP95Ms: number;
    sloMockedP95Ms: number;
    slaPass: boolean | null;
  };
  conversations: {
    total: number;
    completed: number;
    abandoned: number;
    active: number;
    completionRatePct: number;
  };
  runs: {
    total: number;
    succeeded: number;
    failed: number;
    avgCostCents: number;
    totalCostCents: number;
  };
}

export default function AgentStatsPage() {
  const [windowDays, setWindowDays] = useState(7);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/agent-stats?windowDays=${windowDays}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Fehler");
        setStats(data);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [windowDays]);

  return (
    <div className="max-w-5xl mx-auto py-10 px-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-blueprint tracking-tight">Exposé-Agent SLOs</h1>
          <p className="text-sm text-slate-500 mt-1">F-M5-01 Latenz · F-M5-11 Audit · §10.5 Cost-Cap Telemetrie</p>
        </div>
        <select
          value={windowDays}
          onChange={(e) => setWindowDays(Number(e.target.value))}
          className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold"
        >
          <option value={1}>Letzte 24h</option>
          <option value={7}>Letzte 7 Tage</option>
          <option value={30}>Letzte 30 Tage</option>
          <option value={90}>Letzte 90 Tage</option>
        </select>
      </div>

      {loading && <p className="text-sm text-slate-400">Lädt...</p>}
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-4">{error}</p>}

      {stats && (
        <div className="space-y-6">
          {/* Latency SLO card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-blueprint">Latenz (F-M5-01)</h2>
              {stats.latencyMs.slaPass !== null && (
                <span className={`text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full ${
                  stats.latencyMs.slaPass ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}>
                  {stats.latencyMs.slaPass ? "✓ SLA bestanden" : "✗ SLA verletzt"}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Ziel: P95 &lt; {stats.latencyMs.sloLiveP95Ms} ms (live) · &lt; {stats.latencyMs.sloMockedP95Ms} ms (mocked).
              Fenster: {stats.latencyMs.samples} Agent-Turns.
            </p>
            <div className="grid grid-cols-5 gap-3">
              <Stat label="Mittelwert" value={`${stats.latencyMs.mean} ms`} />
              <Stat label="P50" value={`${stats.latencyMs.p50} ms`} />
              <Stat label="P95" value={`${stats.latencyMs.p95} ms`} highlight={stats.latencyMs.slaPass === false} />
              <Stat label="P99" value={`${stats.latencyMs.p99} ms`} />
              <Stat label="Max" value={`${stats.latencyMs.max} ms`} />
            </div>
          </div>

          {/* Conversations */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-lg font-black text-blueprint mb-4">Konversationen</h2>
            <div className="grid grid-cols-4 gap-3">
              <Stat label="Insgesamt" value={String(stats.conversations.total)} />
              <Stat label="Abgeschlossen" value={String(stats.conversations.completed)} />
              <Stat label="Abgebrochen" value={String(stats.conversations.abandoned)} />
              <Stat label="Conversion %" value={`${stats.conversations.completionRatePct}%`} />
            </div>
          </div>

          {/* Cost (§10.5) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-lg font-black text-blueprint mb-4">Kosten (§10.5)</h2>
            <p className="text-xs text-slate-400 mb-4">Cap: 200¢ pro Run. Quelle: AgentRun.costCents.</p>
            <div className="grid grid-cols-4 gap-3">
              <Stat label="AgentRuns" value={String(stats.runs.total)} />
              <Stat label="Erfolgreich" value={String(stats.runs.succeeded)} />
              <Stat label="Ø Kosten" value={`${(stats.runs.avgCostCents / 100).toFixed(2)} €`} />
              <Stat label="Gesamtkosten" value={`${(stats.runs.totalCostCents / 100).toFixed(2)} €`} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-4 ${highlight ? "bg-red-50 border border-red-200" : "bg-slate-50"}`}>
      <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`text-xl font-black mt-1 ${highlight ? "text-red-700" : "text-blueprint"}`}>{value}</div>
    </div>
  );
}
