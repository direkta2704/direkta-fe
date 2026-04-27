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
    </div>
  );
}
