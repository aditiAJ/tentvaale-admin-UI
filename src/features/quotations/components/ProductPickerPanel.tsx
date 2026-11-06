"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ImageOff, Minus, Plus, Search, X } from "lucide-react";
import type { ProductView } from "@/features/master-data";
import { ratePerDayLabel, unitLabel } from "@/features/master-data/storefront";
import { choosableVariants } from "@/features/master-data/variants";
import { formatMoney, type Money } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { FadeImg } from "@/components/ui/fade-img";

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

// The variants on offer: the plain "Standard" only when it is the only one or holds stock of its own.
const activeVariants = (product: ProductView) => choosableVariants(product);

function Thumb({ src }: { src: string | null }) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted text-muted-foreground">
      {src && src !== failed ? (
        <FadeImg src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(src)} className="size-full object-cover" />
      ) : (
        <ImageOff className="size-5" aria-hidden="true" />
      )}
    </span>
  );
}

/**
 * A side panel to pick several catalogue products at once and add them to the quotation as lines: search, narrow by
 * category, tick the products, set each quantity (and variant, where a product has them), then add. It sits on the right
 * and leaves the quotation lines usable beside it. Mounted fresh each time it is opened, so nothing is left ticked.
 */
export function ProductPickerPanel({
  products,
  loading,
  onAdd,
  onClose,
  onQuotation,
  shownRate = (retail) => retail,
}: {
  products: readonly ProductView[];
  loading: boolean;
  onAdd: (chosen: ChosenProduct[]) => void;
  onClose: () => void;
  /** Ids of the products already on the quotation, so the list can say so. */
  onQuotation: ReadonlySet<string>;
  /** The rate to show for a retail and wholesale pair: for an event planner, the wholesale-based rate. Defaults to retail. */
  shownRate?: (retail: Money, wholesale: Money) => Money;
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const step = (productId: string, by: number) =>
    change(productId, { quantity: String(Math.max(1, (Number(picked[productId]?.quantity) || 0) + by)) });

  // Drawn on the page itself, not inside the quotation form it was opened from: its buttons and its search box would
  // otherwise count as part of that form, and pressing Add or Enter would save the quotation.
  return createPortal(
    <aside
      aria-label="Choose products"
      className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-card shadow-2xl sm:w-[26rem]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold">Choose products</h2>
          <p className="text-xs text-muted-foreground">Tick what to add and set how many. The quotation stays open beside this.</p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close panel">
          <X />
        </Button>
      </header>

      <div className="space-y-2 border-b border-border px-4 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, SKU or category"
            aria-label="Search products"
            className="pl-8"
            autoFocus
          />
        </div>
        <Select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading the catalogue…</p>
        ) : visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No product matches that.</p>
        ) : (
          <ul className="space-y-2">
            {visible.map((product) => {
              const choice = picked[product.id];
              const problem = tried ? problemOf(product) : null;
              const where = product.subCategoryName ?? product.categoryName;
              return (
                <li
                  key={product.id}
                  className={cn(
                    "rounded-lg border p-2.5 transition-colors",
                    choice ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={Boolean(choice)}
                      onChange={() => toggle(product)}
                      aria-label={`Choose ${product.name}`}
                      className="size-4 shrink-0 accent-[var(--primary)]"
                    />
                    {/* The chosen variant's own picture when it has one, otherwise the product's. */}
                    <Thumb src={product.variants.find((v) => v.id === choice?.variantId)?.imageUrl || pictureOf(product.media)} />
                    <button type="button" onClick={() => toggle(product)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm font-medium">{product.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {product.sku}
                        {where ? ` · ${where}` : ""}
                      </span>
                      <span className="block text-xs font-medium">
                        {formatMoney(shownRate(product.retailRate, product.wholesaleRate))} {ratePerDayLabel(product.rateType)}
                      </span>
                    </button>
                    {onQuotation.has(product.id) ? <Badge className="shrink-0">Added</Badge> : null}
                  </div>

                  {choice ? (
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-border/70 pt-2.5">
                      <div className="flex items-center gap-1" role="group" aria-label={`Quantity of ${product.name}`}>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-8"
                          onClick={() => step(product.id, -1)}
                          aria-label="One fewer"
                        >
                          <Minus />
                        </Button>
                        <Input
                          value={choice.quantity}
                          onChange={(event) => change(product.id, { quantity: event.target.value })}
                          inputMode="numeric"
                          aria-label={`Quantity of ${product.name}`}
                          aria-invalid={Boolean(problem)}
                          className="h-8 w-16 text-center"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-8"
                          onClick={() => step(product.id, 1)}
                          aria-label="One more"
                        >
                          <Plus />
                        </Button>
                        <span className="pl-1 text-xs text-muted-foreground">{unitLabel(product.rateType)}</span>
                      </div>
                      {product.hasVariants ? (
                        <Select
                          value={choice.variantId}
                          onChange={(event) => change(product.id, { variantId: event.target.value })}
                          aria-label={`Variant of ${product.name}`}
                          aria-invalid={Boolean(problem)}
                          className="h-8 min-w-0 flex-1 text-xs"
                        >
                          <option value="">Choose a variant</option>
                          {activeVariants(product).map((variant) => (
                            <option key={variant.id} value={variant.id}>
                              {variant.name} — {formatMoney(shownRate(variant.retailRate, variant.wholesaleRate))}
                            </option>
                          ))}
                        </Select>
                      ) : null}
                      {problem ? <span className="w-full text-xs text-destructive">{problem}</span> : null}
                    </div>
                  ) : null}
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

      <footer className="flex items-center gap-2 border-t border-border px-4 py-3">
        <span className="mr-auto text-xs text-muted-foreground">{count ? `${count} selected` : "Nothing selected yet"}</span>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={add} disabled={count === 0}>
          Add {count || ""} {count === 1 ? "product" : "products"}
        </Button>
      </footer>
    </aside>,
    document.body,
  );
}
