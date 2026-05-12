"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function PendingApprovalPage() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-bg-primary px-4 py-8 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
        <div className="glass-card w-full p-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-elevated">
            <svg className="h-7 w-7 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
            </svg>
          </div>

          <div className="font-display text-2xl font-semibold tracking-[-0.04em] text-text-primary">
            Portflow
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-[-0.02em] text-text-primary">
            Account pending approval
          </h1>
          <p className="mt-3 text-sm leading-6 text-text-secondary">
            Your account has been created and is awaiting approval. You&apos;ll be able to sign in once access has been granted.
          </p>

          <button
            onClick={handleSignOut}
            className="mt-8 w-full rounded-xl border border-border-default bg-bg-elevated px-5 py-3 text-sm font-medium text-text-secondary transition hover:bg-bg-card-hover"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
