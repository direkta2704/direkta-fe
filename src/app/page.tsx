"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import AuthModal from "./components/auth-modal";

export default function Home() {
  const { data: session } = useSession();
  const [modalView, setModalView] = useState<"signin" | "signup" | null>(null);

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
          className="nav-shell w-full max-w-[1400px] mt-0 rounded-none bg-white/70 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-6 py-3.5"
        >
          <a href="#" className="flex items-center gap-2 group">
            <span className="material-symbols-outlined text-3xl text-primary transition-transform duration-500 group-hover:rotate-12">
              home_work
            </span>
            <span className="text-xl font-black tracking-tight display-font">
              DIREKTA<span className="text-primary">.</span>
            </span>
          </a>
          <nav className="hidden md:flex items-center gap-8">
            <a
              href="#how"
              className="underline-link text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 hover:text-primary transition-colors"
            >
              How it works
            </a>
            <a
              href="#modules"
              className="underline-link text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 hover:text-primary transition-colors"
            >
              Modules
            </a>
            <a
              href="#compare"
              className="underline-link text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 hover:text-primary transition-colors"
            >
              Compare
            </a>
            <a
              href="#pricing"
              className="underline-link text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 hover:text-primary transition-colors"
            >
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-2">
            {session?.user ? (
              <>
                <span className="hidden sm:inline-block text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 px-3 py-2">
                  {session.user.name || session.user.email}
                </span>
                <button
                  onClick={() => signOut()}
                  className="bg-blueprint hover:bg-primary text-white px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-[0.18em] transition-all duration-300 hover:scale-[1.03] flex items-center gap-1.5"
                >
                  Sign out
                  <span className="material-symbols-outlined text-base">
                    logout
                  </span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setModalView("signin")}
                  className="hidden sm:inline-block text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 hover:text-primary transition-colors px-3 py-2"
                >
                  Sign in
                </button>
                <button
                  onClick={() => setModalView("signup")}
                  className="bg-blueprint hover:bg-primary text-white px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-[0.18em] transition-all duration-300 hover:scale-[1.03] flex items-center gap-1.5"
                >
                  Start free
                  <span className="material-symbols-outlined text-base">
                    arrow_forward
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
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
                  Built for Germany · GDPR · GwG · GEG
                </span>
              </div>
            </div>

            {/* Headline */}
            <h1 className="text-center font-black tracking-[-0.04em] leading-[0.88] text-blueprint">
              <span className="block text-[14vw] sm:text-[10vw] lg:text-[8.5rem] anim-rise">
                Sell your property.
              </span>
              <span className="block text-[14vw] sm:text-[10vw] lg:text-[8.5rem] anim-rise delay-200">
                <span className="text-stroke">Skip the</span>{" "}
                <span className="text-primary">Makler.</span>
              </span>
            </h1>

            {/* Subhead */}
            <p className="mt-10 max-w-2xl mx-auto text-center text-lg lg:text-xl text-slate-600 font-medium leading-relaxed anim-rise delay-400">
              Direkta is a complete software-driven sales process for German
              homeowners. Listing, pricing, qualified leads, offers, and notary
              — all in one place.{" "}
              <span className="font-bold text-blueprint">
                No 3.57% commission.
              </span>
            </p>

            {/* CTAs */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 anim-rise delay-500">
              <button
                onClick={() => setModalView("signup")}
                className="group bg-primary hover:bg-primary-dark text-white px-8 py-4 rounded-full text-sm font-black uppercase tracking-[0.18em] transition-all duration-300 hover:scale-[1.03] shadow-xl shadow-primary/30 flex items-center gap-2"
              >
                Get my price estimate
                <span className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1">
                  arrow_forward
                </span>
              </button>
              <a
                href="#how"
                className="group flex items-center gap-2 text-blueprint font-black text-sm uppercase tracking-[0.18em] underline-link"
              >
                See how it works
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
                      Live Calculation
                    </div>
                  </div>

                  <div className="grid lg:grid-cols-3 gap-8 items-center">
                    {/* Without Direkta */}
                    <div className="border border-white/10 bg-white/[0.03] rounded-2xl p-6">
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50 mb-3">
                        Without Direkta
                      </div>
                      <div className="text-4xl font-black text-white/90 counter-num">
                        €17,850
                      </div>
                      <div className="text-xs text-white/50 mt-2">
                        Maklerprovision · 3.57%
                      </div>
                      <div className="mt-6 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                        ~ 20 weeks
                      </div>
                    </div>

                    {/* Arrow / equation */}
                    <div className="flex flex-col items-center justify-center text-center py-6 lg:py-0">
                      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-3">
                        You save
                      </div>
                      <div
                        className="text-5xl lg:text-6xl font-black bignum text-primary counter-num"
                        id="bigSavings"
                      >
                        €16,851
                      </div>
                      <div className="mt-3 text-xs text-white/60">
                        on a €500,000 sale
                      </div>
                      <div className="mt-4 inline-flex items-center gap-2 text-white/80">
                        <span className="material-symbols-outlined text-base">
                          trending_down
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                          ~12 weeks faster
                        </span>
                      </div>
                    </div>

                    {/* With Direkta */}
                    <div className="border border-primary/40 bg-primary/10 rounded-2xl p-6 relative">
                      <div className="absolute -top-2 -right-2 bg-primary text-white text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-widest">
                        Direkta
                      </div>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-3">
                        With Direkta
                      </div>
                      <div className="text-4xl font-black text-white counter-num">
                        €999
                      </div>
                      <div className="text-xs text-white/70 mt-2">
                        Flat fee · or 1% capped at €4,900
                      </div>
                      <div className="mt-6 text-[10px] font-black uppercase tracking-[0.2em] text-white/70">
                        ~ 8 weeks
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
              Trusted process · End-to-end coverage
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
                    GDPR Compliant
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl">
                    gavel
                  </span>
                  <span className="text-sm font-black uppercase tracking-widest">
                    GwG Aligned
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl">
                    eco
                  </span>
                  <span className="text-sm font-black uppercase tracking-widest">
                    GEG Mandatory Fields
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
                    Notary Ready Package
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl">
                    credit_score
                  </span>
                  <span className="text-sm font-black uppercase tracking-widest">
                    Financing Verification
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
                    GDPR Compliant
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl">
                    gavel
                  </span>
                  <span className="text-sm font-black uppercase tracking-widest">
                    GwG Aligned
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl">
                    eco
                  </span>
                  <span className="text-sm font-black uppercase tracking-widest">
                    GEG Mandatory Fields
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
                    Notary Ready Package
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl">
                    credit_score
                  </span>
                  <span className="text-sm font-black uppercase tracking-widest">
                    Financing Verification
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
                  Sample Property Value
                </p>
              </div>
              <div className="border-l-4 border-slate-200 pl-6">
                <p className="bignum text-5xl lg:text-6xl text-blueprint counter-num">
                  8 wks
                </p>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mt-2">
                  Average Time-to-Close
                </p>
              </div>
              <div className="border-l-4 border-slate-200 pl-6">
                <p className="bignum text-5xl lg:text-6xl text-blueprint counter-num">
                  15 min
                </p>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mt-2">
                  To a Compliant Listing
                </p>
              </div>
              <div className="border-l-4 border-slate-200 pl-6">
                <p className="bignum text-5xl lg:text-6xl text-blueprint counter-num">
                  0%
                </p>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mt-2">
                  Agent Commission
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
                    The Direkta Process
                  </span>
                </div>
                <h2 className="text-5xl lg:text-7xl font-black tracking-[-0.04em] leading-[0.9] text-blueprint">
                  A guided sales process,
                  <br />
                  <span className="text-primary">not an AI tool.</span>
                </h2>
                <p className="mt-8 text-lg text-slate-600 leading-relaxed">
                  Owners don&apos;t fail at selling because they lack a chatbot.
                  They fail because they don&apos;t know how to price, qualify
                  buyers, or move a deal toward the notary. Direkta is the
                  entire pipeline — software replacing the agent, not assisting
                  one.
                </p>
                <a
                  href="#modules"
                  className="mt-8 inline-flex items-center gap-2 text-blueprint font-black text-sm uppercase tracking-[0.18em] underline-link"
                >
                  Explore the modules
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
                          Onboard · Day 1
                        </div>
                        <h3 className="text-2xl font-black text-blueprint mb-2">
                          Talk to the Expos&eacute; Agent
                        </h3>
                        <p className="text-slate-600 leading-relaxed">
                          A 15–20 minute conversation in German. The agent asks
                          one question at a time, accepts your photos and
                          Energieausweis inline, and produces a complete,
                          GEG-compliant listing.
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
                          Price · Day 1
                        </div>
                        <h3 className="text-2xl font-black text-blueprint mb-2">
                          Get three pricing strategies
                        </h3>
                        <p className="text-slate-600 leading-relaxed">
                          Quick Sale, Realistic, or Maximum — each backed by
                          anonymised comparable transactions and a confidence
                          score. No black-box ML, no agent intuition.
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
                          Distribute · Day 2
                        </div>
                        <h3 className="text-2xl font-black text-blueprint mb-2">
                          Auto-syndicate to ImmoScout24
                        </h3>
                        <p className="text-slate-600 leading-relaxed">
                          The Listing Agent pushes your listing to IS24 within
                          30 minutes and pulls views, contacts, and bookmarks
                          back into one inbox. No copy-pasting between systems.
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
                          Operate · Weeks 1–6
                        </div>
                        <h3 className="text-2xl font-black text-blueprint mb-2">
                          Qualified leads, ranked offers
                        </h3>
                        <p className="text-slate-600 leading-relaxed">
                          Every enquiry is scored on budget, financing status,
                          and timing. Offers land in a structured dashboard with
                          risk flags and side-by-side comparison of the top
                          three.
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
                          Close · Week 8
                        </div>
                        <h3 className="text-2xl font-black text-blueprint mb-2">
                          One click to the notary
                        </h3>
                        <p className="text-slate-600 leading-relaxed">
                          Accept an offer and Direkta generates the
                          Reservierungsvereinbarung and a complete document
                          package for the notary. You walk in prepared.
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
                  Six Core Modules
                </span>
              </div>
              <h2 className="text-5xl lg:text-7xl font-black tracking-[-0.04em] leading-[0.9] text-white">
                Everything an agent does.
                <br />
                <span className="text-primary">In software.</span>
              </h2>
              <p className="mt-8 text-lg text-white/70 leading-relaxed">
                Four product modules and two agentic modules that operate across
                them. Every feature serves one hypothesis: a property owner can
                sell faster or cheaper than with a Makler — without needing to
                understand the real estate process.
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
                  Smart Listing Creation
                </h3>
                <p className="text-sm text-white/60 leading-relaxed mb-5">
                  Generate a compliant, professional-grade Expos&eacute; from
                  photos and structured input — in under 15 minutes.
                </p>
                <div className="pt-4 border-t border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                  250–600 word description · GEG checked
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
                  Pricing Engine
                </h3>
                <p className="text-sm text-white/60 leading-relaxed mb-5">
                  A defensible price band and three explicit strategies, derived
                  from anonymised comparable transactions.
                </p>
                <div className="pt-4 border-t border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                  Quick · Realistic · Maximum
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
                  Lead Funnel & Qualification
                </h3>
                <p className="text-sm text-white/60 leading-relaxed mb-5">
                  Every enquiry scored 0–100 on budget, financing and timing. No
                  tyre-kickers reach your inbox.
                </p>
                <div className="pt-4 border-t border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                  Auto-qualified · Calendar-synced
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
                  Offer Dashboard
                </h3>
                <p className="text-sm text-white/60 leading-relaxed mb-5">
                  Receive, score, and rank offers. Side-by-side compare the top
                  three and one-click hand off to the notary.
                </p>
                <div className="pt-4 border-t border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                  KYC verified · Risk flagged
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
                  Expos&eacute; Agent
                </h3>
                <p className="text-sm text-white/70 leading-relaxed mb-5">
                  A goal-driven conversational agent that creates the entire
                  Expos&eacute; in dialog. Asks one question at a time.
                  Self-reviews against a quality rubric.
                </p>
                <div className="pt-4 border-t border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                  Conversational · Multi-turn · Self-reviewing
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
                  Listing Agent
                </h3>
                <p className="text-sm text-white/70 leading-relaxed mb-5">
                  Bidirectional syndication to ImmobilienScout24. Pushes
                  listings, pulls back views, contacts, and bookmarks — into one
                  source of truth.
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
                  The Honest Comparison
                </span>
              </div>
              <h2 className="text-5xl lg:text-7xl font-black tracking-[-0.04em] leading-[0.9] text-blueprint">
                Same property.
                <br />
                <span className="text-primary">Two paths.</span>
              </h2>
            </div>

            {/* Header row */}
            <div className="reveal">
              <div className="hidden md:grid grid-cols-12 gap-4 mb-4 px-4">
                <div className="col-span-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Phase
                </div>
                <div className="col-span-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Without Direkta
                </div>
                <div className="col-span-4 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                  With Direkta
                </div>
                <div className="col-span-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">
                  Saved
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
                    Research agents · meet 3–5 · sign Maklervertrag
                  </div>
                  <div className="md:col-span-4 text-sm text-blueprint font-medium">
                    Sign up + Expos&eacute; Agent dialog (15–20 min)
                  </div>
                  <div className="md:col-span-1 text-right">
                    <span className="inline-block bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-black">
                      ~3 wks
                    </span>
                  </div>
                </div>
                {/* Row 2 */}
                <div className="journey-row grid md:grid-cols-12 gap-4 p-6 items-center">
                  <div className="md:col-span-3">
                    <div className="font-black text-blueprint text-lg">
                      Listing Prep
                    </div>
                  </div>
                  <div className="md:col-span-4 text-sm text-slate-600">
                    Agent&apos;s photo schedule · generic Expos&eacute; template
                  </div>
                  <div className="md:col-span-4 text-sm text-blueprint font-medium">
                    AI-drafted Expos&eacute; · seller edits · compliance check
                  </div>
                  <div className="md:col-span-1 text-right">
                    <span className="inline-block bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-black">
                      ~2 wks
                    </span>
                  </div>
                </div>
                {/* Row 3 */}
                <div className="journey-row grid md:grid-cols-12 gap-4 p-6 items-center">
                  <div className="md:col-span-3">
                    <div className="font-black text-blueprint text-lg">
                      Pricing
                    </div>
                  </div>
                  <div className="md:col-span-4 text-sm text-slate-600">
                    Set by agent · opaque · biased toward fast close
                  </div>
                  <div className="md:col-span-4 text-sm text-blueprint font-medium">
                    Three explicit strategies with comparables
                  </div>
                  <div className="md:col-span-1 text-right">
                    <span className="inline-block bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-black">
                      Clarity
                    </span>
                  </div>
                </div>
                {/* Row 4 */}
                <div className="journey-row grid md:grid-cols-12 gap-4 p-6 items-center">
                  <div className="md:col-span-3">
                    <div className="font-black text-blueprint text-lg">
                      Distribution
                    </div>
                  </div>
                  <div className="md:col-span-4 text-sm text-slate-600">
                    Agent posts on portals on their schedule
                  </div>
                  <div className="md:col-span-4 text-sm text-blueprint font-medium">
                    Auto-syndication to IS24 within 30 minutes
                  </div>
                  <div className="md:col-span-1 text-right">
                    <span className="inline-block bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-black">
                      ~1–2 wks
                    </span>
                  </div>
                </div>
                {/* Row 5 */}
                <div className="journey-row grid md:grid-cols-12 gap-4 p-6 items-center">
                  <div className="md:col-span-3">
                    <div className="font-black text-blueprint text-lg">
                      Lead Handling
                    </div>
                  </div>
                  <div className="md:col-span-4 text-sm text-slate-600">
                    Filtered through agent · seller has no direct view
                  </div>
                  <div className="md:col-span-4 text-sm text-blueprint font-medium">
                    Auto-qualified · ranked by score · visible in inbox
                  </div>
                  <div className="md:col-span-1 text-right">
                    <span className="inline-block bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-black">
                      Transparency
                    </span>
                  </div>
                </div>
                {/* Row 6 */}
                <div className="journey-row grid md:grid-cols-12 gap-4 p-6 items-center">
                  <div className="md:col-span-3">
                    <div className="font-black text-blueprint text-lg">
                      Negotiation
                    </div>
                  </div>
                  <div className="md:col-span-4 text-sm text-slate-600">
                    4–6 weeks of indirect back-and-forth via agent
                  </div>
                  <div className="md:col-span-4 text-sm text-blueprint font-medium">
                    Structured offers · scored · compared side-by-side
                  </div>
                  <div className="md:col-span-1 text-right">
                    <span className="inline-block bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-black">
                      ~3–4 wks
                    </span>
                  </div>
                </div>
                {/* Row 7 */}
                <div className="journey-row grid md:grid-cols-12 gap-4 p-6 items-center">
                  <div className="md:col-span-3">
                    <div className="font-black text-blueprint text-lg">
                      Closing
                    </div>
                  </div>
                  <div className="md:col-span-4 text-sm text-slate-600">
                    2 weeks: agent prepares notary appointment
                  </div>
                  <div className="md:col-span-4 text-sm text-blueprint font-medium">
                    1-click accept · auto-generated notary package
                  </div>
                  <div className="md:col-span-1 text-right">
                    <span className="inline-block bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-black">
                      ~1 wk
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Total bar */}
            <div className="mt-6 grid md:grid-cols-3 gap-4 reveal">
              <div className="bg-blueprint text-white rounded-3xl p-7">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50 mb-2">
                  Without Direkta
                </div>
                <div className="text-3xl font-black counter-num">
                  ~ 20 weeks
                </div>
                <div className="text-sm text-white/60 mt-1">
                  €17,850 commission
                </div>
              </div>
              <div className="bg-primary text-white rounded-3xl p-7">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70 mb-2">
                  With Direkta
                </div>
                <div className="text-3xl font-black counter-num">
                  ~ 8 weeks
                </div>
                <div className="text-sm text-white/80 mt-1">€999 flat fee</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-3xl p-7">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                  Net Saving
                </div>
                <div className="text-3xl font-black text-blueprint counter-num">
                  €16,851
                </div>
                <div className="text-sm text-slate-500 mt-1">
                  ~12 weeks faster
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
                    Who It&apos;s For
                  </span>
                </div>
                <h2 className="text-5xl lg:text-6xl font-black tracking-[-0.04em] leading-[0.9] text-blueprint">
                  Built for four kinds
                  <br />
                  of German seller.
                </h2>
              </div>
              <div className="lg:col-span-5">
                <p className="text-slate-600 leading-relaxed">
                  Onboarding is optimised for the first two archetypes — but the
                  platform serves all of them. Property scope covers ETW, EFH,
                  MFH, DHH, RH and Grundst&uuml;ck.
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 reveal-stagger reveal">
              {/* A */}
              <div className="bg-blueprint text-white rounded-3xl p-7 hover:scale-[1.02] transition-transform duration-500">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-4">
                  Archetype A
                </div>
                <h3 className="text-2xl font-black mb-3">
                  The Estate Seller
                </h3>
                <p className="text-sm text-white/60 leading-relaxed mb-5">
                  Heir, 45–65, often selling inherited property in another city.
                  Inheritance, tax deadlines, Erbengemeinschaft pressure.
                </p>
                <div className="pt-4 border-t border-white/10 text-xs text-white/70">
                  Geographic independence · low effort · transparent process
                </div>
              </div>
              {/* B */}
              <div className="bg-blueprint text-white rounded-3xl p-7 hover:scale-[1.02] transition-transform duration-500">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-4">
                  Archetype B
                </div>
                <h3 className="text-2xl font-black mb-3">The Upgrader</h3>
                <p className="text-sm text-white/60 leading-relaxed mb-5">
                  Family, 35–50. Selling current home to buy bigger one. Family
                  growth, second child, remote-work permanence.
                </p>
                <div className="pt-4 border-t border-white/10 text-xs text-white/70">
                  Speed · timing control · keep commission for down payment
                </div>
              </div>
              {/* C */}
              <div className="bg-slate-50 border border-slate-200 text-blueprint rounded-3xl p-7 hover:scale-[1.02] transition-transform duration-500">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-4">
                  Archetype C
                </div>
                <h3 className="text-2xl font-black mb-3">The Downsizer</h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-5">
                  Empty-nester or retiree, 55–75. Children moved out, mobility,
                  capital release. Sensitive to risk.
                </p>
                <div className="pt-4 border-t border-slate-200 text-xs text-slate-500">
                  Trust through transparency · understands every step
                </div>
              </div>
              {/* D */}
              <div className="bg-slate-50 border border-slate-200 text-blueprint rounded-3xl p-7 hover:scale-[1.02] transition-transform duration-500">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-4">
                  Archetype D
                </div>
                <h3 className="text-2xl font-black mb-3">The Investor</h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-5">
                  Owner of one or more rental properties, 40–65. Portfolio
                  rebalancing, tax optimisation, exit.
                </p>
                <div className="pt-4 border-t border-slate-200 text-xs text-slate-500">
                  Cost-driven · calculates savings vs. own time
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
                  Pricing
                </span>
              </div>
              <h2 className="text-5xl lg:text-7xl font-black tracking-[-0.04em] leading-[0.9] text-blueprint">
                One transparent fee.
                <br />
                <span className="text-primary">No surprises.</span>
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
                    one-time
                  </span>
                </div>
                <p className="text-slate-600 mb-8 leading-relaxed">
                  Pay once when your listing goes live. Best for sellers who
                  want predictable cost.
                </p>
                <ul className="space-y-3 mb-10">
                  <li className="flex items-start gap-3 text-sm text-blueprint">
                    <span className="material-symbols-outlined text-primary text-base mt-0.5">
                      check_circle
                    </span>
                    All six modules included
                  </li>
                  <li className="flex items-start gap-3 text-sm text-blueprint">
                    <span className="material-symbols-outlined text-primary text-base mt-0.5">
                      check_circle
                    </span>
                    Unlimited photos, edits and re-publishes
                  </li>
                  <li className="flex items-start gap-3 text-sm text-blueprint">
                    <span className="material-symbols-outlined text-primary text-base mt-0.5">
                      check_circle
                    </span>
                    ImmoScout24 syndication
                  </li>
                  <li className="flex items-start gap-3 text-sm text-blueprint">
                    <span className="material-symbols-outlined text-primary text-base mt-0.5">
                      check_circle
                    </span>
                    Notary handoff package
                  </li>
                  <li className="flex items-start gap-3 text-sm text-blueprint">
                    <span className="material-symbols-outlined text-primary text-base mt-0.5">
                      check_circle
                    </span>
                    Optional human-support escalation
                  </li>
                </ul>
                <button
                  onClick={() => setModalView("signup")}
                  className="block w-full text-center bg-blueprint hover:bg-primary text-white py-4 rounded-2xl font-black text-sm uppercase tracking-[0.18em] transition-colors"
                >
                  Choose flat
                </button>
              </div>

              {/* Success */}
              <div className="bg-blueprint text-white rounded-3xl p-10 relative overflow-hidden ring-2 ring-primary">
                <div className="absolute top-6 right-6 bg-primary text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                  Popular
                </div>
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-4">
                  Direkta Success
                </div>
                <div className="flex items-baseline gap-2 mb-6">
                  <span className="text-7xl font-black bignum counter-num">
                    1%
                  </span>
                  <span className="text-sm text-white/50 font-medium">
                    of sale · capped €4,900
                  </span>
                </div>
                <p className="text-white/70 mb-8 leading-relaxed">
                  Pay only when you close. We win when you win — still ~70% less
                  than a Makler.
                </p>
                <ul className="space-y-3 mb-10">
                  <li className="flex items-start gap-3 text-sm">
                    <span className="material-symbols-outlined text-primary text-base mt-0.5">
                      check_circle
                    </span>
                    Everything in Flat
                  </li>
                  <li className="flex items-start gap-3 text-sm">
                    <span className="material-symbols-outlined text-primary text-base mt-0.5">
                      check_circle
                    </span>
                    Zero upfront cost
                  </li>
                  <li className="flex items-start gap-3 text-sm">
                    <span className="material-symbols-outlined text-primary text-base mt-0.5">
                      check_circle
                    </span>
                    Hard cap at €4,900 even on million-euro sales
                  </li>
                  <li className="flex items-start gap-3 text-sm">
                    <span className="material-symbols-outlined text-primary text-base mt-0.5">
                      check_circle
                    </span>
                    No fee if your listing doesn&apos;t close
                  </li>
                  <li className="flex items-start gap-3 text-sm">
                    <span className="material-symbols-outlined text-primary text-base mt-0.5">
                      check_circle
                    </span>
                    Priority support during negotiation
                  </li>
                </ul>
                <button
                  onClick={() => setModalView("signup")}
                  className="block w-full text-center bg-primary hover:bg-white hover:text-blueprint text-white py-4 rounded-2xl font-black text-sm uppercase tracking-[0.18em] transition-colors"
                >
                  Choose success
                </button>
              </div>
            </div>

            <p className="text-center mt-10 text-sm text-slate-500 reveal">
              On a €500,000 sale, a Makler typically charges{" "}
              <span className="font-black text-blueprint">€17,850</span>. With
              Direkta, you keep{" "}
              <span className="font-black text-primary">€16,851</span> in your
              pocket.
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
                  Find out what your
                  <br />
                  property is worth —{" "}
                  <span className="text-primary">free.</span>
                </h2>
                <p className="text-white/70 text-lg mb-10 leading-relaxed">
                  Enter your address and five fields. Get an instant indicative
                  price band, three pricing strategies, and a clear next step.
                  No account needed to start.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <button
                    onClick={() => setModalView("signup")}
                    className="group bg-primary hover:bg-white hover:text-blueprint text-white px-8 py-5 rounded-full font-black uppercase tracking-[0.18em] text-sm transition-all duration-300 hover:scale-[1.03] flex items-center justify-center gap-2 shadow-2xl shadow-primary/30"
                  >
                    Get my price estimate
                    <span className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1">
                      arrow_forward
                    </span>
                  </button>
                  <a
                    href="#how"
                    className="bg-white/10 border border-white/20 hover:bg-white/20 text-white px-8 py-5 rounded-full font-black uppercase tracking-[0.18em] text-sm transition-all duration-300"
                  >
                    See how it works
                  </a>
                </div>
                <p className="mt-8 text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
                  No credit card · 60-second sign-up · Cancel anytime
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
                  A software-driven sales process for German homeowners.
                  Listing, pricing, qualified leads, offers, and notary handoff
                  — all without a Makler.
                </p>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                  Sell your property. Direct.
                </div>
              </div>
              <div>
                <p className="font-black text-[10px] uppercase tracking-[0.2em] text-primary mb-6">
                  Product
                </p>
                <ul className="space-y-4 text-sm text-white/60">
                  <li>
                    <a
                      className="hover:text-primary transition-colors"
                      href="#how"
                    >
                      How it works
                    </a>
                  </li>
                  <li>
                    <a
                      className="hover:text-primary transition-colors"
                      href="#modules"
                    >
                      Modules
                    </a>
                  </li>
                  <li>
                    <a
                      className="hover:text-primary transition-colors"
                      href="#compare"
                    >
                      Compare
                    </a>
                  </li>
                  <li>
                    <a
                      className="hover:text-primary transition-colors"
                      href="#pricing"
                    >
                      Pricing
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-black text-[10px] uppercase tracking-[0.2em] text-primary mb-6">
                  Company
                </p>
                <ul className="space-y-4 text-sm text-white/60">
                  <li>
                    <a
                      className="hover:text-primary transition-colors"
                      href="#"
                    >
                      About
                    </a>
                  </li>
                  <li>
                    <a
                      className="hover:text-primary transition-colors"
                      href="#"
                    >
                      Manifesto
                    </a>
                  </li>
                  <li>
                    <a
                      className="hover:text-primary transition-colors"
                      href="#"
                    >
                      Careers
                    </a>
                  </li>
                  <li>
                    <a
                      className="hover:text-primary transition-colors"
                      href="#"
                    >
                      Contact
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-black text-[10px] uppercase tracking-[0.2em] text-primary mb-6">
                  Legal
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
                © 2026 Direkta GmbH · Germany
              </p>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                GDPR · GwG · GEG · Made in Berlin
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
