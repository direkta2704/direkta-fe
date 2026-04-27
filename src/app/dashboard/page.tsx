import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth();
  const firstName = session?.user?.name?.split(" ")[0] || "";

  return (
    <>
      <div className="mb-10">
        <h1 className="text-3xl font-black text-blueprint tracking-tight">
          Willkommen, {firstName}
        </h1>
        <p className="text-slate-500 mt-1">
          Hier ist der aktuelle Stand Ihrer Immobilien.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        <StatCard icon="description" label="Aktive Inserate" value="0" color="primary" />
        <StatCard icon="people" label="Interessenten diese Woche" value="0" color="blue" />
        <StatCard icon="handshake" label="Offene Angebote" value="0" color="emerald" />
        <StatCard icon="calendar_month" label="Anstehende Besichtigungen" value="0" color="violet" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 p-7">
            <h2 className="text-lg font-black text-blueprint mb-5">Schnellaktionen</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <QuickAction icon="add_home" title="Inserat erstellen" description="Starten Sie mit dem Exposé-Assistenten oder füllen Sie das Formular aus" href="/dashboard/properties" />
              <QuickAction icon="forum" title="Exposé-Assistent" description="Erstellen Sie Ihr Inserat in einem geführten Gespräch" href="/dashboard/listings" />
              <QuickAction icon="sync_alt" title="IS24 verbinden" description="Veröffentlichen Sie Ihr Inserat auf ImmobilienScout24" href="/dashboard/syndication" />
              <QuickAction icon="finance" title="Preisschätzung" description="Erhalten Sie eine kostenlose Bewertung Ihrer Immobilie" href="/dashboard/properties" />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-7 mt-6">
            <h2 className="text-lg font-black text-blueprint mb-5">Letzte Aktivitäten</h2>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="material-symbols-outlined text-5xl text-slate-300 mb-4">history</span>
              <p className="text-slate-400 font-medium">Noch keine Aktivitäten</p>
              <p className="text-sm text-slate-400 mt-1">Erstellen Sie Ihr erstes Inserat, um loszulegen.</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-blueprint rounded-2xl p-7 text-white">
            <h2 className="text-lg font-black mb-5">Erste Schritte</h2>
            <div className="space-y-4">
              <ChecklistItem done label="Konto erstellt" />
              <ChecklistItem label="Immobilie hinzufügen" />
              <ChecklistItem label="Fotos hochladen (mind. 6)" />
              <ChecklistItem label="Energieausweis hochladen" />
              <ChecklistItem label="Inserat prüfen & veröffentlichen" />
              <ChecklistItem label="ImmobilienScout24 verbinden" />
            </div>
            <div className="mt-6 pt-5 border-t border-white/10">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">Fortschritt</span>
                <span className="font-black text-primary">1 / 6</span>
              </div>
              <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full w-[16%] transition-all" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-7">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined">support_agent</span>
              </div>
              <div>
                <h3 className="font-black text-blueprint text-sm">Brauchen Sie Hilfe?</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">Unser Team steht Ihnen bei jedem Schritt des Verkaufsprozesses zur Seite.</p>
                <button className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-primary hover:text-primary-dark transition-colors">Support kontaktieren</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    violet: "bg-violet-50 text-violet-600",
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-primary/30 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl ${colorMap[color]} flex items-center justify-center`}>
          <span className="material-symbols-outlined text-xl">{icon}</span>
        </div>
      </div>
      <p className="text-3xl font-black text-blueprint">{value}</p>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-1">{label}</p>
    </div>
  );
}

function QuickAction({ icon, title, description, href }: { icon: string; title: string; description: string; href: string }) {
  return (
    <a href={href} className="flex items-start gap-4 p-4 rounded-xl border border-slate-100 hover:border-primary/30 hover:bg-primary/[0.02] transition-all group">
      <div className="w-10 h-10 rounded-xl bg-blueprint group-hover:bg-primary text-white flex items-center justify-center flex-shrink-0 transition-colors">
        <span className="material-symbols-outlined text-xl">{icon}</span>
      </div>
      <div>
        <h3 className="font-black text-blueprint text-sm">{title}</h3>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
    </a>
  );
}

function ChecklistItem({ label, done }: { label: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`material-symbols-outlined text-lg ${done ? "text-primary" : "text-white/20"}`}>
        {done ? "check_circle" : "radio_button_unchecked"}
      </span>
      <span className={`text-sm ${done ? "text-white/40 line-through" : "text-white/80"}`}>{label}</span>
    </div>
  );
}
