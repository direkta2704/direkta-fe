"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState, useEffect } from "react";

interface SidebarProps {
  userName: string | null | undefined;
  userEmail: string | null | undefined;
}

const navMain = [
  { href: "/dashboard", label: "Übersicht", icon: "dashboard" },
  { href: "/dashboard/properties", label: "Immobilien", icon: "home_work" },
  { href: "/dashboard/listings", label: "Inserate", icon: "description" },
  { href: "/dashboard/leads", label: "Interessenten", icon: "people" },
  { href: "/dashboard/offers", label: "Angebote", icon: "handshake" },
  { href: "/dashboard/viewings", label: "Besichtigungen", icon: "calendar_month" },
];

const navAgents = [
  { href: "/dashboard/expose-agent", label: "Exposé-Assistent", icon: "forum" },
];

const navTools = [
  { href: "/dashboard/syndication", label: "Portal-Sync", icon: "sync_alt" },
];

const navBottom = [
  { href: "/dashboard/settings", label: "Einstellungen", icon: "settings" },
];

export default function Sidebar({ userName, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [newLeadCount, setNewLeadCount] = useState(0);

  useEffect(() => {
    fetch("/api/leads?countOnly=new")
      .then((r) => r.json())
      .then((data) => { if (typeof data.count === "number") setNewLeadCount(data.count); })
      .catch(() => {});
  }, [pathname]);

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 pt-7 pb-8">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="material-symbols-outlined text-2xl text-primary transition-transform duration-500 group-hover:rotate-12">
            home_work
          </span>
          <span className="text-lg font-black tracking-tight text-white display-font">
            DIREKTA<span className="text-primary">.</span>
          </span>
        </Link>
      </div>

      {/* Main nav */}
      <div className="px-3 flex-1">
        <div className="text-[9px] font-black uppercase tracking-[0.25em] text-white/30 px-3 mb-3">
          Hauptmenü
        </div>
        <nav className="space-y-1">
          {navMain.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                isActive(item.href)
                  ? "bg-primary text-white shadow-lg shadow-primary/25"
                  : "text-white/60 hover:text-white hover:bg-white/[0.06]"
              }`}
            >
              <span className="material-symbols-outlined text-xl">
                {item.icon}
              </span>
              {item.label}
              {item.label === "Interessenten" && newLeadCount > 0 && (
                <span className="ml-auto text-[10px] font-black bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                  {newLeadCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="text-[9px] font-black uppercase tracking-[0.25em] text-white/30 px-3 mb-3 mt-8">
          KI-Assistenten
        </div>
        <nav className="space-y-1 mb-6">
          {navAgents.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                isActive(item.href)
                  ? "bg-primary text-white shadow-lg shadow-primary/25"
                  : "text-white/60 hover:text-white hover:bg-white/[0.06]"
              }`}
            >
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="text-[9px] font-black uppercase tracking-[0.25em] text-white/30 px-3 mb-3">
          Werkzeuge
        </div>
        <nav className="space-y-1">
          {navTools.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                isActive(item.href)
                  ? "bg-primary text-white shadow-lg shadow-primary/25"
                  : "text-white/60 hover:text-white hover:bg-white/[0.06]"
              }`}
            >
              <span className="material-symbols-outlined text-xl">
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Bottom nav */}
      <div className="px-3 pb-4 space-y-1">
        {navBottom.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              isActive(item.href)
                ? "bg-primary text-white"
                : "text-white/60 hover:text-white hover:bg-white/[0.06]"
            }`}
          >
            <span className="material-symbols-outlined text-xl">
              {item.icon}
            </span>
            {item.label}
          </Link>
        ))}
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-white/60 hover:text-white hover:bg-white/[0.06] transition-all duration-200 w-full"
        >
          <span className="material-symbols-outlined text-xl">logout</span>
          Abmelden
        </button>
      </div>

      {/* User info */}
      <div className="px-4 py-4 border-t border-white/10 mx-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-black">
            {(userName || userEmail || "U").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">
              {userName || "Seller"}
            </p>
            <p className="text-[11px] text-white/40 truncate">{userEmail}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-[60] w-10 h-10 rounded-xl bg-blueprint text-white flex items-center justify-center shadow-lg"
      >
        <span className="material-symbols-outlined">
          {mobileOpen ? "close" : "menu"}
        </span>
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-[49]"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-screen w-[260px] bg-blueprint z-[50] transition-transform duration-300 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
