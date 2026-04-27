export default function PropertiesPage() {
  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-blueprint tracking-tight">
            Properties
          </h1>
          <p className="text-slate-500 mt-1">
            Manage your property records and details.
          </p>
        </div>
        <button className="bg-primary hover:bg-primary-dark text-white px-5 py-3 rounded-xl text-sm font-black uppercase tracking-[0.18em] transition-all duration-300 hover:scale-[1.02] flex items-center gap-2 shadow-lg shadow-primary/25">
          <span className="material-symbols-outlined text-lg">add</span>
          Add property
        </button>
      </div>

      {/* Empty state */}
      <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
        <div className="w-20 h-20 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-4xl">
            add_home_work
          </span>
        </div>
        <h2 className="text-xl font-black text-blueprint mb-2">
          No properties yet
        </h2>
        <p className="text-slate-500 max-w-md mx-auto mb-8">
          Add your first property to get started. You&apos;ll need the address,
          basic details, photos, and your Energieausweis.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl text-sm font-black uppercase tracking-[0.18em] transition-all flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">forum</span>
            Start with Expose Agent
          </button>
          <button className="bg-white border border-slate-200 hover:border-primary text-blueprint px-6 py-3 rounded-xl text-sm font-black uppercase tracking-[0.18em] transition-all flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">edit_note</span>
            Fill out form
          </button>
        </div>
      </div>
    </>
  );
}
