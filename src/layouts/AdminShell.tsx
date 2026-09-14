"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { Sidebar } from "@/layouts/Sidebar";
import { Topbar } from "@/layouts/Topbar";
import { useSession } from "@/features/auth";
import { Button } from "@/components/ui/button";

/**
 * The guarded shell every back-office page renders inside.
 *
 * The guard is client-side because the JWT lives in localStorage, which no
 * server component can read. That is a UX gate, not a security boundary: the
 * data behind it is protected by the backend checking the token on every
 * request, so the worst a bypass achieves is an empty screen full of 401s.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (loading || session) return;
    // Carry the attempted path so signing in returns the user to it rather
    // than dropping them on the default landing page.
    const next = encodeURIComponent(pathname);
    router.replace(`/login?next=${next}`);
  }, [loading, session, pathname, router]);

  if (loading || !session) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <span className="sr-only">Checking your session</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Topbar onOpenMenu={() => setMenuOpen(true)} />

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-60 shrink-0 border-r border-border bg-card lg:block">
          <Sidebar />
        </aside>

        {menuOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
            <div className="absolute inset-y-0 left-0 w-64 border-r border-border bg-card">
              <div className="flex h-14 items-center justify-between border-b border-border px-3">
                <span className="text-sm font-semibold">Menu</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close navigation"
                >
                  <X />
                </Button>
              </div>
              <Sidebar onNavigate={() => setMenuOpen(false)} />
            </div>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
