export default function SyndicationPage() {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-blueprint tracking-tight">Portal-Synchronisation</h1>
        <p className="text-slate-500 mt-1">Veröffentlichen Sie Ihre Inserate auf ImmobilienScout24 und verfolgen Sie die Reichweite.</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-7 hover:border-primary/30 transition-colors">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#ff7500]/10 text-[#ff7500] flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">apartment</span>
              </div>
              <div>
                <h3 className="font-black text-blueprint text-sm">ImmobilienScout24</h3>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Hauptportal</p>
              </div>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">Nicht verbunden</span>
          </div>
          <p className="text-xs text-slate-500 mb-5">Verbinden Sie Ihr IS24-Konto, um Inserate automatisch zu veröffentlichen und Aufrufe, Kontakte und Vormerkungen abzurufen.</p>
          <button className="w-full bg-blueprint hover:bg-primary text-white py-3 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-base">link</span>
            Konto verbinden
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-7 opacity-60">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">domain</span>
            </div>
            <div>
              <h3 className="font-black text-blueprint text-sm">Immowelt</h3>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Demnächst verfügbar</p>
            </div>
          </div>
          <p className="text-xs text-slate-400">Die Immowelt-Integration wird verfügbar sein, sobald die IS24-Synchronisation stabil läuft.</p>
        </div>

        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-7 opacity-60">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">storefront</span>
            </div>
            <div>
              <h3 className="font-black text-blueprint text-sm">Kleinanzeigen</h3>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Demnächst verfügbar</p>
            </div>
          </div>
          <p className="text-xs text-slate-400">Die Kleinanzeigen-Integration ist für eine zukünftige Version geplant.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-7">
        <h2 className="text-lg font-black text-blueprint mb-5">Portal-Statistiken</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Aufrufe</div>
            <div className="text-2xl font-black text-blueprint">—</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Detailansichten</div>
            <div className="text-2xl font-black text-blueprint">—</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Kontaktanfragen</div>
            <div className="text-2xl font-black text-blueprint">—</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Vormerkungen</div>
            <div className="text-2xl font-black text-blueprint">—</div>
          </div>
        </div>
        <p className="text-xs text-slate-400 text-center">Verbinden Sie ein Portal-Konto, um Reichweiten-Statistiken zu verfolgen.</p>
      </div>
    </>
  );
}
