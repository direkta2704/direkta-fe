import Link from "next/link";

export default function LegalLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="material-symbols-outlined text-2xl text-primary">home_work</span>
            <span className="text-lg font-black tracking-tight">DIREKTA<span className="text-primary">.</span></span>
          </Link>
          <Link href="/" className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 hover:text-primary transition-colors">
            Zurück zur Startseite
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-black text-blueprint tracking-tight mb-2">{title}</h1>
        <p className="text-sm text-slate-400 mb-12">Zuletzt aktualisiert: {lastUpdated}</p>

        <div className="prose prose-slate max-w-none prose-headings:font-black prose-headings:text-blueprint prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4 prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-3 prose-p:text-slate-600 prose-p:leading-relaxed prose-li:text-slate-600 prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
          {children}
        </div>
      </div>

      <footer className="border-t border-slate-200 py-8 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-slate-400">© 2026 Direkta GmbH · Deutschland</p>
          <div className="flex items-center gap-6 text-xs text-slate-400">
            <Link href="/impressum" className="hover:text-blueprint transition-colors">Impressum</Link>
            <Link href="/datenschutz" className="hover:text-blueprint transition-colors">Datenschutz</Link>
            <Link href="/agb" className="hover:text-blueprint transition-colors">AGB</Link>
            <Link href="/widerrufsrecht" className="hover:text-blueprint transition-colors">Widerrufsrecht</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
