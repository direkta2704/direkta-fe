"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";

/* ── types ── */

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
};

type ToastType = "success" | "error" | "info";

type ToastEntry = {
  id: number;
  message: string;
  type: ToastType;
};

type DialogContextType = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  toast: (msgOrOpts: string | { message: string; type?: ToastType; duration?: number }) => void;
};

const DialogContext = createContext<DialogContextType | null>(null);

export function useConfirm() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useConfirm must be used within DialogProvider");
  return ctx.confirm;
}

export function useToast() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useToast must be used within DialogProvider");
  return ctx.toast;
}

/* ── provider ── */

let nextToastId = 0;

export default function DialogProvider({ children }: { children: React.ReactNode }) {
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { visible: boolean }) | null>(null);
  const resolveRef = useRef<((v: boolean) => void) | null>(null);
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setConfirmState({ ...opts, visible: true });
    });
  }, []);

  const closeConfirm = useCallback((result: boolean) => {
    setConfirmState((s) => (s ? { ...s, visible: false } : null));
    setTimeout(() => {
      resolveRef.current?.(result);
      resolveRef.current = null;
      setConfirmState(null);
    }, 200);
  }, []);

  const toast = useCallback(
    (msgOrOpts: string | { message: string; type?: ToastType; duration?: number }) => {
      const { message, type, duration } =
        typeof msgOrOpts === "string"
          ? { message: msgOrOpts, type: "info" as ToastType, duration: 3000 }
          : { message: msgOrOpts.message, type: msgOrOpts.type ?? "info", duration: msgOrOpts.duration ?? 3500 };

      const id = ++nextToastId;
      setToasts((t) => [...t, { id, message, type }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), duration);
    },
    [],
  );

  useEffect(() => {
    if (!confirmState?.visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeConfirm(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [confirmState?.visible, closeConfirm]);

  return (
    <DialogContext.Provider value={{ confirm, toast }}>
      {children}

      {/* ── confirm modal ── */}
      {confirmState && (
        <div
          className={`fixed inset-0 z-[200] flex items-center justify-center transition-opacity duration-200 ${
            confirmState.visible ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => closeConfirm(false)} />
          <div
            className={`relative bg-white rounded-2xl shadow-2xl shadow-black/20 w-full max-w-md mx-4 overflow-hidden transition-all duration-200 ${
              confirmState.visible ? "scale-100 translate-y-0" : "scale-95 translate-y-2"
            }`}
          >
            <div className="p-6">
              {confirmState.title && (
                <h3 className="text-lg font-bold text-slate-900 mb-1">{confirmState.title}</h3>
              )}
              <p className="text-sm text-slate-600 leading-relaxed">{confirmState.message}</p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 pb-5">
              <button
                onClick={() => closeConfirm(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                {confirmState.cancelLabel || "Abbrechen"}
              </button>
              <button
                onClick={() => closeConfirm(true)}
                autoFocus
                className={`px-5 py-2 rounded-xl text-sm font-bold text-white transition-colors ${
                  confirmState.variant === "danger"
                    ? "bg-red-600 hover:bg-red-700"
                    : confirmState.variant === "warning"
                      ? "bg-amber-500 hover:bg-amber-600"
                      : "bg-blueprint hover:bg-blueprint/90"
                }`}
              >
                {confirmState.confirmLabel || "Bestätigen"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── toasts ── */}
      <div className="fixed top-4 right-4 z-[210] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto animate-slide-in-right flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold max-w-sm ${
              t.type === "success"
                ? "bg-emerald-600 text-white"
                : t.type === "error"
                  ? "bg-red-600 text-white"
                  : "bg-blueprint text-white"
            }`}
          >
            <span className="material-symbols-outlined text-lg">
              {t.type === "success" ? "check_circle" : t.type === "error" ? "error" : "info"}
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </DialogContext.Provider>
  );
}
