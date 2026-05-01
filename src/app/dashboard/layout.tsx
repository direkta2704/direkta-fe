import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Sidebar from "./components/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        userName={session.user.name}
        userEmail={session.user.email}
      />
      <main className="lg:ml-[260px] min-h-screen">
        <div className="p-6 lg:p-10">{children}</div>
      </main>
      {/* F-X-05: Support escalation — 2 clicks max */}
      <a
        href="mailto:support@direkta.de?subject=Hilfe%20benötigt"
        className="fixed bottom-6 right-6 z-50 bg-blueprint hover:bg-primary text-white w-14 h-14 rounded-full shadow-xl shadow-blueprint/30 flex items-center justify-center transition-all hover:scale-110 group"
        title="Hilfe & Support"
      >
        <span className="material-symbols-outlined text-2xl">support_agent</span>
        <span className="absolute right-full mr-3 bg-blueprint text-white text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Hilfe benötigt?
        </span>
      </a>
    </div>
  );
}
