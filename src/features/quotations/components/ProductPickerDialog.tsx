"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { ImageOff, Search } from "lucide-react";
import type { ProductView } from "@/features/master-data";
import { ratePerDayLabel, unitLabel } from "@/features/master-data/storefront";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";

/** One product picked in the dialog, ready to become a quotation line. */
export interface ChosenProduct {
  productId: string;
  /** Set for a product with variants; absent for one without. */
  variantId?: string;
  quantity: number;
}

/** A product's first image, as its small thumbnail where it has one; null when it has no picture. */
export function pictureOf(media: { kind: string; url: string | null; thumbnailUrl?: string | null }[] | undefined) {
  const image = media?.find((item) => item.kind === "IMAGE" && (item.thumbnailUrl || item.url));
  return image ? (image.thumbnailUrl ?? image.url) : null;
}

/** The most rows drawn at once, so a catalogue of tens of thousands stays quick; typing narrows it. */
const LIMIT = 80;

const activeVariants = (product: ProductView) => product.variants.filter((variant) => variant.active !== false);

function Thumb({ src }: { src: string | null }) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted text-muted-foreground">
      {src && src !== failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- a storage address, which next/image has nothing to optimise
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(src)} className="size-full object-cover" />
      ) : (
        <ImageOff className="size-5" aria-hidden="true" />
      )}
    </span>
  );
}

/**
 * Pick several catalogue products at once and add them to the quotation as lines: search, narrow by category, tick the
 * products, set each quantity (and variant, where a product has them), then add. Mounted fresh each time it is opened, so
 * nothing is left ticked from last time.
 */
