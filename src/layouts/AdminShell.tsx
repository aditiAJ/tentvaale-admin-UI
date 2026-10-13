"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { Sidebar } from "@/layouts/Sidebar";
import { useSidebarCollapsed } from "@/layouts/useSidebarCollapsed";
import { Topbar } from "@/layouts/Topbar";
import { useSession } from "@/features/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Pages that fill the screen instead of sitting in the centred column: the product card grid with its filter panel. */
const FULL_WIDTH_PAGES = ["/master-data/products"];

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
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  const fullWidth = FULL_WIDTH_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`));

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
        {/* Pinned under the top bar and as tall as what is left of the screen: the page scrolls, the menu stays, and
            a long menu scrolls inside itself (Sidebar's nav is overflow-y-auto). */}
        <aside
          id="desktop-sidebar"
          data-collapsed={collapsed}
          className={cn(
            "sticky top-14 hidden h-[calc(100dvh-3.5rem)] z-20 shrink-0 self-start flex-col border-r border-border bg-card transition-[width] duration-200 motion-reduce:transition-none lg:flex",
            collapsed ? "w-14" : "w-60",
          )}
        >
          {/* A round handle on the sidebar's edge, like a drawer pull. */}
          <Button
            variant="outline"
            size="icon"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            aria-controls="desktop-sidebar"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="absolute top-4 -right-3.5 z-10 size-7 rounded-full border-primary bg-card text-primary shadow-sm hover:bg-primary/10"
          >
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          </Button>
          <div className="min-h-0 flex-1">
            <Sidebar collapsed={collapsed} />
          </div>
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

        {/* Most pages sit in a centred, padded column that reads well. Pages that are mostly a wide grid use the
            whole width instead (listed in FULL_WIDTH_PAGES). */}
        <main className={cn("min-w-0 flex-1", fullWidth ? "px-2 py-4 sm:px-3 sm:py-5" : "p-4 sm:p-6")}>
          <div className={fullWidth ? "w-full" : "mx-auto max-w-7xl"}>{children}</div>
        </main>
      </div>
    </div>
  );
}
