export default function SyndicationPage() {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-blueprint tracking-tight">
          Portal Sync
        </h1>
        <p className="text-slate-500 mt-1">
          Syndicate your listings to ImmobilienScout24 and track engagement.
        </p>
      </div>

      {/* Portal cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
        {/* IS24 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-7 hover:border-primary/30 transition-colors">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#ff7500]/10 text-[#ff7500] flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">
                  apartment
                </span>
              </div>
              <div>
                <h3 className="font-black text-blueprint text-sm">
                  ImmobilienScout24
                </h3>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                  Primary portal
                </p>
              </div>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
              Not connected
            </span>
          </div>

          <p className="text-xs text-slate-500 mb-5">
            Connect your IS24 account to auto-publish listings and pull back
            views, contacts, and bookmarks.
          </p>

          <button className="w-full bg-blueprint hover:bg-primary text-white py-3 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-base">link</span>
            Connect account
          </button>
        </div>

        {/* Immowelt - future */}
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-7 opacity-60">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">
                domain
              </span>
            </div>
            <div>
              <h3 className="font-black text-blueprint text-sm">Immowelt</h3>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                Coming soon
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Immowelt integration will be available after IS24 syndication is
            stable.
          </p>
        </div>

        {/* Kleinanzeigen - future */}
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-7 opacity-60">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">
                storefront
              </span>
            </div>
            <div>
              <h3 className="font-black text-blueprint text-sm">
                Kleinanzeigen
              </h3>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                Coming soon
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Kleinanzeigen integration is planned for a future release.
          </p>
        </div>
      </div>

      {/* Stats section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-7">
        <h2 className="text-lg font-black text-blueprint mb-5">
          Portal Statistics
        </h2>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">
              Impressions
            </div>
            <div className="text-2xl font-black text-blueprint">—</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">
              Detail Views
            </div>
            <div className="text-2xl font-black text-blueprint">—</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">
              Contact Requests
            </div>
            <div className="text-2xl font-black text-blueprint">—</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">
              Bookmarks
            </div>
            <div className="text-2xl font-black text-blueprint">—</div>
          </div>
        </div>

        <p className="text-xs text-slate-400 text-center">
          Connect a portal account to start tracking engagement statistics.
        </p>
      </div>
    </>
  );
}
