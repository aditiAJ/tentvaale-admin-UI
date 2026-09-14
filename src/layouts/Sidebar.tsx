"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { NAVIGATION } from "@/layouts/navigation";
import { useSession } from "@/features/auth";
import { cn } from "@/lib/utils";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { session } = useSession();
  const permissions = session?.permissions ?? [];

  // A section with nothing the user may see is dropped entirely rather than
  // rendered as an empty heading.
  const sections = NAVIGATION.map((section) => ({
    ...section,
    items: section.items.filter((item) => permissions.includes(item.permission)),
  })).filter((section) => section.items.length > 0);

  return (
    <nav aria-label="Back office" className="flex h-full flex-col gap-5 overflow-y-auto p-3">
      {sections.map((section) => (
        <div key={section.label} className="space-y-1">
          <p className="px-2 text-[0.65rem] font-semibold tracking-wider text-muted-foreground uppercase">
            {section.label}
          </p>

          {section.items.map((item) => {
            const Icon = item.icon;

            if (item.status === "planned" || !item.href) {
              return (
                <div
                  key={item.label}
                  title={item.note}
                  aria-disabled="true"
                  className="flex cursor-not-allowed items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground/60"
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  <Lock className="ml-auto size-3 shrink-0" aria-label="Not available yet" />
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
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-foreground hover:bg-muted",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
