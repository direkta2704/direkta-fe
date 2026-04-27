"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";

type AuthView = "signin" | "signup";

interface AuthModalProps {
  isOpen: boolean;
  initialView: AuthView;
  onClose: () => void;
}

export default function AuthModal({
  isOpen,
  initialView,
  onClose,
}: AuthModalProps) {
  const [view, setView] = useState<AuthView>(initialView);

  useEffect(() => {
    if (isOpen) setView(initialView);
  }, [isOpen, initialView]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-blueprint/60 backdrop-blur-sm modal-backdrop"
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-[440px] max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-heading"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 z-10 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
          aria-label="Close"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>

        <div className="p-8 sm:p-10">
          <div className="flex items-center gap-2 mb-8">
            <span className="material-symbols-outlined text-2xl text-primary">
              home_work
            </span>
            <span className="text-lg font-black tracking-tight display-font">
              DIREKTA<span className="text-primary">.</span>
            </span>
          </div>

          {view === "signin" ? (
            <SignInView
              onSwitch={() => setView("signup")}
              onSuccess={onClose}
            />
          ) : (
            <SignUpView
              onSwitch={() => setView("signin")}
              onSuccess={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SignInView({
  onSwitch,
  onSuccess,
}: {
  onSwitch: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
      return;
    }

    onSuccess();
    window.location.reload();
  }

  return (
    <>
      <h2
        id="auth-heading"
        className="text-2xl font-black text-blueprint mb-2"
      >
        Welcome back
      </h2>
      <p className="text-sm text-slate-500 mb-8">
        Sign in to your Direkta account to continue.
      </p>

      {error && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              Password
            </label>
            <button
              type="button"
              className="text-[10px] font-bold text-primary hover:text-primary-dark transition-colors"
            >
              Forgot password?
            </button>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary hover:bg-primary-dark text-white py-3.5 rounded-xl font-black text-sm uppercase tracking-[0.18em] transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-primary/25 disabled:opacity-60 disabled:hover:scale-100"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <Divider />
      <GoogleButton />

      <p className="text-center text-sm text-slate-500 mt-8">
        Don&apos;t have an account?{" "}
        <button
          onClick={onSwitch}
          className="font-bold text-primary hover:text-primary-dark transition-colors"
        >
          Create one free
        </button>
      </p>
    </>
  );
}

function SignUpView({
  onSwitch,
  onSuccess,
}: {
  onSwitch: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!agreed) {
      setError("Please agree to the AGB and Datenschutz");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setLoading(false);
      setError(data.error || "Something went wrong");
      return;
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Account created but sign-in failed. Please sign in manually.");
      onSwitch();
      return;
    }

    onSuccess();
    window.location.reload();
  }

  return (
    <>
      <h2
        id="auth-heading"
        className="text-2xl font-black text-blueprint mb-2"
      >
        Create your account
      </h2>
      <p className="text-sm text-slate-500 mb-8">
        Start selling your property — no commission.
      </p>

      {error && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
            Full name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Max Mustermann"
            autoComplete="name"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 8 characters"
            autoComplete="new-password"
            required
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-blueprint placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20"
          />
          <span className="text-xs text-slate-500 leading-relaxed">
            I agree to the{" "}
            <a
              href="#"
              className="font-bold text-blueprint hover:text-primary transition-colors"
            >
              AGB
            </a>{" "}
            and{" "}
            <a
              href="#"
              className="font-bold text-blueprint hover:text-primary transition-colors"
            >
              Datenschutz
            </a>
          </span>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary hover:bg-primary-dark text-white py-3.5 rounded-xl font-black text-sm uppercase tracking-[0.18em] transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-primary/25 disabled:opacity-60 disabled:hover:scale-100"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <Divider />
      <GoogleButton />

      <p className="text-center text-sm text-slate-500 mt-8">
        Already have an account?{" "}
        <button
          onClick={onSwitch}
          className="font-bold text-primary hover:text-primary-dark transition-colors"
        >
          Sign in
        </button>
      </p>
    </>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-4 my-6">
      <div className="flex-1 h-px bg-slate-200"></div>
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
        Or continue with
      </span>
      <div className="flex-1 h-px bg-slate-200"></div>
    </div>
  );
}

function GoogleButton() {
  return (
    <button className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-sm font-bold text-blueprint">
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
      Google
    </button>
  );
}
