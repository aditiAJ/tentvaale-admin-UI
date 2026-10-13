"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { NAVIGATION } from "@/layouts/navigation";
import { useSession } from "@/features/auth";
import { cn } from "@/lib/utils";

/**
 * `collapsed` folds it to an icon rail (desktop only; the phone drawer never passes it). The labels stay in the
 * DOM as screen-reader text and as the hover tooltip, so a collapsed item still has its name.
 */
export function Sidebar({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) {
  const pathname = usePathname();
  const { session } = useSession();
  const permissions = session?.permissions ?? [];

  // A section with nothing the user may see is dropped entirely rather than
  // rendered as an empty heading.
  const sections = NAVIGATION.map((section) => ({
    ...section,
    items: section.items.filter((item) => permissions.includes(item.permission)),
  })).filter((section) => section.items.length > 0);

  // The rail's tooltip is drawn fixed-position from the hovered item's box: the menu scrolls, and a scrolling box
  // would clip an ordinary absolutely positioned tooltip.
  const [tip, setTip] = useState<{ text: string; top: number; left: number } | null>(null);
  const showTip = (text: string) => (event: React.SyntheticEvent<HTMLElement>) => {
    if (!collapsed) return;
    const box = event.currentTarget.getBoundingClientRect();
    setTip({ text, top: box.top + box.height / 2, left: box.right + 10 });
  };
  const hideTip = () => setTip(null);
  const tipHandlers = (text: string) => ({
    onMouseEnter: showTip(text),
    onFocus: showTip(text),
    onMouseLeave: hideTip,
    onBlur: hideTip,
  });

  const itemClass = cn("relative flex items-center gap-2 rounded-md py-1.5 text-sm", collapsed ? "justify-center px-0" : "px-2");

  return (
    // The scrollbar is hidden (it is noise beside the icons); the menu still scrolls by wheel, touch and keyboard.
    <nav
      aria-label="Back office"
      onScroll={hideTip}
      className={cn(
        "flex h-full flex-col gap-5 overflow-x-hidden overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        collapsed ? "p-2" : "p-3",
      )}
    >
      {sections.map((section) => (
        <div key={section.label} className="space-y-1">
          {collapsed ? (
            // The heading becomes a thin rule; its text stays for screen readers.
            <>
              <p className="sr-only">{section.label}</p>
              <div aria-hidden="true" className="mx-2 border-t border-border" />
            </>
          ) : (
            <p className="px-2 text-[0.65rem] font-semibold tracking-wider text-muted-foreground uppercase">
              {section.label}
            </p>
          )}

          {section.items.map((item) => {
            const Icon = item.icon;
            const label = <span className={collapsed ? "sr-only" : "truncate"}>{item.label}</span>;

            if (item.status === "planned" || !item.href) {
              return (
                <div
                  key={item.label}
                  title={collapsed ? undefined : item.note}
                  aria-disabled="true"
                  {...(collapsed ? tipHandlers(item.note ? `${item.label}: ${item.note}` : item.label) : {})}
                  className={cn(itemClass, "cursor-not-allowed text-muted-foreground/60")}
                >
                  <Icon className="size-4 shrink-0" />
                  {label}
                  <Lock
                    className={cn("size-3 shrink-0", collapsed ? "sr-only" : "ml-auto")}
                    aria-label="Not available yet"
                  />
                </div>
              );
            }

            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                {...(collapsed ? tipHandlers(item.label) : {})}
                className={cn(
                  itemClass,
                  "transition-colors",
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-foreground hover:bg-muted",
                )}
              >
                {active ? <span aria-hidden="true" className="absolute inset-y-1 -left-1 w-0.5 rounded-full bg-primary" /> : null}
                <Icon className="size-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </div>
      ))}

      {collapsed && tip ? (
        <span
          role="presentation"
          style={{ top: tip.top, left: tip.left }}
          className="pointer-events-none fixed z-50 -translate-y-1/2 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium whitespace-nowrap text-foreground shadow-md"
        >
          {tip.text}
        </span>
      ) : null}
    </nav>
  );
}
