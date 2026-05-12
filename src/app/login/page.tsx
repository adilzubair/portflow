"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { tap, toggle, success as hapticSuccess, destructive as hapticError } from "@/lib/haptics";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [signedUp, setSignedUp] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();

    if (mode === "login") {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        hapticError();
        setError(signInError.message);
        setLoading(false);
        return;
      }
    } else {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        hapticError();
        setError(signUpError.message);
        setLoading(false);
        return;
      }
      hapticSuccess();
      setSignedUp(true);
      setLoading(false);
      return;
    }

    hapticSuccess();
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-bg-primary px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-md items-center gap-8 lg:max-w-5xl lg:grid-cols-[1fr_26rem]">
        <section className="hidden lg:block">
          <div className="max-w-xl">
            <h1 className="font-display text-5xl font-semibold tracking-[-0.05em] text-text-primary">
              Portfolio clarity across every market you hold.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-text-secondary">
              Track AED-normalized performance, allocation, and price freshness across India, US, UAE, crypto, and funds.
            </p>
          </div>
        </section>

        <section className="glass-card w-full p-6 sm:p-8">
          {signedUp ? (
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-bg-elevated">
                <svg className="h-6 w-6 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold tracking-[-0.02em] text-text-primary">Account created</h2>
              <p className="mt-3 text-sm leading-6 text-text-secondary">
                Your account is pending approval. You&apos;ll be notified once access has been granted.
              </p>
              <button
                type="button"
                onClick={() => { setSignedUp(false); setMode("login"); }}
                className="mt-6 text-sm font-medium text-text-secondary transition hover:text-text-primary"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <div>
                <div className="font-display text-2xl font-semibold tracking-[-0.04em] text-text-primary">Portflow</div>
                <h2 className="mt-6 text-2xl font-semibold tracking-[-0.03em] text-text-primary">
                  {mode === "login" ? "Sign in" : "Create account"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  {mode === "login" ? "Welcome back. Your dashboard is ready." : "Create your account and start tracking holdings."}
                </p>
              </div>

              {error && (
                <div className="mt-6 rounded-[1.2rem] border border-accent-loss/20 bg-accent-loss-bg px-4 py-3 text-sm text-accent-loss">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                <div>
                  <label className="mb-2 block text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-text-muted" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-border-default bg-bg-input px-4 py-3.5 text-sm text-text-primary transition placeholder:text-text-muted focus:border-accent-violet"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-text-muted" htmlFor="password">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={6}
                    placeholder="At least 6 characters"
                    className="w-full rounded-xl border border-border-default bg-bg-input px-4 py-3.5 text-sm text-text-primary transition placeholder:text-text-muted focus:border-accent-violet"
                  />
                </div>

                <button
                  type="submit"
                  onClick={tap}
                  disabled={loading}
                  className="w-full rounded-xl bg-accent-violet px-5 py-3.5 text-sm font-semibold text-bg-primary transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {loading ? (mode === "login" ? "Signing in" : "Creating account") : mode === "login" ? "Sign in" : "Create account"}
                </button>
              </form>

              <div className="mt-6 border-t border-white/6 pt-5">
                <button
                  type="button"
                  onClick={() => {
                    toggle();
                    setMode((current) => (current === "login" ? "signup" : "login"));
                    setError("");
                  }}
                  className="text-sm font-medium text-text-secondary transition hover:text-text-primary"
                >
                  {mode === "login" ? "Need an account? Create one" : "Already have an account? Sign in"}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
