"use client";

import { Check, Pencil } from "lucide-react";
import type { BundleView, MediaAsset } from "@/features/master-data/types";
import { MediaThumb } from "@/features/master-data/components/MediaThumb";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

/**
 * Everything about one bundle in a dialog: its facts, description and highlights, the occasions it is styled for,
 * and every product inside it with quantity and the swaps a customer may choose. The card shows only a taste.
 */
export function BundleDetailsDialog({
  bundle,
  productMedia,
  onClose,
  onEdit,
}: {
  bundle: BundleView;
  productMedia: Map<string, MediaAsset[] | undefined>;
  onClose: () => void;
  /** Present only for someone who may edit; opens the bundle's edit dialog. */
  onEdit?: () => void;
}) {
  const pieces = bundle.components.reduce((sum, component) => sum + component.quantity, 0);
  const discounted = (bundle.discountPercent ?? 0) > 0 && bundle.discountedPrice;

  return (
    <Dialog
      open
      onClose={onClose}
      title={bundle.name}
      description={bundle.tagline ?? undefined}
      className="max-w-xl"
      footer={
        <>
          {onEdit ? (
            <Button variant="outline" onClick={onEdit}>
              <Pencil />
              Edit bundle
            </Button>
          ) : null}
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      <div className="max-h-[65vh] space-y-5 overflow-y-auto pr-1">
        <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg bg-muted/50 p-3">
          <div>
            <p className="text-xs text-muted-foreground">Price (from, per event)</p>
            <p className="text-xl font-semibold text-primary tabular">{formatMoney(bundle.rentalRate)}</p>
          </div>
          {discounted ? (
            <div className="text-right text-xs">
              <Badge variant="outline">{bundle.discountPercent}% off</Badge>
              <p className="mt-1 text-muted-foreground tabular">
                One-day sum after discount {formatMoney(bundle.discountedPrice)}
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {bundle.guests ? <span className="rounded-md bg-muted px-2 py-1">{bundle.guests} guests</span> : null}
          {bundle.setupTime ? <span className="rounded-md bg-muted px-2 py-1">{bundle.setupTime} setup</span> : null}
          <span className="rounded-md bg-muted px-2 py-1">
            {bundle.components.length} product{bundle.components.length === 1 ? "" : "s"} · {pieces} piece
            {pieces === 1 ? "" : "s"}
          </span>
          {bundle.active === false ? <Badge>Inactive</Badge> : null}
        </div>

        {bundle.description ? <p className="text-sm text-muted-foreground">{bundle.description}</p> : null}

        {bundle.highlights.length > 0 ? (
          <section aria-label="Highlights">
            <h3 className="mb-1.5 text-[0.7rem] font-semibold tracking-wide text-primary uppercase">Highlights</h3>
            <ul className="space-y-1 text-sm">
              {bundle.highlights.map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {bundle.occasions.length > 0 ? (
          <section aria-label="Occasions">
            <h3 className="mb-1.5 text-[0.7rem] font-semibold tracking-wide text-primary uppercase">Occasions</h3>
            <div className="flex flex-wrap gap-1.5">
              {bundle.occasions.map((occasion) => (
                <Badge
                  key={occasion.id}
                  className={occasion.active ? undefined : "opacity-60"}
                  title={occasion.active ? undefined : "Hidden on the storefront"}
                >
                  {occasion.name}
                </Badge>
              ))}
            </div>
          </section>
        ) : null}

        <section aria-label="What's inside">
          <h3 className="mb-1.5 text-[0.7rem] font-semibold tracking-wide text-primary uppercase">What&apos;s inside</h3>
          {bundle.components.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-sm text-muted-foreground">
              No products in this bundle yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {bundle.components.map((component) => (
                <li
                  key={`${component.productId}:${component.variantId ?? ""}`}
                  className={`flex items-start gap-3 rounded-lg border border-border bg-background p-2.5 ${component.active ? "" : "opacity-60"}`}
                >
                  <MediaThumb media={productMedia.get(component.productId)} className="size-12 rounded-md" />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                      {component.productName}
                      {component.variantName ? (
                        <span className="font-normal text-muted-foreground">({component.variantName})</span>
                      ) : null}
                      {component.active ? null : <Badge>Inactive product</Badge>}
                    </p>
                    <p className="font-mono text-[0.7rem] text-muted-foreground">{component.sku}</p>
                    {component.swapOptions && component.swapOptions.length > 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Customer can choose instead:{" "}
                        {component.swapOptions
                          .map((swap) => swap.productName + (swap.variantName ? ` (${swap.variantName})` : ""))
                          .join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-semibold tabular">
                    × {component.quantity}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Dialog>
  );
}
