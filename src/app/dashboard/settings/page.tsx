import { auth } from "@/lib/auth";

export default async function SettingsPage() {
  const session = await auth();

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-blueprint tracking-tight">
          Settings
        </h1>
        <p className="text-slate-500 mt-1">
          Manage your account, billing, and preferences.
        </p>
      </div>

      <div className="max-w-3xl space-y-6">
        {/* Profile */}
        <div className="bg-white rounded-2xl border border-slate-200 p-7">
          <h2 className="text-lg font-black text-blueprint mb-6">Profile</h2>
          <div className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                  Full name
                </label>
                <input
                  type="text"
                  defaultValue={session?.user?.name || ""}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  defaultValue={session?.user?.email || ""}
                  disabled
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-400 bg-slate-50 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                Phone
              </label>
              <input
                type="tel"
                placeholder="+49 ..."
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <div className="flex justify-end">
              <button className="bg-blueprint hover:bg-primary text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors">
                Save changes
              </button>
            </div>
          </div>
        </div>

        {/* Password */}
        <div className="bg-white rounded-2xl border border-slate-200 p-7">
          <h2 className="text-lg font-black text-blueprint mb-6">Password</h2>
          <div className="space-y-5">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                Current password
              </label>
              <input
                type="password"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                  New password
                </label>
                <input
                  type="password"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                  Confirm new password
                </label>
                <input
                  type="password"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button className="bg-blueprint hover:bg-primary text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors">
                Update password
              </button>
            </div>
          </div>
        </div>

        {/* Billing */}
        <div className="bg-white rounded-2xl border border-slate-200 p-7">
          <h2 className="text-lg font-black text-blueprint mb-2">
            Billing & Plan
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            Manage your subscription and payment method.
          </p>

          <div className="bg-slate-50 rounded-xl p-5 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">
                Current plan
              </div>
              <div className="font-black text-blueprint">Free (No listings)</div>
            </div>
            <button className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors">
              Choose plan
            </button>
          </div>
        </div>

        {/* Data & Privacy */}
        <div className="bg-white rounded-2xl border border-slate-200 p-7">
          <h2 className="text-lg font-black text-blueprint mb-2">
            Data & Privacy
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            GDPR data management and account deletion.
          </p>

          <div className="space-y-4">
            <button className="w-full flex items-center justify-between py-3 px-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors text-left">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-lg text-slate-400">
                  download
                </span>
                <div>
                  <p className="text-sm font-bold text-blueprint">
                    Export my data
                  </p>
                  <p className="text-xs text-slate-400">
                    Download all your data as JSON + PDF (GDPR Art. 20)
                  </p>
                </div>
              </div>
              <span className="material-symbols-outlined text-slate-400">
                chevron_right
              </span>
            </button>

            <button className="w-full flex items-center justify-between py-3 px-4 rounded-xl border border-red-200 hover:border-red-300 hover:bg-red-50/50 transition-colors text-left">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-lg text-red-400">
                  delete_forever
                </span>
                <div>
                  <p className="text-sm font-bold text-red-600">
                    Delete account
                  </p>
                  <p className="text-xs text-red-400">
                    Permanently delete your account and all data (14-day grace
                    period)
                  </p>
                </div>
              </div>
              <span className="material-symbols-outlined text-red-400">
                chevron_right
              </span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