export function ProductPickerDialog({
  products,
  loading,
  onAdd,
  onClose,
  onQuotation,
}: {
  products: readonly ProductView[];
  loading: boolean;
  onAdd: (chosen: ChosenProduct[]) => void;
  onClose: () => void;
  /** Ids of the products already on the quotation, so the list can say so. */
  onQuotation: ReadonlySet<string>;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [picked, setPicked] = useState<Record<string, { quantity: string; variantId: string }>>({});
  const [tried, setTried] = useState(false);

  const categories = [...new Set(products.map((product) => product.categoryName).filter((name): name is string => Boolean(name)))].sort();
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = products.filter(
    (product) =>
      product.active !== false &&
      (!category || product.categoryName === category) &&
      words.every((word) =>
        `${product.name} ${product.sku} ${product.genericName ?? ""} ${product.categoryName ?? ""} ${product.subCategoryName ?? ""}`
          .toLowerCase()
          .includes(word),
      ),
  );
  const visible = matches.slice(0, LIMIT);
  const count = Object.keys(picked).length;

  const toggle = (product: ProductView) =>
    setPicked((previous) => {
      const next = { ...previous };
      if (next[product.id]) {
        delete next[product.id];
      } else {
        // A product with a single variant has nothing to choose, so it starts with that one.
        const only = product.hasVariants && activeVariants(product).length === 1 ? activeVariants(product)[0].id : "";
        next[product.id] = { quantity: "1", variantId: only };
      }
      return next;
    });

  const change = (productId: string, patch: Partial<{ quantity: string; variantId: string }>) =>
    setPicked((previous) => ({ ...previous, [productId]: { ...previous[productId], ...patch } }));

  const problemOf = (product: ProductView): string | null => {
    const choice = picked[product.id];
    if (!choice) return null;
    if (!/^\d+$/.test(choice.quantity) || Number(choice.quantity) < 1 || Number(choice.quantity) > 100000) {
      return "Enter a quantity of 1 or more";
    }
    if (product.hasVariants && !choice.variantId) return "Choose a variant";
    return null;
  };

  const add = () => {
    const byId = new Map(products.map((product) => [product.id, product]));
    const chosen: ChosenProduct[] = [];
    for (const [productId, choice] of Object.entries(picked)) {
      const product = byId.get(productId);
      if (!product) continue;
      if (problemOf(product)) {
        setTried(true);
        return;
      }
      chosen.push({
        productId,
        variantId: product.hasVariants ? choice.variantId : undefined,
        quantity: Number(choice.quantity),
      });
    }
    onAdd(chosen);
    onClose();
  };

  // Drawn on the page itself, not inside the quotation form it was opened from: its buttons and its search box would
  // otherwise count as part of that form, and pressing Add or Enter would save the quotation.
  return createPortal(
    <Dialog
      open
      onClose={onClose}
      title="Choose products"
      description="Tick the products to add, set how many of each, then add them all to the quotation."
      className="max-w-3xl"
      footer={
        <>
          <span className="mr-auto self-center text-xs text-muted-foreground">
            {count ? `${count} selected` : "Nothing selected yet"}
          </span>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={add} disabled={count === 0}>
            Add {count || ""} {count === 1 ? "product" : "products"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, SKU or category"
              aria-label="Search products"
              className="pl-8"
            />
          </div>
          <Select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="Category"
            className="w-auto min-w-40"
          >
            <option value="">All categories</option>
            {categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </div>

        <div className="max-h-[52vh] overflow-y-auto pr-1">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading the catalogue…</p>
          ) : visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No product matches that.</p>
          ) : (
            <ul className="space-y-1.5">
              {visible.map((product) => {
                const choice = picked[product.id];
                const problem = tried ? problemOf(product) : null;
                return (
                  <li
                    key={product.id}
                    className={cn(
                      "flex items-start gap-3 rounded-md border p-2.5 transition-colors",
                      choice ? "border-primary bg-primary/5" : "border-border",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(choice)}
                      onChange={() => toggle(product)}
                      aria-label={`Choose ${product.name}`}
                      className="mt-4 size-4 shrink-0 accent-[var(--primary)]"
                    />
                    <Thumb src={pictureOf(product.media)} />
                    <div className="min-w-0 flex-1">
                      <button type="button" onClick={() => toggle(product)} className="block w-full text-left">
                        <span className="font-medium">{product.name}</span>
                        {onQuotation.has(product.id) ? <Badge className="ml-2 align-middle">On this quotation</Badge> : null}
                        <span className="block text-xs text-muted-foreground">
                          {product.sku}
                          {product.categoryName ? ` · ${product.categoryName}` : ""}
                          {product.subCategoryName ? ` › ${product.subCategoryName}` : ""}
                        </span>
                        <span className="block text-xs">
                          {formatMoney(product.retailRate)} {ratePerDayLabel(product.rateType)}
                        </span>
                      </button>

                      {choice ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            Qty
                            <Input
                              value={choice.quantity}
                              onChange={(event) => change(product.id, { quantity: event.target.value })}
                              inputMode="numeric"
                              aria-label={`Quantity of ${product.name}`}
                              aria-invalid={Boolean(problem)}
                              className="h-8 w-20 text-right"
                            />
                            {unitLabel(product.rateType)}
                          </label>
                          {product.hasVariants ? (
                            <Select
                              value={choice.variantId}
                              onChange={(event) => change(product.id, { variantId: event.target.value })}
                              aria-label={`Variant of ${product.name}`}
                              aria-invalid={Boolean(problem)}
                              className="h-8 w-auto min-w-44 text-xs"
                            >
                              <option value="">Choose a variant</option>
                              {activeVariants(product).map((variant) => (
                                <option key={variant.id} value={variant.id}>
                                  {variant.name} — {formatMoney(variant.retailRate)}
                                </option>
                              ))}
                            </Select>
                          ) : null}
                          {problem ? <span className="text-xs text-destructive">{problem}</span> : null}
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {matches.length > visible.length ? (
            <p className="pt-2 text-center text-xs text-muted-foreground">
              Showing the first {LIMIT} of {matches.length}. Type to narrow the list.
            </p>
          ) : null}
        </div>
      </div>
    </Dialog>,
    document.body,
  );
}
