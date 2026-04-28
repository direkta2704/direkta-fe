import { auth } from "@/lib/auth";
import GDPRSection from "./gdpr-section";

export default async function SettingsPage() {
  const session = await auth();

  return (
    <>
      <div className="mb-8 max-w-3xl mx-auto">
        <h1 className="text-3xl font-black text-blueprint tracking-tight">Einstellungen</h1>
        <p className="text-slate-500 mt-1">Verwalten Sie Ihr Konto, Ihre Abrechnung und Ihre Einstellungen.</p>
      </div>

      <div className="max-w-3xl mx-auto space-y-6">
        {/* Profile */}
        <div className="bg-white rounded-2xl border border-slate-200 p-7">
          <h2 className="text-lg font-black text-blueprint mb-6">Profil</h2>
          <div className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Vollstaendiger Name</label>
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
              <button className="bg-blueprint hover:bg-primary text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors">Aenderungen speichern</button>
            </div>
          </div>
        </div>

        {/* Password */}
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
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Passwort bestaetigen</label>
                <input type="password" className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
              </div>
            </div>
            <div className="flex justify-end">
              <button className="bg-blueprint hover:bg-primary text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors">Passwort aendern</button>
            </div>
          </div>
        </div>

        {/* Billing */}
        <div className="bg-white rounded-2xl border border-slate-200 p-7">
          <h2 className="text-lg font-black text-blueprint mb-2">Abrechnung & Tarif</h2>
          <p className="text-sm text-slate-500 mb-6">Verwalten Sie Ihr Abonnement und Ihre Zahlungsmethode.</p>
          <div className="bg-slate-50 rounded-xl p-5 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Aktueller Tarif</div>
              <div className="font-black text-blueprint">Kostenlos (Keine Inserate)</div>
            </div>
            <button className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors">Tarif waehlen</button>
          </div>
        </div>

        {/* GDPR — client component */}
        <GDPRSection />
      </div>
    </>
  );
}
