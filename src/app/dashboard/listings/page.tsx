export default function ListingsPage() {
  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-blueprint tracking-tight">
            Listings
          </h1>
          <p className="text-slate-500 mt-1">
            Your active, draft, and completed listings.
          </p>
        </div>
        <button className="bg-primary hover:bg-primary-dark text-white px-5 py-3 rounded-xl text-sm font-black uppercase tracking-[0.18em] transition-all duration-300 hover:scale-[1.02] flex items-center gap-2 shadow-lg shadow-primary/25">
          <span className="material-symbols-outlined text-lg">add</span>
          New listing
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-2 mb-6">
        {["All", "Draft", "Active", "Paused", "Closed"].map((tab, i) => (
          <button
            key={tab}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-[0.15em] transition-colors ${
              i === 0
                ? "bg-blueprint text-white"
                : "bg-white border border-slate-200 text-slate-500 hover:text-blueprint hover:border-slate-300"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Empty state */}
      <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
        <div className="w-20 h-20 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-4xl">
            description
          </span>
        </div>
        <h2 className="text-xl font-black text-blueprint mb-2">
          No listings yet
        </h2>
        <p className="text-slate-500 max-w-md mx-auto mb-8">
          Create a property first, then generate an AI-powered listing with
          pricing strategies, compliance checks, and portal syndication.
        </p>
        <button className="bg-blueprint hover:bg-primary text-white px-6 py-3 rounded-xl text-sm font-black uppercase tracking-[0.18em] transition-colors">
          Create your first listing
        </button>
      </div>
    </>
  );
}
