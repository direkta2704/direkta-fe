"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type CookieConsent = {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
};

const CONSENT_KEY = "direkta_cookie_consent";

function getStoredConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function storeConsent(consent: CookieConsent) {
  localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const consent = getStoredConsent();
    if (!consent) {
      setVisible(true);
    }
  }, []);

  function acceptAll() {
    const consent: CookieConsent = {
      necessary: true,
      analytics: true,
      marketing: true,
      timestamp: new Date().toISOString(),
    };
    storeConsent(consent);
    setVisible(false);
  }

  function rejectAll() {
    const consent: CookieConsent = {
      necessary: true,
      analytics: false,
      marketing: false,
      timestamp: new Date().toISOString(),
    };
    storeConsent(consent);
    setVisible(false);
  }

  function saveSelection() {
    const consent: CookieConsent = {
      necessary: true,
      analytics,
      marketing,
      timestamp: new Date().toISOString(),
    };
    storeConsent(consent);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[300] p-4 sm:p-6">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-2xl shadow-blueprint/20 border border-slate-200 overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <span className="material-symbols-outlined text-primary text-2xl mt-0.5 flex-shrink-0">
              cookie
            </span>
            <div>
              <h3 className="font-black text-blueprint text-sm mb-1">
                Cookie-Einstellungen
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Wir verwenden Cookies, um Ihnen die bestmögliche Erfahrung auf unserer
                Website zu bieten. Einige sind technisch notwendig, andere helfen uns,
                die Website zu verbessern.{" "}
                <Link href="/datenschutz" className="text-primary hover:underline">
                  Mehr erfahren
                </Link>
              </p>
            </div>
          </div>

          {showDetails && (
            <div className="space-y-3 mb-5 pl-10">
              <label className="flex items-center justify-between py-2 border-b border-slate-100">
                <div>
                  <span className="text-sm font-bold text-blueprint">Technisch notwendig</span>
                  <p className="text-[10px] text-slate-400">Session, Authentifizierung, Sicherheit</p>
                </div>
                <input
                  type="checkbox"
                  checked
                  disabled
                  className="w-4 h-4 rounded border-slate-300 text-primary"
                />
              </label>
              <label className="flex items-center justify-between py-2 border-b border-slate-100 cursor-pointer">
                <div>
                  <span className="text-sm font-bold text-blueprint">Analyse</span>
                  <p className="text-[10px] text-slate-400">PostHog — anonymisierte Nutzungsstatistiken</p>
                </div>
                <input
                  type="checkbox"
                  checked={analytics}
                  onChange={(e) => setAnalytics(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20"
                />
              </label>
              <label className="flex items-center justify-between py-2 cursor-pointer">
                <div>
                  <span className="text-sm font-bold text-blueprint">Marketing</span>
                  <p className="text-[10px] text-slate-400">Conversion-Tracking für Werbeanzeigen</p>
                </div>
                <input
                  type="checkbox"
                  checked={marketing}
                  onChange={(e) => setMarketing(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20"
                />
              </label>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pl-10">
            {showDetails ? (
              <>
                <button
                  onClick={saveSelection}
                  className="bg-blueprint hover:bg-primary text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors"
                >
                  Auswahl speichern
                </button>
                <button
                  onClick={acceptAll}
                  className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors"
                >
                  Alle akzeptieren
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={rejectAll}
                  className="bg-white border border-slate-200 hover:border-slate-300 text-blueprint px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors"
                >
                  Nur notwendige
                </button>
                <button
                  onClick={() => setShowDetails(true)}
                  className="bg-white border border-slate-200 hover:border-slate-300 text-blueprint px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors"
                >
                  Einstellungen
                </button>
                <button
                  onClick={acceptAll}
                  className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors"
                >
                  Alle akzeptieren
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
