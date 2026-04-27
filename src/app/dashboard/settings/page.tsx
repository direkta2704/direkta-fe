import { auth } from "@/lib/auth";

export default async function SettingsPage() {
  const session = await auth();

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-blueprint tracking-tight">Einstellungen</h1>
        <p className="text-slate-500 mt-1">Verwalten Sie Ihr Konto, Ihre Abrechnung und Ihre Einstellungen.</p>
      </div>

      <div className="max-w-3xl space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-7">
          <h2 className="text-lg font-black text-blueprint mb-6">Profil</h2>
          <div className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Vollständiger Name</label>
                <input type="text" defaultValue={session?.user?.name || ""} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">E-Mail</label>
                <input type="email" defaultValue={session?.user?.email || ""} disabled className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-400 bg-slate-50 outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Telefon</label>
              <input type="tel" placeholder="+49 ..." className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
            </div>
            <div className="flex justify-end">
              <button className="bg-blueprint hover:bg-primary text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors">Änderungen speichern</button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-7">
          <h2 className="text-lg font-black text-blueprint mb-6">Passwort</h2>
          <div className="space-y-5">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Aktuelles Passwort</label>
              <input type="password" className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Neues Passwort</label>
                <input type="password" className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Passwort bestätigen</label>
                <input type="password" className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
              </div>
            </div>
            <div className="flex justify-end">
              <button className="bg-blueprint hover:bg-primary text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors">Passwort ändern</button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-7">
          <h2 className="text-lg font-black text-blueprint mb-2">Abrechnung & Tarif</h2>
          <p className="text-sm text-slate-500 mb-6">Verwalten Sie Ihr Abonnement und Ihre Zahlungsmethode.</p>
          <div className="bg-slate-50 rounded-xl p-5 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Aktueller Tarif</div>
              <div className="font-black text-blueprint">Kostenlos (Keine Inserate)</div>
            </div>
            <button className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors">Tarif wählen</button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-7">
          <h2 className="text-lg font-black text-blueprint mb-2">Daten & Datenschutz</h2>
          <p className="text-sm text-slate-500 mb-6">DSGVO-Datenverwaltung und Kontolöschung.</p>
          <div className="space-y-4">
            <button className="w-full flex items-center justify-between py-3 px-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors text-left">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-lg text-slate-400">download</span>
                <div>
                  <p className="text-sm font-bold text-blueprint">Meine Daten exportieren</p>
                  <p className="text-xs text-slate-400">Alle Ihre Daten als JSON + PDF herunterladen (DSGVO Art. 20)</p>
                </div>
              </div>
              <span className="material-symbols-outlined text-slate-400">chevron_right</span>
            </button>
            <button className="w-full flex items-center justify-between py-3 px-4 rounded-xl border border-red-200 hover:border-red-300 hover:bg-red-50/50 transition-colors text-left">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-lg text-red-400">delete_forever</span>
                <div>
                  <p className="text-sm font-bold text-red-600">Konto löschen</p>
                  <p className="text-xs text-red-400">Konto und alle Daten dauerhaft löschen (14 Tage Widerrufsfrist)</p>
                </div>
              </div>
              <span className="material-symbols-outlined text-red-400">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
