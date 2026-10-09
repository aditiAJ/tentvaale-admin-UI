"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown, KeyRound, LogOut, Menu, Moon, RotateCcw, Sun, UserRound } from "lucide-react";
import { useTheme } from "next-themes";
import { useSession } from "@/features/auth";
import { IS_MOCK } from "@/services/data-source";
import { resetMockData } from "@/mock-data/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChangePasswordDialog } from "@/features/users/components/ChangePasswordDialog";

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { session, signOut } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const [changingPassword, setChangingPassword] = useState(false);

  return (
    <header className="relative flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-3 sm:px-4">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenMenu}
        aria-label="Open navigation"
      >
        <Menu />
      </Button>

      <div className="flex items-center gap-2">
        {/* Only the tent: the file is the tent above the TENTVAALE lettering, so the box shows its top ~68% and the
            name is set as real text in the middle of the bar instead. */}
        <div className="h-10 w-[76px] shrink-0 overflow-hidden">
          <Image src="/logo-full.png" alt="Tentvaale" width={207} height={160} priority className="h-auto w-[76px] max-w-none" />
        </div>
        {IS_MOCK ? (
          // Stated plainly and permanently. Anyone reviewing this should never
          // have to wonder whether a number on screen is real.
          <Badge variant="warning" title="Seeded data stored in this browser. No backend is connected.">
            Demo data
          </Badge>
        ) : null}
      </div>

      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 hidden -translate-x-1/2 text-base font-semibold tracking-[0.3em] text-primary uppercase select-none sm:block"
      >
        Tentvaale
      </span>

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

        <AccountMenu
          canChangePassword={Boolean(session)}
          onChangePassword={() => setChangingPassword(true)}
          onSignOut={signOut}
        />
      </div>

      {changingPassword ? <ChangePasswordDialog onClose={() => setChangingPassword(false)} /> : null}
    </header>
  );
}

/**
 * One button, one menu. Hand-rolled because the admin has no dropdown primitive
 * and this is the only place that needs one. Follows the WAI-ARIA menu-button
 * pattern: arrows/Home/End move between items, Escape and outside clicks close,
 * and focus returns to the trigger.
 */
function AccountMenu({
  canChangePassword,
  onChangePassword,
  onSignOut,
}: {
  canChangePassword: boolean;
  onChangePassword: () => void;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "Tab") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  };

  const itemClass =
    "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-foreground outline-none transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div ref={rootRef} className="relative">
      <Button
        ref={triggerRef}
        variant="ghost"
        size="sm"
        className="gap-1 px-2"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <UserRound />
        <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>

      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 top-full z-50 mt-2 w-48 max-w-[calc(100vw-1.5rem)] rounded-lg border border-border bg-card p-1 shadow-lg"
        >
          {canChangePassword ? (
            <button
              type="button"
              role="menuitem"
              className={itemClass}
              onClick={() => {
                close(false);
                onChangePassword();
              }}
            >
              <KeyRound className="size-4 text-primary" />
              Change password
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => {
              close(false);
              onSignOut();
            }}
          >
            <LogOut className="size-4 text-primary" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
