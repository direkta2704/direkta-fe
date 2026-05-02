"use client";

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
            <span className="text-lg font-black tracking-tight" translate="no" suppressHydrationWarning>DIREKTA<span className="text-primary">.</span></span>
          </Link>
          <div className="flex items-center gap-4">
            <button onClick={() => typeof window !== "undefined" && window.print()} className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 hover:text-primary transition-colors flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">print</span>
              Drucken
            </button>
            <Link href="/" className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 hover:text-primary transition-colors">
              Zurück zur Startseite
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-black text-blueprint tracking-tight mb-2">{title}</h1>
        <p className="text-sm text-slate-400 mb-12">Zuletzt aktualisiert: {lastUpdated}</p>

        <div className="legal-content max-w-none [&_h2]:text-2xl [&_h2]:font-black [&_h2]:text-blueprint [&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:pt-6 [&_h2]:border-t [&_h2]:border-slate-100 [&_h3]:text-lg [&_h3]:font-black [&_h3]:text-blueprint [&_h3]:mt-8 [&_h3]:mb-3 [&_p]:text-slate-600 [&_p]:leading-relaxed [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul]:space-y-1 [&_li]:text-slate-600 [&_li]:leading-relaxed [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_ol]:space-y-1 [&_a]:text-primary [&_a]:hover:underline [&_strong]:text-blueprint [&_strong]:font-bold [&_br]:mb-1">
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
