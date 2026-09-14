"use client";

import { LogOut, Menu, Moon, RotateCcw, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSession } from "@/features/auth";
import { IS_MOCK } from "@/services/data-source";
import { resetMockData } from "@/mock-data/store";
import { formatRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { session, signOut } = useSession();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-3 sm:px-4">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenMenu}
        aria-label="Open navigation"
      >
        <Menu />
      </Button>

      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold tracking-tight">Tentvaale</span>
        <span className="text-xs text-muted-foreground">Back office</span>
        {IS_MOCK ? (
          // Stated plainly and permanently. Anyone reviewing this should never
          // have to wonder whether a number on screen is real.
          <Badge variant="warning" title="Seeded data stored in this browser. No backend is connected.">
            Demo data
          </Badge>
        ) : null}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {IS_MOCK ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Reset demo data"
            title="Reset demo data to its seeded state"
            onClick={() => {
              resetMockData();
              // A full reload is the bluntest way to be sure nothing cached in
              // React Query survives the reset, and this is a demo affordance,
              // not a hot path.
              window.location.reload();
            }}
          >
            <RotateCcw />
          </Button>
        ) : null}

        {session ? (
          <div className="hidden text-right sm:block">
            <p className="text-xs font-medium">{session.username}</p>
            <p
              className="text-[0.65rem] text-muted-foreground"
              title={`Session expires ${session.expiresAt.toLocaleString()}`}
            >
              Session ends {formatRelative(session.expiresAt)}
            </p>
          </div>
        ) : null}

        {session ? <Badge variant="outline">{session.role}</Badge> : null}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          {/* Which icon to show is decided by CSS off the `dark` class that
              next-themes writes before hydration, not by React state. A mounted
              flag would mean writing state from an effect on every load just to
              pick between two glyphs. */}
          <Moon className="dark:hidden" />
          <Sun className="hidden dark:block" />
        </Button>

        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
