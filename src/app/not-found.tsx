import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
      <div className="glass-card w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-elevated text-text-secondary">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
          </svg>
        </div>
        <div className="font-display text-2xl font-semibold tracking-[-0.04em] text-text-primary">
          Portflow
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-[-0.02em] text-text-primary">
          Page not found
        </h1>
        <p className="mt-3 text-sm leading-6 text-text-secondary">
          The page you&apos;re looking for has moved or never existed.
        </p>

        <Link
          href="/dashboard"
          className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-accent-violet px-5 py-3 text-sm font-semibold text-bg-primary transition hover:brightness-105 active:scale-[0.99]"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
