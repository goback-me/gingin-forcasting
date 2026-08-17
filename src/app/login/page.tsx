"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setBusy(false);
      setError("Wrong email or password.");
      return;
    }

    const redirectTo = searchParams.get("redirectTo") || "/";
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F4EF]">
      <form onSubmit={handleSubmit} className="bg-white border border-border rounded-lg p-8 w-full max-w-sm shadow-sm">
        <div className="font-display text-[22px] mb-1">Gingin Forecast</div>
        <div className="text-inkfaint text-[13px] mb-6">Sign in to continue</div>

        {error && <div className="bg-brick-soft text-brick-strong rounded-lg px-3 py-2 text-[12.5px] mb-4">{error}</div>}

        <label className="block text-[11px] text-inkfaint uppercase tracking-wide mb-1">Email</label>
        <input
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-borderstrong rounded-lg px-3 py-2 text-[13px] mb-4"
        />

        <label className="block text-[11px] text-inkfaint uppercase tracking-wide mb-1">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-borderstrong rounded-lg px-3 py-2 text-[13px] mb-6"
        />

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-green-strong text-white rounded-lg px-4 py-2.5 text-[13px] font-medium hover:bg-green disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}