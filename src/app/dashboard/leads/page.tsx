export default function LeadsPage() {
  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-blueprint tracking-tight">
            Leads
          </h1>
          <p className="text-slate-500 mt-1">
            Qualified buyer enquiries, ranked by score.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="bg-white border border-slate-200 hover:border-slate-300 text-blueprint px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-all flex items-center gap-2">
            <span className="material-symbols-outlined text-base">
              filter_list
            </span>
            Filter
          </button>
          <button className="bg-white border border-slate-200 hover:border-slate-300 text-blueprint px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-all flex items-center gap-2">
            <span className="material-symbols-outlined text-base">
              download
            </span>
            Export
          </button>
        </div>
      </div>

      {/* Score legend */}
      <div className="flex items-center gap-6 mb-6 px-1">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Hot (80-100)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Warm (50-79)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-slate-300" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Cold (0-49)
          </span>
        </div>
      </div>

      {/* Table header */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200">
          <div className="col-span-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Score
          </div>
          <div className="col-span-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Name
          </div>
          <div className="col-span-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Budget
          </div>
          <div className="col-span-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Financing
          </div>
          <div className="col-span-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Timing
          </div>
          <div className="col-span-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Actions
          </div>
        </div>

        {/* Empty state */}
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="material-symbols-outlined text-5xl text-slate-300 mb-4">
            people
          </span>
          <p className="text-slate-400 font-medium">No leads yet</p>
          <p className="text-sm text-slate-400 mt-1">
            Leads will appear here once your listing is published and buyers
            enquire.
          </p>
        </div>
      </div>
    </>
  );
}
