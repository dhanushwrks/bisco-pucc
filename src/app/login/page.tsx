"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "red" | "green"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const { data, error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
          });
    setBusy(false);
    if (error) return setMsg({ tone: "red", text: error.message });
    if (!data.session) return setMsg({ tone: "green", text: "Check your inbox to confirm your email, then sign in." });
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="grid min-h-screen place-items-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={40} />
          <h1 className="mt-4 text-xl font-semibold tracking-tight">PUCC Console</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {mode === "signin" ? "Sign in to manage your outlets" : "Create an owner account"}
          </p>
        </div>
        <form onSubmit={submit} className="card space-y-4 p-6 shadow-sm">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" required autoComplete="email" className="input"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" required minLength={6} className="input"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {msg && (
            <p className={`text-sm ${msg.tone === "red" ? "text-rose-600" : "text-brand-700"}`}>{msg.text}</p>
          )}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-zinc-500">
          {mode === "signin" ? "New PUCC owner? " : "Already have an account? "}
          <button className="font-medium text-zinc-900 hover:underline"
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMsg(null); }}>
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
        <p className="mt-2 text-center text-xs text-zinc-400">Outlet operators: use the login your owner created for you.</p>
      </div>
    </main>
  );
}
