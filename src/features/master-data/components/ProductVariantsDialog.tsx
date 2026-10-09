"use client";

import { Pencil } from "lucide-react";
import type { ProductVariantView, ProductView } from "@/features/master-data/types";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

/** The variants a customer can choose between: a lone untouched default is just the product itself. */
function realVariants(product: ProductView) {
  return product.variants.filter((variant) => !(variant.isDefault && !variant.hasAttributes));
}

/** What a variant differs by (Colour, Size ...), from the product's axes. */
function variantType(product: ProductView, attributeFacetIds: string[] | undefined) {
  return (attributeFacetIds ?? [])
    .map((id) => product.axes?.find((axis) => axis.facetId === id)?.label)
    .filter(Boolean)
    .join(" / ");
}

function StockPill({ stock }: { stock: number }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium tabular ${
        stock > 0 ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
      }`}
    >
      <span className={`size-1.5 rounded-full ${stock > 0 ? "bg-success" : "bg-muted-foreground/50"}`} />
      {stock > 0 ? `${stock} in stock` : "No stock"}
    </span>
  );
}

function Row({
  name,
  sku,
  stock,
  wholesale,
  retail,
  off,
}: {
  name: string;
  sku?: string;
  stock: number;
  wholesale: ProductVariantView["wholesaleRate"];
  retail: ProductVariantView["retailRate"];
  off?: boolean;
}) {
  return (
    <li className={`rounded-lg border border-border bg-background px-3 py-2.5 ${off ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <span className="truncate">{name}</span>
            {off ? <Badge>Off</Badge> : null}
          </p>
          {sku ? <p className="font-mono text-[0.7rem] text-muted-foreground">{sku}</p> : null}
        </div>
        <StockPill stock={stock} />
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Retail</dt>
          <dd className="font-semibold text-primary tabular">{formatMoney(retail)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Wholesale</dt>
          <dd className="font-medium tabular">{formatMoney(wholesale)}</dd>
        </div>
      </dl>
    </li>
  );
}

/**
 * A product's variants in a dialog: a summary up top, then the variants grouped by what they differ by (same type
 * together, in the order types first appear), each with its SKU, stock and both rates.
 */
export function ProductVariantsDialog({
  product,
  onClose,
  onEdit,
}: {
  product: ProductView;
  onClose: () => void;
  /** Present only for someone who may edit; opens the product's edit dialog. */
  onEdit?: () => void;
}) {
  const list = realVariants(product);
  const typeOf = (variant: ProductVariantView) => variantType(product, variant.attributeFacetIds) || "Other";
  const types = [...new Set(list.map(typeOf))];
  // The product's own pieces (its default variant) sit beside the variants, counted in the product's total.
  const base = product.variants.find((variant) => variant.isDefault && !variant.hasAttributes);
  const totalStock = product.variants.reduce((sum, variant) => sum + variant.stock, 0);

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${product.name} · variants`}
      description={`${product.sku}${product.categoryName ? ` · ${product.categoryName}` : ""}`}
      className="max-w-xl"
      footer={
        <>
          {onEdit ? (
            <Button variant="outline" onClick={onEdit}>
              <Pencil />
              Edit product
            </Button>
          ) : null}
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-md bg-muted px-2 py-1">
            <span className="font-semibold tabular">{list.length}</span> variant{list.length === 1 ? "" : "s"}
          </span>
          <span className="rounded-md bg-muted px-2 py-1">
            <span className="font-semibold tabular">{totalStock}</span> in stock in total
          </span>
        </div>

        {list.length === 0 && !(base && base.stock > 0) ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            No variants yet.{onEdit ? " Add them from Edit product." : ""}
          </p>
        ) : (
          <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
            {base && base.stock > 0 ? (
              <section aria-label="Main">
                <h3 className="mb-1.5 text-[0.7rem] font-semibold tracking-wide text-primary uppercase">Main</h3>
                <ul className="space-y-2">
                  <Row
                    name={`${product.name} (the product itself)`}
                    stock={base.stock}
                    wholesale={product.wholesaleRate}
                    retail={product.retailRate}
                  />
                </ul>
              </section>
            ) : null}
            {types.map((type) => (
              <section key={type} aria-label={type}>
                <h3 className="mb-1.5 text-[0.7rem] font-semibold tracking-wide text-primary uppercase">{type}</h3>
                <ul className="space-y-2">
                  {list
                    .filter((variant) => typeOf(variant) === type)
                    .map((variant) => (
                      <Row
                        key={variant.id}
                        name={variant.name}
                        sku={variant.sku}
                        stock={variant.stock}
                        wholesale={variant.wholesaleRate}
                        retail={variant.retailRate}
                        off={variant.active === false}
                      />
                    ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
