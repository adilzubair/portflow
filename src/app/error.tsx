"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="glass-card w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-elevated text-text-secondary">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008zM12 3l9.428 16.5H2.572L12 3z" />
          </svg>
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-[-0.03em] text-text-primary">
          Something went wrong
        </h1>
        <p className="mt-3 text-sm leading-6 text-text-secondary">
          The page hit an unexpected error. You can try again, or head back to the dashboard if it keeps happening.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-[0.65rem] text-text-muted">Ref: {error.digest}</p>
        ) : null}

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center rounded-xl bg-accent-violet px-5 py-2.5 text-sm font-semibold text-bg-primary transition hover:brightness-105 active:scale-[0.99]"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-xl border border-border-default bg-bg-card px-5 py-2.5 text-sm font-semibold text-text-secondary transition hover:bg-bg-elevated hover:text-text-primary"
          >
            Go to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
