"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import AuthModal from "./components/auth-modal";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [modalView, setModalView] = useState<"signin" | "signup" | null>(null);
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  useEffect(() => {
    const nav = document.getElementById("navShell");
    const onScroll = () => {
      if (!nav) return;
      if (window.scrollY > 30) {
        nav.classList.add("scrolled");
      } else {
        nav.classList.remove("scrolled");
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

    const handleAnchorClick = (e: Event) => {
      const anchor = e.currentTarget as HTMLAnchorElement;
      const id = anchor.getAttribute("href");
      if (id && id.length > 1 && id.startsWith("#")) {
        const target = document.querySelector(id);
        if (target) {
          e.preventDefault();
          window.scrollTo({
            top: (target as HTMLElement).offsetTop - 60,
            behavior: "smooth",
          });
        }
      }
    };
    const anchors = document.querySelectorAll('a[href^="#"]');
    anchors.forEach((a) => a.addEventListener("click", handleAnchorClick));

    return () => {
      window.removeEventListener("scroll", onScroll);
      io.disconnect();
      anchors.forEach((a) =>
        a.removeEventListener("click", handleAnchorClick)
      );
    };
  }, []);

  return (
    <>
      {/* ========== NAVBAR ========== */}
      <header className="fixed top-0 left-0 right-0 z-100 flex justify-center px-4">
        <div
          id="navShell"
          className="nav-shell w-full max-w-[1400px] mt-0 rounded-none bg-white/70 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-4 sm:px-6 py-3.5"
        >
          <a href="#" className="flex items-center gap-2 group flex-shrink-0">
            <span className="material-symbols-outlined text-3xl text-primary transition-transform duration-500 group-hover:rotate-12">
              home_work
            </span>
            <span className="text-xl font-black tracking-tight display-font">
              DIREKTA<span className="text-primary">.</span>
            </span>
          </a>
          <nav className="hidden lg:flex items-center gap-6 whitespace-nowrap">
            <a href="#how" className="underline-link text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 hover:text-primary transition-colors">
              So funktioniert&apos;s
            </a>
            <a href="#modules" className="underline-link text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 hover:text-primary transition-colors">
              Module
            </a>
            <a href="#compare" className="underline-link text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 hover:text-primary transition-colors">
              Vergleich
            </a>
            <a href="#pricing" className="underline-link text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 hover:text-primary transition-colors">
              Preise
            </a>
          </nav>
          <div className="flex items-center gap-2 flex-shrink-0">
            {session?.user ? (
              <>
                <span className="hidden md:inline-block text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 px-3 py-2 truncate max-w-[140px]">
                  {session.user.name || session.user.email}
                </span>
                <button
                  onClick={() => signOut()}
                  className="hidden sm:flex bg-blueprint hover:bg-primary text-white px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-[0.18em] transition-all duration-300 hover:scale-[1.03] items-center gap-1.5"
                >
                  Abmelden
                  <span className="material-symbols-outlined text-base">logout</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setModalView("signin")}
                  className="hidden md:inline-block text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 hover:text-primary transition-colors px-3 py-2"
                >
                  Login
                </button>
                <button
                  onClick={() => setModalView("signup")}
                  className="hidden sm:flex bg-blueprint hover:bg-primary text-white px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-[0.18em] transition-all duration-300 hover:scale-[1.03] items-center gap-1.5 whitespace-nowrap"
                >
                  Kostenlos starten
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                </button>
              </>
            )}
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileNav(!mobileNav)}
              className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl text-blueprint hover:bg-slate-100 transition-colors"
              aria-label="Menü"
            >
              <span className="material-symbols-outlined text-2xl">
                {mobileNav ? "close" : "menu"}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileNav && (
          <div className="lg:hidden fixed inset-x-0 top-[60px] bg-white/95 backdrop-blur-lg border-b border-slate-200 shadow-xl z-[99] animate-[fadeIn_0.2s_ease]">
            <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-2">
              {[
                { href: "#how", label: "So funktioniert's" },
                { href: "#modules", label: "Module" },
                { href: "#compare", label: "Vergleich" },
                { href: "#pricing", label: "Preise" },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileNav(false)}
                  className="block py-3 px-4 rounded-xl text-sm font-black uppercase tracking-[0.15em] text-blueprint hover:bg-primary/5 hover:text-primary transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-4 mt-2 border-t border-slate-100 space-y-3">
                {session?.user ? (
                  <button
                    onClick={() => { signOut(); setMobileNav(false); }}
                    className="w-full bg-blueprint text-white py-3 rounded-xl text-sm font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2"
                  >
                    Abmelden
                    <span className="material-symbols-outlined text-base">logout</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => { setModalView("signin"); setMobileNav(false); }}
                      className="w-full bg-white border border-slate-200 text-blueprint py-3 rounded-xl text-sm font-black uppercase tracking-[0.15em]"
                    >
                      Login
                    </button>
                    <button
                      onClick={() => { setModalView("signup"); setMobileNav(false); }}
                      className="w-full bg-primary text-white py-3 rounded-xl text-sm font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2"
                    >
                      Kostenlos starten
                      <span className="material-symbols-outlined text-base">arrow_forward</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* ========== HERO ========== */}
        <section className="relative pt-36 lg:pt-44 pb-24 px-6 overflow-hidden">
          <div className="absolute inset-0 grid-pattern -z-10"></div>
          <div className="absolute top-32 -right-32 w-[480px] h-[480px] rounded-full bg-primary/10 blur-[120px] -z-10"></div>
          <div className="absolute -bottom-32 -left-32 w-[420px] h-[420px] rounded-full bg-blueprint/5 blur-[120px] -z-10"></div>

          <div className="max-w-7xl mx-auto">
            {/* Eyebrow */}
            <div className="flex justify-center mb-8 anim-fade">
              <div className="inline-flex items-center gap-2 rounded-full bg-white border border-slate-200 px-4 py-2 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-700">
                  Für Deutschland gebaut · DSGVO · GwG · GEG
                </span>
              </div>
            </div>

            {/* Headline */}
            <h1 className="text-center font-black tracking-[-0.04em] leading-[0.88] text-blueprint">
              <span className="block text-[14vw] sm:text-[10vw] lg:text-[8.5rem] anim-rise">
                Immobilie verkaufen.
              </span>
              <span className="block text-[14vw] sm:text-[10vw] lg:text-[8.5rem] anim-rise delay-200">
                <span className="text-stroke">Ohne</span>{" "}
                <span className="text-primary">Makler.</span>
              </span>
            </h1>

            {/* Subhead */}
            <p className="mt-10 max-w-2xl mx-auto text-center text-lg lg:text-xl text-slate-600 font-medium leading-relaxed anim-rise delay-400">
              Direkta ist ein vollständiger, softwaregestützter Verkaufsprozess
              für deutsche Immobilienbesitzer. Inserat, Preisfindung,
              qualifizierte Interessenten, Angebote und Notar — alles an einem
              Ort.{" "}
              <span className="font-bold text-blueprint">
                Keine 3,57% Provision.
              </span>
            </p>

            {/* CTAs */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 anim-rise delay-500">
              <button
                onClick={() => setModalView("signup")}
                className="group bg-primary hover:bg-primary-dark text-white px-8 py-4 rounded-full text-sm font-black uppercase tracking-[0.18em] transition-all duration-300 hover:scale-[1.03] shadow-xl shadow-primary/30 flex items-center gap-2"
              >
                Jetzt Preis erfahren
                <span className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1">
                  arrow_forward
                </span>
              </button>
              <a
                href="#how"
                className="group flex items-center gap-2 text-blueprint font-black text-sm uppercase tracking-[0.18em] underline-link"
              >
                So funktioniert&apos;s
              </a>
            </div>

            {/* Hero visual: Savings counter card */}
            <div className="mt-20 max-w-5xl mx-auto anim-fade delay-700">
              <div className="bg-blueprint rounded-[2rem] p-2 shadow-2xl shadow-blueprint/20">
                <div className="bg-blueprint blueprint-grid rounded-[1.75rem] p-8 lg:p-12 relative overflow-hidden">
                  {/* top bar */}
                  <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-2 text-white/60">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-400"></span>
                      <span className="h-2.5 w-2.5 rounded-full bg-yellow-400"></span>
                      <span className="h-2.5 w-2.5 rounded-full bg-green-400"></span>
                      <span className="ml-3 text-[10px] font-black uppercase tracking-[0.2em]">
                        direkta.de/dashboard
                      </span>
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                      Live-Berechnung
                    </div>
                  </div>

                  <div className="grid lg:grid-cols-3 gap-8 items-center">
                    {/* Without Direkta */}
                    <div className="border border-white/10 bg-white/[0.03] rounded-2xl p-6">
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50 mb-3">
                        Ohne Direkta
                      </div>
                      <div className="text-4xl font-black text-white/90 counter-num">
                        €17.850
                      </div>
                      <div className="text-xs text-white/50 mt-2">
                        Maklerprovision · 3,57%
                      </div>
                      <div className="mt-6 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                        ~ 20 Wochen
                      </div>
                    </div>

                    {/* Arrow / equation */}
                    <div className="flex flex-col items-center justify-center text-center py-6 lg:py-0">
                      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-3">
                        Sie sparen
                      </div>
                      <div
                        className="text-5xl lg:text-6xl font-black bignum text-primary counter-num"
                        id="bigSavings"
                      >
                        €16.851
                      </div>
                      <div className="mt-3 text-xs text-white/60">
                        bei einem Verkauf von €500.000
                      </div>
                      <div className="mt-4 inline-flex items-center gap-2 text-white/80">
                        <span className="material-symbols-outlined text-base">
                          trending_down
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                          ~12 Wochen schneller
                        </span>
                      </div>
                    </div>

                    {/* With Direkta */}
                    <div className="border border-primary/40 bg-primary/10 rounded-2xl p-6 relative">
                      <div className="absolute -top-2 -right-2 bg-primary text-white text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-widest">
                        Direkta
                      </div>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-3">
                        Mit Direkta
                      </div>
                      <div className="text-4xl font-black text-white counter-num">
                        €999
                      </div>
                      <div className="text-xs text-white/70 mt-2">
                        Festpreis · oder 1% max. €4.900
                      </div>
                      <div className="mt-6 text-[10px] font-black uppercase tracking-[0.2em] text-white/70">
                        ~ 8 Wochen
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========== TRUST MARQUEE ========== */}
        <section className="bg-white border-y border-slate-100 py-8 overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 mb-6 flex items-center justify-center">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
              Vertrauenswürdiger Prozess · Rundum-Abdeckung
            </span>
          </div>
          <div className="relative">
            <div className="flex marquee-track gap-12 whitespace-nowrap">
              <div className="flex items-center gap-12 text-slate-400">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl">
                    verified
                  </span>
                  <span className="text-sm font-black uppercase tracking-widest">
                    DSGVO-konform
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl">
                    gavel
                  </span>
                  <span className="text-sm font-black uppercase tracking-widest">
                    GwG-konform
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl">
                    eco
                  </span>
                  <span className="text-sm font-black uppercase tracking-widest">
                    GEG-Pflichtangaben
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl">
                    apartment
                  </span>
                  <span className="text-sm font-black uppercase tracking-widest">
                    ImmoScout24 Sync
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl">
                    description
                  </span>
                  <span className="text-sm font-black uppercase tracking-widest">
                    Notar-Paket
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl">
                    credit_score
                  </span>
                  <span className="text-sm font-black uppercase tracking-widest">
                    Finanzierungsprüfung
                  </span>
                </div>
              </div>
              <div
                className="flex items-center gap-12 text-slate-400"
                aria-hidden="true"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl">
                    verified
                  </span>
                  <span className="text-sm font-black uppercase tracking-widest">
                    DSGVO-konform
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl">
                    gavel
                  </span>
                  <span className="text-sm font-black uppercase tracking-widest">
                    GwG-konform
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl">
                    eco
                  </span>
                  <span className="text-sm font-black uppercase tracking-widest">
                    GEG-Pflichtangaben
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl">
                    apartment
                  </span>
                  <span className="text-sm font-black uppercase tracking-widest">
                    ImmoScout24 Sync
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl">
                    description
                  </span>
                  <span className="text-sm font-black uppercase tracking-widest">
                    Notar-Paket
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl">
                    credit_score
                  </span>
                  <span className="text-sm font-black uppercase tracking-widest">
                    Finanzierungsprüfung
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========== STATS ========== */}
        <section className="py-20 px-6 bg-white">
          <div className="max-w-7xl mx-auto reveal">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-12 gap-x-8">
              <div className="border-l-4 border-primary pl-6">
                <p className="bignum text-5xl lg:text-6xl text-blueprint counter-num">
                  €500K
                </p>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mt-2">
                  Beispiel-Immobilienwert
                </p>
              </div>
              <div className="border-l-4 border-slate-200 pl-6">
                <p className="bignum text-5xl lg:text-6xl text-blueprint counter-num">
                  8 Wo.
                </p>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mt-2">
                  Durchschn. Verkaufsdauer
                </p>
              </div>
              <div className="border-l-4 border-slate-200 pl-6">
                <p className="bignum text-5xl lg:text-6xl text-blueprint counter-num">
                  15 min
                </p>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mt-2">
                  Bis zum fertigen Inserat
                </p>
              </div>
              <div className="border-l-4 border-slate-200 pl-6">
                <p className="bignum text-5xl lg:text-6xl text-blueprint counter-num">
                  0%
                </p>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mt-2">
                  Maklerprovision
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========== HOW IT WORKS ========== */}
        <section id="how" className="py-28 px-6 bg-background-light light-grid">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-12 gap-16 items-start">
              {/* Left */}
              <div className="lg:col-span-5 lg:sticky lg:top-32 reveal">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-primary mb-6">
                  <span className="material-symbols-outlined text-sm">
                    flag
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                    Der Direkta-Prozess
                  </span>
                </div>
                <h2 className="text-5xl lg:text-7xl font-black tracking-[-0.04em] leading-[0.9] text-blueprint">
                  Ein geführter Verkaufsprozess,
                  <br />
                  <span className="text-primary">kein KI-Tool.</span>
                </h2>
                <p className="mt-8 text-lg text-slate-600 leading-relaxed">
                  Eigentümer scheitern nicht am Verkauf, weil ihnen ein Chatbot
                  fehlt. Sie scheitern, weil sie nicht wissen, wie man den Preis
                  richtig ansetzt, Käufer qualifiziert oder einen Deal sicher zum
                  Notar bringt. Direkta ist die komplette Pipeline — Software
                  statt Makler.
                </p>
                <a
                  href="#modules"
                  className="mt-8 inline-flex items-center gap-2 text-blueprint font-black text-sm uppercase tracking-[0.18em] underline-link"
                >
                  Module entdecken
                  <span className="material-symbols-outlined text-base">
                    arrow_forward
                  </span>
                </a>
              </div>

              {/* Right: Steps */}
              <div className="lg:col-span-7 reveal-stagger reveal">
                <div className="space-y-6">
                  {/* Step 1 */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-8 hover:border-primary transition-all duration-500 group">
                    <div className="flex items-start gap-6">
                      <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-blueprint group-hover:bg-primary text-white flex items-center justify-center text-xl font-black transition-colors duration-500 counter-num">
                        01
                      </div>
                      <div className="flex-1">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2">
                          Onboarding · Tag 1
                        </div>
                        <h3 className="text-2xl font-black text-blueprint mb-2">
                          Sprechen Sie mit dem Expos&eacute;-Assistenten
                        </h3>
                        <p className="text-slate-600 leading-relaxed">
                          Ein 15–20 minütiges Gespräch auf Deutsch. Der Assistent
                          stellt eine Frage nach der anderen, akzeptiert Ihre
                          Fotos und Ihren Energieausweis, und erstellt ein
                          vollständiges, GEG-konformes Inserat.
                        </p>
                      </div>
                    </div>
                  </div>
                  {/* Step 2 */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-8 hover:border-primary transition-all duration-500 group">
                    <div className="flex items-start gap-6">
                      <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-blueprint group-hover:bg-primary text-white flex items-center justify-center text-xl font-black transition-colors duration-500 counter-num">
                        02
                      </div>
                      <div className="flex-1">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2">
                          Preis · Tag 1
                        </div>
                        <h3 className="text-2xl font-black text-blueprint mb-2">
                          Drei Preisstrategien erhalten
                        </h3>
                        <p className="text-slate-600 leading-relaxed">
                          Schnellverkauf, Realistisch oder Maximum — jede gestützt
                          durch anonymisierte Vergleichstransaktionen und einen
                          Konfidenzwert. Keine Black-Box-KI, keine Makler-Intuition.
                        </p>
                      </div>
                    </div>
                  </div>
                  {/* Step 3 */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-8 hover:border-primary transition-all duration-500 group">
                    <div className="flex items-start gap-6">
                      <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-blueprint group-hover:bg-primary text-white flex items-center justify-center text-xl font-black transition-colors duration-500 counter-num">
                        03
                      </div>
                      <div className="flex-1">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2">
                          Verteilen · Tag 2
                        </div>
                        <h3 className="text-2xl font-black text-blueprint mb-2">
                          Automatisch auf ImmoScout24 veröffentlichen
                        </h3>
                        <p className="text-slate-600 leading-relaxed">
                          Der Listing-Agent veröffentlicht Ihr Inserat innerhalb
                          von 30 Minuten auf IS24 und ruft Aufrufe, Kontakte und
                          Vormerkungen in einem Posteingang ab. Kein Kopieren
                          zwischen Systemen.
                        </p>
                      </div>
                    </div>
                  </div>
                  {/* Step 4 */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-8 hover:border-primary transition-all duration-500 group">
                    <div className="flex items-start gap-6">
                      <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-blueprint group-hover:bg-primary text-white flex items-center justify-center text-xl font-black transition-colors duration-500 counter-num">
                        04
                      </div>
                      <div className="flex-1">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2">
                          Betrieb · Woche 1–6
                        </div>
                        <h3 className="text-2xl font-black text-blueprint mb-2">
                          Qualifizierte Interessenten, bewertete Angebote
                        </h3>
                        <p className="text-slate-600 leading-relaxed">
                          Jede Anfrage wird nach Budget, Finanzierungsstatus und
                          Zeitrahmen bewertet. Angebote landen in einem
                          strukturierten Dashboard mit Risiko-Flags und
                          Vergleich der Top-3.
                        </p>
                      </div>
                    </div>
                  </div>
                  {/* Step 5 */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-8 hover:border-primary transition-all duration-500 group">
                    <div className="flex items-start gap-6">
                      <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-blueprint group-hover:bg-primary text-white flex items-center justify-center text-xl font-black transition-colors duration-500 counter-num">
                        05
                      </div>
                      <div className="flex-1">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2">
                          Abschluss · Woche 8
                        </div>
                        <h3 className="text-2xl font-black text-blueprint mb-2">
                          Ein Klick zum Notar
                        </h3>
                        <p className="text-slate-600 leading-relaxed">
                          Nehmen Sie ein Angebot an und Direkta erstellt die
                          Reservierungsvereinbarung und ein vollständiges
                          Dokumentenpaket für den Notar. Sie kommen vorbereitet.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========== MODULES ========== */}
        <section
          id="modules"
          className="py-28 px-6 bg-blueprint relative overflow-hidden"
        >
          <div className="absolute inset-0 blueprint-grid opacity-50"></div>
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[160px]"></div>

          <div className="max-w-7xl mx-auto relative">
            <div className="text-center max-w-3xl mx-auto mb-20 reveal">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/10 px-4 py-1.5 text-primary mb-6">
                <span className="material-symbols-outlined text-sm">
                  grid_view
                </span>
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                  Sechs Kernmodule
                </span>
              </div>
              <h2 className="text-5xl lg:text-7xl font-black tracking-[-0.04em] leading-[0.9] text-white">
                Alles, was ein Makler tut.
                <br />
                <span className="text-primary">Als Software.</span>
              </h2>
              <p className="mt-8 text-lg text-white/70 leading-relaxed">
                Vier Produktmodule und zwei KI-Agenten, die übergreifend
                arbeiten. Jede Funktion dient einer Hypothese: Ein
                Immobilienbesitzer kann schneller oder günstiger verkaufen als
                mit einem Makler — ohne den Immobilienprozess verstehen zu müssen.
              </p>
            </div>

            {/* Module grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 reveal-stagger reveal">
              {/* M1 */}
              <div className="module-card bg-white/[0.04] border border-white/10 rounded-3xl p-7 backdrop-blur-sm relative overflow-hidden">
                <div className="absolute top-7 right-7 text-[10px] font-black text-primary tracking-widest counter-num">
                  M1
                </div>
                <div className="w-14 h-14 rounded-2xl bg-primary/15 text-primary flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-3xl">
                    photo_library
                  </span>
                </div>
                <h3 className="text-xl font-black text-white mb-3">
                  Intelligente Inserat-Erstellung
                </h3>
                <p className="text-sm text-white/60 leading-relaxed mb-5">
                  Erstellen Sie ein konformes, professionelles Expos&eacute; aus
                  Fotos und strukturierten Angaben — in unter 15 Minuten.
                </p>
                <div className="pt-4 border-t border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                  250–600 Wörter Beschreibung · GEG-geprüft
                </div>
              </div>
              {/* M2 */}
              <div className="module-card bg-white/[0.04] border border-white/10 rounded-3xl p-7 backdrop-blur-sm relative overflow-hidden">
                <div className="absolute top-7 right-7 text-[10px] font-black text-primary tracking-widest counter-num">
                  M2
                </div>
                <div className="w-14 h-14 rounded-2xl bg-primary/15 text-primary flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-3xl">
                    finance
                  </span>
                </div>
                <h3 className="text-xl font-black text-white mb-3">
                  Preisfindung
                </h3>
                <p className="text-sm text-white/60 leading-relaxed mb-5">
                  Eine fundierte Preisspanne und drei explizite Strategien,
                  abgeleitet aus anonymisierten Vergleichstransaktionen.
                </p>
                <div className="pt-4 border-t border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                  Schnell · Realistisch · Maximum
                </div>
              </div>
              {/* M3 */}
              <div className="module-card bg-white/[0.04] border border-white/10 rounded-3xl p-7 backdrop-blur-sm relative overflow-hidden">
                <div className="absolute top-7 right-7 text-[10px] font-black text-primary tracking-widest counter-num">
                  M3
                </div>
                <div className="w-14 h-14 rounded-2xl bg-primary/15 text-primary flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-3xl">
                    filter_alt
                  </span>
                </div>
                <h3 className="text-xl font-black text-white mb-3">
                  Interessenten-Trichter & Qualifizierung
                </h3>
                <p className="text-sm text-white/60 leading-relaxed mb-5">
                  Jede Anfrage wird 0–100 nach Budget, Finanzierung und
                  Zeitrahmen bewertet. Keine Schaulustigen in Ihrem Posteingang.
                </p>
                <div className="pt-4 border-t border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                  Auto-qualifiziert · Kalender-synchronisiert
                </div>
              </div>
              {/* M4 */}
              <div className="module-card bg-white/[0.04] border border-white/10 rounded-3xl p-7 backdrop-blur-sm relative overflow-hidden">
                <div className="absolute top-7 right-7 text-[10px] font-black text-primary tracking-widest counter-num">
                  M4
                </div>
                <div className="w-14 h-14 rounded-2xl bg-primary/15 text-primary flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-3xl">
                    leaderboard
                  </span>
                </div>
                <h3 className="text-xl font-black text-white mb-3">
                  Angebots-Dashboard
                </h3>
                <p className="text-sm text-white/60 leading-relaxed mb-5">
                  Angebote empfangen, bewerten und vergleichen. Top-3 im
                  Direktvergleich und mit einem Klick zum Notar.
                </p>
                <div className="pt-4 border-t border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                  KYC-geprüft · Risiko-markiert
                </div>
              </div>
              {/* M5 */}
              <div className="module-card bg-primary/10 border border-primary/30 rounded-3xl p-7 backdrop-blur-sm relative overflow-hidden">
                <div className="absolute top-7 right-7 text-[10px] font-black text-primary tracking-widest counter-num">
                  M5 · AGENT
                </div>
                <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-3xl">
                    forum
                  </span>
                </div>
                <h3 className="text-xl font-black text-white mb-3">
                  Expos&eacute;-Assistent
                </h3>
                <p className="text-sm text-white/70 leading-relaxed mb-5">
                  Ein zielgerichteter Gesprächs-Agent, der das komplette
                  Expos&eacute; im Dialog erstellt. Stellt eine Frage nach der
                  anderen. Prüft sich selbst gegen Qualitätskriterien.
                </p>
                <div className="pt-4 border-t border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                  Konversationell · Mehrstufig · Selbstprüfend
                </div>
              </div>
              {/* M6 */}
              <div className="module-card bg-primary/10 border border-primary/30 rounded-3xl p-7 backdrop-blur-sm relative overflow-hidden">
                <div className="absolute top-7 right-7 text-[10px] font-black text-primary tracking-widest counter-num">
                  M6 · AGENT
                </div>
                <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-3xl">
                    sync_alt
                  </span>
                </div>
                <h3 className="text-xl font-black text-white mb-3">
                  Listing-Agent
                </h3>
                <p className="text-sm text-white/70 leading-relaxed mb-5">
                  Bidirektionale Synchronisation mit ImmobilienScout24.
                  Veröffentlicht Inserate, ruft Aufrufe, Kontakte und
                  Vormerkungen ab — in einer einzigen Quelle der Wahrheit.
                </p>
                <div className="pt-4 border-t border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                  IS24 sync · 30-min publish · Daily stats
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========== COMPARE — JOURNEY ========== */}
        <section
          id="compare"
          className="py-28 px-6 bg-background-light light-grid"
        >
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-16 reveal">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-primary mb-6">
                <span className="material-symbols-outlined text-sm">
                  compare_arrows
                </span>
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                  Der ehrliche Vergleich
                </span>
              </div>
              <h2 className="text-5xl lg:text-7xl font-black tracking-[-0.04em] leading-[0.9] text-blueprint">
                Gleiche Immobilie.
                <br />
                <span className="text-primary">Zwei Wege.</span>
              </h2>
            </div>

            {/* Header row */}
            <div className="reveal">
              <div className="hidden md:grid grid-cols-12 gap-4 mb-4 px-4">
                <div className="col-span-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Phase
                </div>
                <div className="col-span-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Ohne Direkta
                </div>
                <div className="col-span-4 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                  Mit Direkta
                </div>
                <div className="col-span-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">
                  Ersparnis
                </div>
              </div>

              {/* Rows */}
              <div className="bg-white border border-slate-200 rounded-3xl divide-y divide-slate-100 overflow-hidden">
                {/* Row 1 */}
                <div className="journey-row grid md:grid-cols-12 gap-4 p-6 items-center">
                  <div className="md:col-span-3">
                    <div className="text-xs font-black uppercase tracking-widest text-slate-400 md:hidden mb-1">
                      Phase
                    </div>
                    <div className="font-black text-blueprint text-lg">
                      Onboarding
                    </div>
                  </div>
                  <div className="md:col-span-4 text-sm text-slate-600">
                    Makler suchen · 3–5 treffen · Maklervertrag unterschreiben
                  </div>
                  <div className="md:col-span-4 text-sm text-blueprint font-medium">
                    Login + Expos&eacute;-Assistent (15–20 Min.)
                  </div>
                  <div className="md:col-span-1 text-right">
                    <span className="inline-block bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-black">
                      ~3 Wo.
                    </span>
                  </div>
                </div>
                {/* Row 2 */}
                <div className="journey-row grid md:grid-cols-12 gap-4 p-6 items-center">
                  <div className="md:col-span-3">
                    <div className="font-black text-blueprint text-lg">
                      Inserat-Vorbereitung
                    </div>
                  </div>
                  <div className="md:col-span-4 text-sm text-slate-600">
                    Fototermin des Maklers · generisches Expos&eacute;
                  </div>
                  <div className="md:col-span-4 text-sm text-blueprint font-medium">
                    KI-erstelltes Expos&eacute; · Verkäufer bearbeitet · Compliance-Prüfung
                  </div>
                  <div className="md:col-span-1 text-right">
                    <span className="inline-block bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-black">
                      ~2 Wo.
                    </span>
                  </div>
                </div>
                {/* Row 3 */}
                <div className="journey-row grid md:grid-cols-12 gap-4 p-6 items-center">
                  <div className="md:col-span-3">
                    <div className="font-black text-blueprint text-lg">
                      Preise
                    </div>
                  </div>
                  <div className="md:col-span-4 text-sm text-slate-600">
                    Vom Makler festgelegt · intransparent · auf schnellen Abschluss optimiert
                  </div>
                  <div className="md:col-span-4 text-sm text-blueprint font-medium">
                    Drei explizite Strategien mit Vergleichswerten
                  </div>
                  <div className="md:col-span-1 text-right">
                    <span className="inline-block bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-black">
                      Klarheit
                    </span>
                  </div>
                </div>
                {/* Row 4 */}
                <div className="journey-row grid md:grid-cols-12 gap-4 p-6 items-center">
                  <div className="md:col-span-3">
                    <div className="font-black text-blueprint text-lg">
                      Verteilung
                    </div>
                  </div>
                  <div className="md:col-span-4 text-sm text-slate-600">
                    Makler veröffentlicht auf Portalen nach eigenem Zeitplan
                  </div>
                  <div className="md:col-span-4 text-sm text-blueprint font-medium">
                    Auto-Veröffentlichung auf IS24 innerhalb von 30 Minuten
                  </div>
                  <div className="md:col-span-1 text-right">
                    <span className="inline-block bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-black">
                      ~1–2 Wo.
                    </span>
                  </div>
                </div>
                {/* Row 5 */}
                <div className="journey-row grid md:grid-cols-12 gap-4 p-6 items-center">
                  <div className="md:col-span-3">
                    <div className="font-black text-blueprint text-lg">
                      Interessenten
                    </div>
                  </div>
                  <div className="md:col-span-4 text-sm text-slate-600">
                    Vom Makler gefiltert · Verkäufer hat keinen Einblick
                  </div>
                  <div className="md:col-span-4 text-sm text-blueprint font-medium">
                    Auto-qualifiziert · nach Score sortiert · im Posteingang sichtbar
                  </div>
                  <div className="md:col-span-1 text-right">
                    <span className="inline-block bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-black">
                      Transparenz
                    </span>
                  </div>
                </div>
                {/* Row 6 */}
                <div className="journey-row grid md:grid-cols-12 gap-4 p-6 items-center">
                  <div className="md:col-span-3">
                    <div className="font-black text-blueprint text-lg">
                      Verhandlung
                    </div>
                  </div>
                  <div className="md:col-span-4 text-sm text-slate-600">
                    4–6 Wochen indirektes Hin und Her über den Makler
                  </div>
                  <div className="md:col-span-4 text-sm text-blueprint font-medium">
                    Strukturierte Angebote · bewertet · nebeneinander verglichen
                  </div>
                  <div className="md:col-span-1 text-right">
                    <span className="inline-block bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-black">
                      ~3–4 Wo.
                    </span>
                  </div>
                </div>
                {/* Row 7 */}
                <div className="journey-row grid md:grid-cols-12 gap-4 p-6 items-center">
                  <div className="md:col-span-3">
                    <div className="font-black text-blueprint text-lg">
                      Abschluss
                    </div>
                  </div>
                  <div className="md:col-span-4 text-sm text-slate-600">
                    2 Wochen: Makler bereitet Notartermin vor
                  </div>
                  <div className="md:col-span-4 text-sm text-blueprint font-medium">
                    1-Klick-Annahme · automatisch erstelltes Notar-Paket
                  </div>
                  <div className="md:col-span-1 text-right">
                    <span className="inline-block bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-black">
                      ~1 Wo.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Total bar */}
            <div className="mt-6 grid md:grid-cols-3 gap-4 reveal">
              <div className="bg-blueprint text-white rounded-3xl p-7">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50 mb-2">
                  Ohne Direkta
                </div>
                <div className="text-3xl font-black counter-num">
                  ~ 20 Wochen
                </div>
                <div className="text-sm text-white/60 mt-1">
                  €17.850 Provision
                </div>
              </div>
              <div className="bg-primary text-white rounded-3xl p-7">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70 mb-2">
                  Mit Direkta
                </div>
                <div className="text-3xl font-black counter-num">
                  ~ 8 Wochen
                </div>
                <div className="text-sm text-white/80 mt-1">€999 Festpreis</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-3xl p-7">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                  Netto-Ersparnis
                </div>
                <div className="text-3xl font-black text-blueprint counter-num">
                  €16,851
                </div>
                <div className="text-sm text-slate-500 mt-1">
                  ~12 Wochen schneller
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========== ARCHETYPES ========== */}
        <section className="py-28 px-6 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-12 gap-12 items-end mb-16 reveal">
              <div className="lg:col-span-7">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-primary mb-6">
                  <span className="material-symbols-outlined text-sm">
                    groups
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                    Für wen ist Direkta
                  </span>
                </div>
                <h2 className="text-5xl lg:text-6xl font-black tracking-[-0.04em] leading-[0.9] text-blueprint">
                  Für vier Arten
                  <br />
                  von Verkäufern gebaut.
                </h2>
              </div>
              <div className="lg:col-span-5">
                <p className="text-slate-600 leading-relaxed">
                  Das Onboarding ist für die ersten beiden Archetypen optimiert — aber
                  die Plattform bedient alle. Immobilientypen: ETW, EFH,
                  MFH, DHH, RH und Grundst&uuml;ck.
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 reveal-stagger reveal">
              {/* A */}
              <div className="bg-blueprint text-white rounded-3xl p-7 hover:scale-[1.02] transition-transform duration-500">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-4">
                  Archetyp A
                </div>
                <h3 className="text-2xl font-black mb-3">
                  Der Erbschaftsverkäufer
                </h3>
                <p className="text-sm text-white/60 leading-relaxed mb-5">
                  Erbe, 45–65, verkauft oft geerbte Immobilie in einer anderen
                  Stadt. Erbschaft, Steuerfristen, Erbengemeinschaft.
                </p>
                <div className="pt-4 border-t border-white/10 text-xs text-white/70">
                  Ortsunabhängig · geringer Aufwand · transparenter Prozess
                </div>
              </div>
              {/* B */}
              <div className="bg-blueprint text-white rounded-3xl p-7 hover:scale-[1.02] transition-transform duration-500">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-4">
                  Archetyp B
                </div>
                <h3 className="text-2xl font-black mb-3">Der Aufsteiger</h3>
                <p className="text-sm text-white/60 leading-relaxed mb-5">
                  Familie, 35–50. Verkauft aktuelles Heim, um größer zu kaufen.
                  Familienzuwachs, zweites Kind, dauerhaftes Homeoffice.
                </p>
                <div className="pt-4 border-t border-white/10 text-xs text-white/70">
                  Geschwindigkeit · Timing-Kontrolle · Provision für Eigenkapital behalten
                </div>
              </div>
              {/* C */}
              <div className="bg-slate-50 border border-slate-200 text-blueprint rounded-3xl p-7 hover:scale-[1.02] transition-transform duration-500">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-4">
                  Archetyp C
                </div>
                <h3 className="text-2xl font-black mb-3">Der Verkleinerer</h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-5">
                  Empty-Nester oder Rentner, 55–75. Kinder ausgezogen,
                  Mobilität, Kapitalfreisetzung. Risikoavers.
                </p>
                <div className="pt-4 border-t border-slate-200 text-xs text-slate-500">
                  Vertrauen durch Transparenz · versteht jeden Schritt
                </div>
              </div>
              {/* D */}
              <div className="bg-slate-50 border border-slate-200 text-blueprint rounded-3xl p-7 hover:scale-[1.02] transition-transform duration-500">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-4">
                  Archetyp D
                </div>
                <h3 className="text-2xl font-black mb-3">Der Investor</h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-5">
                  Besitzer von einer oder mehreren Mietimmobilien, 40–65.
                  Portfolio-Umschichtung, Steueroptimierung, Exit.
                </p>
                <div className="pt-4 border-t border-slate-200 text-xs text-slate-500">
                  Kostengetrieben · berechnet Ersparnis vs. eigene Zeit
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========== PRICING ========== */}
        <section
          id="pricing"
          className="py-28 px-6 bg-background-light light-grid"
        >
          <div className="max-w-6xl mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-16 reveal">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-primary mb-6">
                <span className="material-symbols-outlined text-sm">
                  payments
                </span>
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                  Preise
                </span>
              </div>
              <h2 className="text-5xl lg:text-7xl font-black tracking-[-0.04em] leading-[0.9] text-blueprint">
                Ein transparenter Preis.
                <br />
                <span className="text-primary">Keine Überraschungen.</span>
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-5 reveal-stagger reveal">
              {/* Flat */}
              <div className="bg-white border border-slate-200 rounded-3xl p-10 hover:border-primary transition-all duration-500">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-4">
                  Direkta Flat
                </div>
                <div className="flex items-baseline gap-2 mb-6">
                  <span className="text-7xl font-black bignum text-blueprint counter-num">
                    €999
                  </span>
                  <span className="text-sm text-slate-400 font-medium">
                    einmalig
                  </span>
                </div>
                <p className="text-slate-600 mb-8 leading-relaxed">
                  Einmal zahlen, wenn Ihr Inserat live geht. Ideal für Verkäufer,
                  die planbare Kosten wollen.
                </p>
                <ul className="space-y-3 mb-10">
                  <li className="flex items-start gap-3 text-sm text-blueprint">
                    <span className="material-symbols-outlined text-primary text-base mt-0.5">
                      check_circle
                    </span>
                    Alle sechs Module inklusive
                  </li>
                  <li className="flex items-start gap-3 text-sm text-blueprint">
                    <span className="material-symbols-outlined text-primary text-base mt-0.5">
                      check_circle
                    </span>
                    Unbegrenzte Fotos, Bearbeitungen und Neuveröffentlichungen
                  </li>
                  <li className="flex items-start gap-3 text-sm text-blueprint">
                    <span className="material-symbols-outlined text-primary text-base mt-0.5">
                      check_circle
                    </span>
                    ImmoScout24-Veröffentlichung
                  </li>
                  <li className="flex items-start gap-3 text-sm text-blueprint">
                    <span className="material-symbols-outlined text-primary text-base mt-0.5">
                      check_circle
                    </span>
                    Notar-Übergabepaket
                  </li>
                  <li className="flex items-start gap-3 text-sm text-blueprint">
                    <span className="material-symbols-outlined text-primary text-base mt-0.5">
                      check_circle
                    </span>
                    Optionale persönliche Unterstützung
                  </li>
                </ul>
                <button
                  onClick={() => setModalView("signup")}
                  className="block w-full text-center bg-blueprint hover:bg-primary text-white py-4 rounded-2xl font-black text-sm uppercase tracking-[0.18em] transition-colors"
                >
                  Flat wählen
                </button>
              </div>

              {/* Success */}
              <div className="bg-blueprint text-white rounded-3xl p-10 relative overflow-hidden ring-2 ring-primary">
                <div className="absolute top-6 right-6 bg-primary text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                  Beliebt
                </div>
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-4">
                  Direkta Success
                </div>
                <div className="flex items-baseline gap-2 mb-6">
                  <span className="text-7xl font-black bignum counter-num">
                    1%
                  </span>
                  <span className="text-sm text-white/50 font-medium">
                    vom Verkaufspreis · max. €4.900
                  </span>
                </div>
                <p className="text-white/70 mb-8 leading-relaxed">
                  Zahlen Sie nur bei erfolgreichem Verkauf. Wir gewinnen, wenn
                  Sie gewinnen — immer noch ~70% günstiger als ein Makler.
                </p>
                <ul className="space-y-3 mb-10">
                  <li className="flex items-start gap-3 text-sm">
                    <span className="material-symbols-outlined text-primary text-base mt-0.5">
                      check_circle
                    </span>
                    Alles aus Flat inklusive
                  </li>
                  <li className="flex items-start gap-3 text-sm">
                    <span className="material-symbols-outlined text-primary text-base mt-0.5">
                      check_circle
                    </span>
                    Keine Vorabkosten
                  </li>
                  <li className="flex items-start gap-3 text-sm">
                    <span className="material-symbols-outlined text-primary text-base mt-0.5">
                      check_circle
                    </span>
                    Gedeckelt bei €4.900 — auch bei Millionen-Verkäufen
                  </li>
                  <li className="flex items-start gap-3 text-sm">
                    <span className="material-symbols-outlined text-primary text-base mt-0.5">
                      check_circle
                    </span>
                    Keine Gebühr, wenn Ihr Inserat nicht verkauft wird
                  </li>
                  <li className="flex items-start gap-3 text-sm">
                    <span className="material-symbols-outlined text-primary text-base mt-0.5">
                      check_circle
                    </span>
                    Prioritäts-Support während der Verhandlung
                  </li>
                </ul>
                <button
                  onClick={() => setModalView("signup")}
                  className="block w-full text-center bg-primary hover:bg-white hover:text-blueprint text-white py-4 rounded-2xl font-black text-sm uppercase tracking-[0.18em] transition-colors"
                >
                  Success wählen
                </button>
              </div>
            </div>

            <p className="text-center mt-10 text-sm text-slate-500 reveal">
              Bei einem Verkauf von €500.000 berechnet ein Makler typischerweise{" "}
              <span className="font-black text-blueprint">€17.850</span>. Mit
              Direkta behalten Sie{" "}
              <span className="font-black text-primary">€16.851</span> in Ihrer
              Tasche.
            </p>
          </div>
        </section>

        {/* ========== CTA ========== */}
        <section id="cta" className="py-28 px-6 bg-white">
          <div className="max-w-7xl mx-auto reveal">
            <div className="bg-blueprint rounded-[3rem] p-12 lg:p-20 relative overflow-hidden">
              <div className="absolute inset-0 blueprint-grid opacity-30"></div>
              <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-primary/30 rounded-full blur-[140px]"></div>
              <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] bg-primary/20 rounded-full blur-[120px]"></div>

              <div className="relative z-10 text-center max-w-3xl mx-auto">
                <h2 className="text-5xl lg:text-7xl font-black tracking-[-0.04em] leading-[0.9] text-white mb-8">
                  Erfahren Sie, was Ihre
                  <br />
                  Immobilie wert ist —{" "}
                  <span className="text-primary">kostenlos.</span>
                </h2>
                <p className="text-white/70 text-lg mb-10 leading-relaxed">
                  Geben Sie Ihre Adresse und fünf Angaben ein. Erhalten Sie
                  sofort eine indikative Preisspanne, drei Preisstrategien und
                  den nächsten Schritt. Kein Konto nötig.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <button
                    onClick={() => setModalView("signup")}
                    className="group bg-primary hover:bg-white hover:text-blueprint text-white px-8 py-5 rounded-full font-black uppercase tracking-[0.18em] text-sm transition-all duration-300 hover:scale-[1.03] flex items-center justify-center gap-2 shadow-2xl shadow-primary/30"
                  >
                    Jetzt Preis erfahren
                    <span className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1">
                      arrow_forward
                    </span>
                  </button>
                  <a
                    href="#how"
                    className="bg-white/10 border border-white/20 hover:bg-white/20 text-white px-8 py-5 rounded-full font-black uppercase tracking-[0.18em] text-sm transition-all duration-300"
                  >
                    So funktioniert&apos;s
                  </a>
                </div>
                <p className="mt-8 text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
                  Keine Kreditkarte · Anmeldung in 60 Sekunden · Jederzeit kündbar
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========== FOOTER ========== */}
        <footer className="bg-blueprint text-white pt-20 pb-10 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
              <div className="col-span-2">
                <div className="flex items-center gap-2 mb-6">
                  <span className="material-symbols-outlined text-3xl text-primary">
                    home_work
                  </span>
                  <span className="text-2xl font-black tracking-tight display-font">
                    DIREKTA<span className="text-primary">.</span>
                  </span>
                </div>
                <p className="text-white/60 text-sm max-w-sm leading-relaxed mb-6">
                  Ein softwaregestützter Verkaufsprozess für deutsche
                  Immobilienbesitzer. Inserat, Preisfindung, qualifizierte
                  Interessenten, Angebote und Notar-Übergabe — alles ohne Makler.
                </p>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                  Immobilie verkaufen. Direkt.
                </div>
              </div>
              <div>
                <p className="font-black text-[10px] uppercase tracking-[0.2em] text-primary mb-6">
                  Produkt
                </p>
                <ul className="space-y-4 text-sm text-white/60">
                  <li>
                    <a
                      className="hover:text-primary transition-colors"
                      href="#how"
                    >
                      So funktioniert&apos;s
                    </a>
                  </li>
                  <li>
                    <a
                      className="hover:text-primary transition-colors"
                      href="#modules"
                    >
                      Module
                    </a>
                  </li>
                  <li>
                    <a
                      className="hover:text-primary transition-colors"
                      href="#compare"
                    >
                      Vergleich
                    </a>
                  </li>
                  <li>
                    <a
                      className="hover:text-primary transition-colors"
                      href="#pricing"
                    >
                      Preise
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-black text-[10px] uppercase tracking-[0.2em] text-primary mb-6">
                  Unternehmen
                </p>
                <ul className="space-y-4 text-sm text-white/60">
                  <li>
                    <a
                      className="hover:text-primary transition-colors"
                      href="#"
                    >
                      Über uns
                    </a>
                  </li>
                  <li>
                    <a
                      className="hover:text-primary transition-colors"
                      href="#"
                    >
                      Manifest
                    </a>
                  </li>
                  <li>
                    <a
                      className="hover:text-primary transition-colors"
                      href="#"
                    >
                      Karriere
                    </a>
                  </li>
                  <li>
                    <a
                      className="hover:text-primary transition-colors"
                      href="#"
                    >
                      Kontakt
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-black text-[10px] uppercase tracking-[0.2em] text-primary mb-6">
                  Rechtliches
                </p>
                <ul className="space-y-4 text-sm text-white/60">
                  <li>
                    <a
                      className="hover:text-primary transition-colors"
                      href="#"
                    >
                      Impressum
                    </a>
                  </li>
                  <li>
                    <a
                      className="hover:text-primary transition-colors"
                      href="#"
                    >
                      Datenschutz
                    </a>
                  </li>
                  <li>
                    <a
                      className="hover:text-primary transition-colors"
                      href="#"
                    >
                      AGB
                    </a>
                  </li>
                  <li>
                    <a
                      className="hover:text-primary transition-colors"
                      href="#"
                    >
                      Widerrufsrecht
                    </a>
                  </li>
                </ul>
              </div>
            </div>
            <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                © 2026 Direkta GmbH · Deutschland
              </p>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                DSGVO · GwG · GEG · Made in Berlin
              </p>
            </div>
          </div>
        </footer>
      </main>

      <AuthModal
        isOpen={modalView !== null}
        initialView={modalView ?? "signin"}
        onClose={() => setModalView(null)}
      />
    </>
  );
}
