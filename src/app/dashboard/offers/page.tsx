export default function OffersPage() {
  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-blueprint tracking-tight">Angebote</h1>
          <p className="text-slate-500 mt-1">Kaufangebote empfangen, bewerten und vergleichen.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Gewichtung Betrag</div>
          <div className="text-2xl font-black text-blueprint">30%</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Gewichtung Finanzierung</div>
          <div className="text-2xl font-black text-blueprint">30%</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Gewichtung Zeitrahmen</div>
          <div className="text-2xl font-black text-blueprint">20%</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Gewichtung Risiko</div>
          <div className="text-2xl font-black text-blueprint">20%</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
        <div className="w-20 h-20 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-4xl">handshake</span>
        </div>
        <h2 className="text-xl font-black text-blueprint mb-2">Noch keine Angebote</h2>
        <p className="text-slate-500 max-w-md mx-auto mb-4">
          Wenn Käufer Angebote für Ihr Inserat abgeben, erscheinen diese hier mit automatischer Bewertung nach Betrag, Finanzierungsstärke, Zeitrahmen und Risiko.
        </p>
        <p className="text-xs text-slate-400">
          Sie können bis zu 3 Angebote nebeneinander vergleichen und mit einem Klick annehmen.
        </p>
      </div>
    </>
  );
}
