import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import Image from "next/image";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const firstName = session?.user?.name?.split(" ")[0] || "";

  const currentUser = await prisma.user.findUnique({ where: { id: userId! }, select: { emailVerified: true, email: true } });
  const emailVerified = !!currentUser?.emailVerified;

  // Fetch all dashboard data in parallel
  const [
    properties,
    activeListings,
    allListings,
    leadsThisWeek,
    openOffers,
    upcomingViewings,
    recentEvents,
    portalCredentials,
  ] = await Promise.all([
    prisma.property.findMany({
      where: { userId: userId! },
      include: {
        media: { where: { kind: "PHOTO" }, orderBy: { ordering: "asc" }, take: 1 },
        energyCert: { select: { id: true } },
        listings: { select: { status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.listing.count({
      where: { property: { userId: userId! }, status: "ACTIVE" },
    }),
    prisma.listing.count({
      where: { property: { userId: userId! } },
    }),
    prisma.lead.count({
      where: {
        listing: { property: { userId: userId! } },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.offer.count({
      where: {
        listing: { property: { userId: userId! } },
        status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
      },
    }),
    prisma.viewing.count({
      where: {
        listing: { property: { userId: userId! } },
        startsAt: { gte: new Date() },
        status: { in: ["PROPOSED", "CONFIRMED"] },
      },
    }),
    prisma.listingEvent.findMany({
      where: { listing: { property: { userId: userId! } } },
      include: {
        listing: {
          select: { slug: true, property: { select: { street: true, houseNumber: true, city: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.portalCredential.count({
      where: { userId: userId!, status: "ACTIVE" },
    }),
  ]);

  const totalProperties = properties.length;
  const hasPhotos = properties.some(
    (p) => p.media.length > 0 && p.listings.length > 0
  );
  const photosComplete = properties.some((p) => p.media.length >= 1);
  const hasEnergy = properties.some((p) => p.energyCert !== null);
  const hasPublished = activeListings > 0;
  const hasPortal = portalCredentials > 0;

  const checklistDone = [
    true,
    totalProperties > 0,
    photosComplete,
    hasEnergy,
    hasPublished,
    hasPortal,
  ].filter(Boolean).length;

  const EVENT_LABELS: Record<string, string> = {
    CREATED: "Inserat erstellt",
    TEXT_GENERATED: "Beschreibung generiert",
    PRICE_RECOMMENDED: "Preisempfehlung berechnet",
    STATUS_CHANGED: "Status geändert",
    PUBLISHED: "Veröffentlicht",
  };

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

      {/* Email verification banner */}
      {!emailVerified && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-amber-600 text-xl">mail</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-800">E-Mail-Adresse nicht bestätigt</p>
              <p className="text-xs text-amber-600">Bitte klicken Sie auf den Link in der Bestätigungsmail an {currentUser?.email}. Ohne Bestätigung können Sie keine Inserate veröffentlichen.</p>
            </div>
            <a
              href={`/api/auth/resend-verification?email=${encodeURIComponent(currentUser?.email || "")}`}
              className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-[0.15em] transition-colors flex-shrink-0"
            >
              Erneut senden
            </a>
          </div>
        </div>
      )}

      {/* Next action hint */}
      {(() => {
        if (openOffers > 0) return (
          <Link href="/dashboard/offers" className="mb-6 block bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 hover:bg-emerald-100 transition-colors">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-emerald-600 text-xl">priority_high</span>
              <div>
                <p className="text-sm font-bold text-emerald-800">{openOffers} offene{openOffers > 1 ? "s" : ""} Angebot{openOffers > 1 ? "e" : ""} warten auf Ihre Antwort</p>
                <p className="text-xs text-emerald-600">Klicken Sie hier um Angebote zu prüfen und zu entscheiden.</p>
              </div>
              <span className="material-symbols-outlined text-emerald-400 ml-auto">arrow_forward</span>
            </div>
          </Link>
        );
        if (leadsThisWeek > 0) return (
          <Link href="/dashboard/leads" className="mb-6 block bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 hover:bg-blue-100 transition-colors">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-blue-600 text-xl">person_add</span>
              <div>
                <p className="text-sm font-bold text-blue-800">{leadsThisWeek} neue Interessent{leadsThisWeek > 1 ? "en" : ""} diese Woche</p>
                <p className="text-xs text-blue-600">Kontaktieren Sie Ihre Interessenten und vereinbaren Sie Besichtigungen.</p>
              </div>
              <span className="material-symbols-outlined text-blue-400 ml-auto">arrow_forward</span>
            </div>
          </Link>
        );
        if (upcomingViewings > 0) return (
          <Link href="/dashboard/viewings" className="mb-6 block bg-violet-50 border border-violet-200 rounded-xl px-5 py-4 hover:bg-violet-100 transition-colors">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-violet-600 text-xl">calendar_today</span>
              <div>
                <p className="text-sm font-bold text-violet-800">{upcomingViewings} Besichtigung{upcomingViewings > 1 ? "en" : ""} stehen an</p>
                <p className="text-xs text-violet-600">Bereiten Sie sich auf Ihre anstehenden Termine vor.</p>
              </div>
              <span className="material-symbols-outlined text-violet-400 ml-auto">arrow_forward</span>
            </div>
          </Link>
        );
        if (totalProperties === 0) return (
          <Link href="/dashboard/expose-agent" className="mb-6 block bg-primary/5 border border-primary/20 rounded-xl px-5 py-4 hover:bg-primary/10 transition-colors">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-xl">smart_toy</span>
              <div>
                <p className="text-sm font-bold text-blueprint">Starten Sie jetzt mit dem Exposé-Assistenten</p>
                <p className="text-xs text-slate-500">Erstellen Sie Ihr erstes Inserat in wenigen Minuten — KI-gestützt.</p>
              </div>
              <span className="material-symbols-outlined text-primary/40 ml-auto">arrow_forward</span>
            </div>
          </Link>
        );
        return null;
      })()}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        <StatCard icon="description" label="Aktive Inserate" value={String(activeListings)} color="primary" href="/dashboard/listings" />
        <StatCard icon="people" label="Interessenten (7 Tage)" value={String(leadsThisWeek)} color="blue" href="/dashboard/leads" />
        <StatCard icon="handshake" label="Offene Angebote" value={String(openOffers)} color="emerald" href="/dashboard/offers" />
        <StatCard icon="calendar_month" label="Anstehende Besichtigungen" value={String(upcomingViewings)} color="violet" href="/dashboard/viewings" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Quick actions */}
          <div className="bg-white rounded-2xl border border-slate-200 p-7">
            <h2 className="text-lg font-black text-blueprint mb-5">Schnellaktionen</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <QuickAction icon="smart_toy" title="Exposé-Assistent" description="KI erstellt Ihr Inserat im Gespräch — schnell und einfach" href="/dashboard/expose-agent" highlight />
              <QuickAction icon="add_home" title="Immobilie hinzufügen" description="Manuell alle Daten Schritt für Schritt eingeben" href="/dashboard/properties/new" />
              <QuickAction icon="sync_alt" title="IS24 veröffentlichen" description="Inserate auf ImmobilienScout24 publizieren" href="/dashboard/syndication" />
              <QuickAction icon="description" title="Inserate verwalten" description={`${allListings} Inserat${allListings !== 1 ? "e" : ""} · ${activeListings} aktiv`} href="/dashboard/listings" />
            </div>
          </div>

          {/* Recent properties */}
          {totalProperties > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-7">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-black text-blueprint">Ihre Immobilien</h2>
                <Link href="/dashboard/properties" className="text-xs font-bold text-primary hover:text-primary-dark transition-colors">
                  Alle anzeigen
                </Link>
              </div>
              <div className="space-y-3">
                {properties.slice(0, 3).map((p) => (
                  <Link
                    key={p.id}
                    href={`/dashboard/properties/${p.id}`}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
                  >
                    <div className="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0 relative">
                      {p.media.length > 0 ? (
                        <Image src={p.media[0].storageKey} alt="" fill className="object-cover" sizes="56px" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-slate-300">home_work</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-blueprint text-sm group-hover:text-primary transition-colors truncate">
                        {p.street} {p.houseNumber}
                      </p>
                      <p className="text-xs text-slate-400">{p.postcode} {p.city} · {p.livingArea} m²</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.listings.length > 0 && (
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                          p.listings[0].status === "ACTIVE" ? "bg-emerald-50 text-emerald-600"
                          : p.listings[0].status === "DRAFT" ? "bg-amber-50 text-amber-600"
                          : "bg-slate-100 text-slate-500"
                        }`}>{p.listings[0].status}</span>
                      )}
                      <span className="material-symbols-outlined text-slate-300 text-lg">chevron_right</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Recent activity */}
          <div className="bg-white rounded-2xl border border-slate-200 p-7">
            <h2 className="text-lg font-black text-blueprint mb-5">Letzte Aktivitäten</h2>
            {recentEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <span className="material-symbols-outlined text-5xl text-slate-300 mb-4">history</span>
                <p className="text-slate-400 font-medium">Noch keine Aktivitäten</p>
                <p className="text-sm text-slate-400 mt-1">Erstellen Sie Ihr erstes Inserat, um loszulegen.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentEvents.map((ev) => (
                  <div key={ev.id} className="flex items-center gap-4 py-3 border-b border-slate-100 last:border-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      ev.type === "STATUS_CHANGED" ? "bg-emerald-50 text-emerald-600"
                      : ev.type === "PRICE_RECOMMENDED" ? "bg-blue-50 text-blue-600"
                      : ev.type === "TEXT_GENERATED" ? "bg-violet-50 text-violet-600"
                      : "bg-slate-100 text-slate-500"
                    }`}>
                      <span className="material-symbols-outlined text-base">
                        {ev.type === "STATUS_CHANGED" ? "published_with_changes"
                          : ev.type === "PRICE_RECOMMENDED" ? "finance"
                          : ev.type === "TEXT_GENERATED" ? "auto_awesome"
                          : "event"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-blueprint truncate">
                        {EVENT_LABELS[ev.type] || ev.type}
                      </p>
                      <p className="text-xs text-slate-400">
                        {ev.listing.property.street} {ev.listing.property.houseNumber}, {ev.listing.property.city}
                      </p>
                    </div>
                    <p className="text-[10px] text-slate-400 flex-shrink-0">
                      {formatTimeAgo(new Date(ev.createdAt))}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Getting started */}
          <div className="bg-blueprint rounded-2xl p-7 text-white">
            <h2 className="text-lg font-black mb-5">Erste Schritte</h2>
            <div className="space-y-4">
              <ChecklistItem done label="Konto erstellt" />
              <ChecklistItem done={totalProperties > 0} label="Immobilie hinzufügen" href="/dashboard/properties/new" />
              <ChecklistItem done={photosComplete} label="Fotos hochladen" />
              <ChecklistItem done={hasEnergy} label="Energieausweis hochladen" />
              <ChecklistItem done={hasPublished} label="Inserat veröffentlichen" href="/dashboard/listings" />
              <ChecklistItem done={hasPortal} label="ImmobilienScout24 verbinden" href="/dashboard/syndication" />
            </div>
            <div className="mt-6 pt-5 border-t border-white/10">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">Fortschritt</span>
                <span className="font-black text-primary">{checklistDone} / 6</span>
              </div>
              <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(checklistDone / 6) * 100}%` }} />
              </div>
            </div>
          </div>

          {/* Summary card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-7">
            <h3 className="font-black text-blueprint text-sm mb-4">Zusammenfassung</h3>
            <div className="space-y-3">
              <SummaryRow label="Immobilien" value={String(totalProperties)} />
              <SummaryRow label="Inserate gesamt" value={String(allListings)} />
              <SummaryRow label="Davon aktiv" value={String(activeListings)} />
              <SummaryRow label="Interessenten (gesamt)" value={String(leadsThisWeek)} />
              <SummaryRow label="Offene Angebote" value={String(openOffers)} />
            </div>
          </div>

          {/* Help */}
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

function StatCard({ icon, label, value, color, href }: { icon: string; label: string; value: string; color: string; href: string }) {
  const colorMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    violet: "bg-violet-50 text-violet-600",
  };
  return (
    <Link href={href} className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-primary/30 transition-colors group">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl ${colorMap[color]} flex items-center justify-center`}>
          <span className="material-symbols-outlined text-xl">{icon}</span>
        </div>
        <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors">arrow_forward</span>
      </div>
      <p className="text-3xl font-black text-blueprint">{value}</p>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-1">{label}</p>
    </Link>
  );
}

function QuickAction({ icon, title, description, href, highlight }: { icon: string; title: string; description: string; href: string; highlight?: boolean }) {
  return (
    <Link href={href} className={`flex items-start gap-4 p-4 rounded-xl border transition-all group ${
      highlight ? "border-primary/30 bg-primary/5 hover:bg-primary/10" : "border-slate-100 hover:border-primary/30 hover:bg-primary/[0.02]"
    }`}>
      <div className={`w-10 h-10 rounded-xl text-white flex items-center justify-center flex-shrink-0 transition-colors ${
        highlight ? "bg-primary" : "bg-blueprint group-hover:bg-primary"
      }`}>
        <span className="material-symbols-outlined text-xl">{icon}</span>
      </div>
      <div>
        <h3 className="font-black text-blueprint text-sm">{title}</h3>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
    </Link>
  );
}

function ChecklistItem({ label, done, href }: { label: string; done?: boolean; href?: string }) {
  const content = (
    <div className="flex items-center gap-3">
      <span className={`material-symbols-outlined text-lg ${done ? "text-primary" : "text-white/20"}`}>
        {done ? "check_circle" : "radio_button_unchecked"}
      </span>
      <span className={`text-sm ${done ? "text-white/40 line-through" : "text-white/80"}`}>{label}</span>
    </div>
  );
  if (href && !done) {
    return <Link href={href} className="block hover:opacity-80 transition-opacity">{content}</Link>;
  }
  return content;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-black text-blueprint">{value}</span>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "Gerade eben";
  if (diffMin < 60) return `Vor ${diffMin} Min.`;
  if (diffHr < 24) return `Vor ${diffHr} Std.`;
  if (diffDay < 7) return `Vor ${diffDay} Tag${diffDay > 1 ? "en" : ""}`;
  return date.toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}
