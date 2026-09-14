import { cn } from "@/lib/utils";

/**
 * Number formatting for display values. Counts get thousands separators in the
 * Indian grouping the business reads in; money goes through formatMoney.
 */
const count = new Intl.NumberFormat("en-IN");

export function formatCount(value: number): string {
  return count.format(value);
}

interface StatTileProps {
  label: string;
  value: string;
  hint?: string;
  className?: string;
}

/**
 * One headline number.
 *
 * Deliberately NOT using the `.tabular` class that table columns use: tabular
 * figures give every digit the width of a zero, which reads loose at display
 * sizes. Tabular is for columns that must align vertically, not for a standalone
 * value.
 */
export function StatTile({ label, value, hint, className }: StatTileProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-4", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

interface HeroFigureProps {
  label: string;
  value: string;
  hint?: string;
  className?: string;
}

/** The one number the view leads with. Exactly one per page. */
export function HeroFigure({ label, value, hint, className }: HeroFigureProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-5", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-5xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-2 text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
