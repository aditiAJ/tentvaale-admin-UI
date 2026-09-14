"use client";

import { useState } from "react";
import { formatCount } from "@/components/ui/stat";
import { cn } from "@/lib/utils";

export interface PipelineStage {
  label: string;
  count: number;
  /** CSS variable carrying this stage's step of the ordinal ramp. */
  color: string;
  description: string;
}

/**
 * Quotation pipeline as one part-to-whole bar.
 *
 * The four stat tiles beside it already give the counts; what a bar adds, and
 * they cannot, is the *shape* — whether work is piling up in draft or moving
 * through to converted. That is the only reason it is here.
 *
 * Colour is a single blue hue stepped light→dark because the stages are
 * ordinal, not four separate identities. Every stage is also named in the
 * legend with its count, so nothing is carried by colour alone.
 */
export function QuotationPipeline({ stages }: { stages: PipelineStage[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = stages.reduce((sum, stage) => sum + stage.count, 0);

  if (total === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No quotations in any of these stages yet.
      </p>
    );
  }

  const share = (value: number) => `${Math.round((value / total) * 100)}%`;

  return (
    <div className="space-y-4">
      {/* gap-0.5 is the 2px surface gap that keeps adjacent fills from reading
          as one continuous block. */}
      <div className="relative flex h-8 w-full gap-0.5 overflow-hidden rounded">
        {stages.map((stage, index) =>
          stage.count === 0 ? null : (
            <div
              key={stage.label}
              className="relative h-full transition-opacity"
              style={{
                width: `${(stage.count / total) * 100}%`,
                backgroundColor: `var(${stage.color})`,
                opacity: hovered === null || hovered === index ? 1 : 0.55,
              }}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              role="presentation"
            />
          ),
        )}
      </div>

      {hovered !== null ? (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          <span className="font-medium text-foreground">{stages[hovered].label}</span>{" "}
          — {formatCount(stages[hovered].count)} ({share(stages[hovered].count)}).{" "}
          {stages[hovered].description}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {formatCount(total)} quotations across these four stages.
        </p>
      )}

      {/* The legend doubles as the table view: every stage is named, counted and
          shared, so the chart is never the only way to read the numbers. Each
          stage is its own block rather than a wide row, so the count stays
          beside the label it belongs to instead of drifting to a far margin. */}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stages.map((stage, index) => (
          <li
            key={stage.label}
            className={cn(
              "min-w-0 border-l-2 pl-2.5 transition-opacity",
              hovered !== null && hovered !== index ? "opacity-55" : undefined,
            )}
            style={{ borderColor: `var(${stage.color})` }}
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered(null)}
          >
            <p className="truncate text-xs text-muted-foreground">{stage.label}</p>
            <p className="mt-0.5 flex items-baseline gap-1.5">
              <span className="text-lg font-semibold">{formatCount(stage.count)}</span>
              <span className="text-xs text-muted-foreground">{share(stage.count)}</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
