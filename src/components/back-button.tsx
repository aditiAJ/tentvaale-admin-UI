"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { canGoBackInApp, isPlainClick, safeInternalPath, type NavigationLike } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/**
 * Takes the user back to the screen they came from (with its filter, tab and open record, which all live in the
 * address), or to `fallback` when there is no screen of ours behind this one: a bookmark, a new tab, a link pasted
 * from elsewhere. It never goes back to another site.
 *
 * It is a real link to `fallback`, so a middle click or "open in new tab" opens the fallback, and it works before
 * the page's scripts have loaded. Only a plain click with one of our screens behind it goes back in history.
 *
 * `guard`, when given, is asked before leaving (a form with unsaved changes): it gets the leave step and calls it once
 * the user has confirmed. A new tab leaves nothing behind, so it is not asked then.
 */
export function BackButton({
  fallback,
  label = "Back",
  className,
  guard,
}: {
  fallback: string;
  label?: string;
  className?: string;
  guard?: (leave: () => void) => void;
}) {
  const router = useRouter();
  const href = safeInternalPath(fallback) ?? "/";
  return (
    <Link
      href={href}
      onClick={(event) => {
        if (!isPlainClick(event)) return;
        const back = canGoBackInApp((window as Window & { navigation?: NavigationLike }).navigation);
        if (!back && !guard) return;
        event.preventDefault();
        const leave = () => (back ? router.back() : router.push(href));
        if (guard) guard(leave);
        else leave();
      }}
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-sm text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
        className,
      )}
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {label}
    </Link>
  );
}
