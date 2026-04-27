export default function ViewingsPage() {
  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-blueprint tracking-tight">
            Viewings
          </h1>
          <p className="text-slate-500 mt-1">
            Schedule and manage property viewings with qualified buyers.
          </p>
        </div>
        <button className="bg-primary hover:bg-primary-dark text-white px-5 py-3 rounded-xl text-sm font-black uppercase tracking-[0.18em] transition-all duration-300 hover:scale-[1.02] flex items-center gap-2 shadow-lg shadow-primary/25">
          <span className="material-symbols-outlined text-lg">
            calendar_add_on
          </span>
          Add time slots
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Calendar placeholder */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 p-7">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black text-blueprint">
                April 2026
              </h2>
              <div className="flex items-center gap-2">
                <button className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blueprint hover:border-slate-300 transition-colors">
                  <span className="material-symbols-outlined text-lg">
                    chevron_left
                  </span>
                </button>
                <button className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blueprint hover:border-slate-300 transition-colors">
                  <span className="material-symbols-outlined text-lg">
                    chevron_right
                  </span>
                </button>
              </div>
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-px bg-slate-100 rounded-xl overflow-hidden">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div
                  key={d}
                  className="bg-slate-50 p-2 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400"
                >
                  {d}
                </div>
              ))}
              {Array.from({ length: 35 }, (_, i) => {
                const day = i - 1;
                const isCurrentMonth = day >= 0 && day < 30;
                return (
                  <div
                    key={i}
                    className={`bg-white p-2 min-h-[72px] text-sm ${
                      isCurrentMonth
                        ? "text-blueprint"
                        : "text-slate-300"
                    } ${day === 26 ? "ring-2 ring-primary ring-inset" : ""}`}
                  >
                    {isCurrentMonth ? day + 1 : ""}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Upcoming viewings */}
        <div>
          <div className="bg-white rounded-2xl border border-slate-200 p-7">
            <h2 className="text-lg font-black text-blueprint mb-5">
              Upcoming
            </h2>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <span className="material-symbols-outlined text-4xl text-slate-300 mb-3">
                event_available
              </span>
              <p className="text-sm text-slate-400">No viewings scheduled</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-7 mt-6">
            <h2 className="text-lg font-black text-blueprint mb-3">
              Availability
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Set your available time slots so qualified buyers can book
              viewings directly.
            </p>
            <button className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-blueprint py-3 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-colors flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-base">
                edit_calendar
              </span>
              Set available slots
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
