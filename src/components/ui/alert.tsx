"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const icons = {
  info: Info,
  warning: AlertTriangle,
  error: TriangleAlert,
} as const;

const tones = {
  info: "border-border bg-muted text-foreground",
  warning:
    "border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] text-foreground",
  error:
    "border-[color-mix(in_srgb,var(--destructive)_30%,transparent)] bg-[color-mix(in_srgb,var(--destructive)_8%,transparent)] text-foreground",
} as const;

interface AlertProps {
  tone?: keyof typeof icons;
  title?: string;
  className?: string;
  children?: React.ReactNode;
}

export function Alert({ tone = "info", title, className, children }: AlertProps) {
  const Icon = icons[tone];
  const ref = useRef<HTMLDivElement>(null);
  // An error that appears off-screen (a long form, the bottom of a wizard step) is an error nobody
  // sees, so it brings itself into view when it mounts or its text changes.
  const text = typeof title === "string" ? title : "";
  useEffect(() => {
    if (tone === "error") ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [tone, text]);
  return (
    <div
      ref={ref}
      role={tone === "error" ? "alert" : undefined}
      className={cn("flex gap-2.5 rounded-md border p-3 text-sm", tones[tone], className)}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", tone === "error" ? "text-destructive" : "text-muted-foreground")} />
      <div className="min-w-0 space-y-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={cn("text-xs", tone === "error" ? "text-foreground/80" : "text-muted-foreground")}>{children}</div> : null}
      </div>
    </div>
  );
}
