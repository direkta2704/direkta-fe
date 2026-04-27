export default function OffersPage() {
  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-blueprint tracking-tight">
            Offers
          </h1>
          <p className="text-slate-500 mt-1">
            Receive, score, and compare buyer offers side-by-side.
          </p>
        </div>
      </div>

      {/* Scoring breakdown info */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">
            Amount Weight
          </div>
          <div className="text-2xl font-black text-blueprint">30%</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">
            Financing Weight
          </div>
          <div className="text-2xl font-black text-blueprint">30%</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">
            Timing Weight
          </div>
          <div className="text-2xl font-black text-blueprint">20%</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">
            Risk Weight
          </div>
          <div className="text-2xl font-black text-blueprint">20%</div>
        </div>
      </div>

      {/* Empty state */}
      <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
        <div className="w-20 h-20 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-4xl">handshake</span>
        </div>
        <h2 className="text-xl font-black text-blueprint mb-2">
          No offers yet
        </h2>
        <p className="text-slate-500 max-w-md mx-auto mb-4">
          When buyers submit offers on your listing, they&apos;ll appear here
          with automatic scoring on amount, financing strength, timing, and
          risk.
        </p>
        <p className="text-xs text-slate-400">
          You can compare up to 3 offers side-by-side and accept with one click.
        </p>
      </div>
    </>
  );
}
