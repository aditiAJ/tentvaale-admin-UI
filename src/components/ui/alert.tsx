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
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cn("flex gap-2.5 rounded-md border p-3 text-sm", tones[tone], className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 space-y-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className="text-xs text-muted-foreground">{children}</div> : null}
      </div>
    </div>
  );
}
