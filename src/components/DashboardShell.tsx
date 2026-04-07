"use client";

import { type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";

const navItems = [
  { label: "Portfolio", href: "/dashboard" },
  { label: "Settings", href: "/dashboard/settings" },
];

export default function DashboardShell({
  children,
  user,
}: {
  children: ReactNode;
  user: User;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const userInitial = user.email?.[0]?.toUpperCase() || "U";

  return (
    <div className="min-h-screen bg-transparent">
      <header className="sticky top-0 z-40 bg-[#fffaf8]/80 px-4 py-4 backdrop-blur sm:px-6 lg:px-10">
        <div className="mx-auto max-w-[1180px]">
          <div className="flex items-center gap-2 overflow-x-auto rounded-[1.7rem] border border-black/8 bg-white px-3 py-2.5 shadow-[0_10px_30px_rgba(150,80,66,0.08)] [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-3 sm:px-4 sm:py-3 [&::-webkit-scrollbar]:hidden">
            <a href="/dashboard" className="shrink-0 text-xl font-extrabold tracking-tight text-accent-violet sm:text-2xl">
              asset<span className="text-text-primary">viz</span>
            </a>

            <nav className="ml-1 flex items-center gap-1 sm:ml-2 sm:gap-2">
              {navItems.map((item) => {
                const active = pathname === item.href;

                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold transition sm:px-4 sm:py-2 ${
                      active
                        ? "bg-[#fff1ef] text-accent-violet"
                        : "text-text-primary hover:bg-[#faf3f1]"
                    }`}
                  >
                    {item.label}
                  </a>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/8 bg-[#fff1ef] text-xs font-semibold text-accent-violet sm:h-9 sm:w-9">
                {userInitial}
              </div>

              <button
                onClick={handleSignOut}
                className="shrink-0 rounded-full border-2 border-[#22242a] bg-white px-3.5 py-1.5 text-sm font-semibold text-[#22242a] transition hover:bg-[#faf3f1] sm:px-5 sm:py-2"
              >
                <span className="sm:hidden">Out</span>
                <span className="hidden sm:inline">Sign Out</span>
              </button>

              <div className="hidden items-center gap-2 rounded-full border border-black/8 bg-white px-3 py-2 lg:flex">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#fff1ef] text-xs font-semibold text-accent-violet">
                  {userInitial}
                </div>
                <span className="text-sm font-medium text-text-secondary">Account</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="min-w-0">
        <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-10 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
