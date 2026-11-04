"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listProducts, masterDataKeys, setSupplierStockBulk } from "@/features/master-data/api";
import type { ProductView, SupplierStockView, SupplierView } from "@/features/master-data/types";
import { MAX_IMPORT_LINES, parseStockTable } from "@/features/master-data/supplierUtils";
import { ApiError } from "@/services/api-client";
import { saveFile } from "@/lib/download";
import { formatMoney } from "@/lib/money";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

/** A preview can hold hundreds of rows; the table shows this many and says how many more there are. */
const SHOWN = 100;

/** The catalogue by SKU: a product's own SKU, or one of its variants'. A product with variants has no line of its own. */
function indexBySku(products: ProductView[]) {
  const bySku = new Map<string, { productId: string; variantId?: string; label: string } | { ambiguous: string }>();
  for (const product of products) {
    if (product.hasVariants) {
      bySku.set(product.sku.toUpperCase(), { ambiguous: product.name });
      for (const variant of product.variants) {
        if (variant.sku) {
          bySku.set(variant.sku.toUpperCase(), {
            productId: product.id,
            variantId: variant.id,
            label: `${product.name} (${variant.name})`,
          });
        }
      }
    } else {
      bySku.set(product.sku.toUpperCase(), { productId: product.id, label: product.name });
    }
  }
  return bySku;
}

/**
 * Sets many lines of a supplier's stock from a pasted table or a CSV file. Copy the rows from Excel (SKU, quantity,
 * rate) and paste them, or load a CSV. Every row is matched against the catalogue by SKU and shown against what is
 * held now. Nothing is saved until Import is pressed, and then all of it is saved or none: one unknown SKU means fix
 * it first. A rate left empty keeps the one already agreed.
 */
export function SupplierStockImportDialog({
  supplier,
  current,
  onClose,
}: {
  supplier: SupplierView;
  /** What the supplier is recorded as holding now, for the "was" column and the downloadable list. */
  current: SupplierStockView[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const products = useQuery({
    queryKey: masterDataKeys.products,
    queryFn: ({ signal }) => listProducts(signal),
  });

  const rows = useMemo(() => {
    const parsed = parseStockTable(text);
    const bySku = products.data ? indexBySku(products.data) : null;
    const heldNow = new Map(current.map((line) => [`${line.productId}:${line.variantId ?? ""}`, line]));
    const seen = new Map<string, number>();

    return parsed.map((row, index) => {
      let problem = row.problem;
      let target: { productId: string; variantId?: string; label: string } | null = null;

      if (!problem && index >= MAX_IMPORT_LINES) problem = `Only ${MAX_IMPORT_LINES} lines can be imported at once`;
      if (!problem && bySku) {
        const found = bySku.get(row.sku.toUpperCase());
        if (!found) problem = "No product or variant has this SKU";
        else if ("ambiguous" in found) problem = `${found.ambiguous} has variants. Use a variant's SKU`;
        else {
          target = found;
          const key = `${found.productId}:${found.variantId ?? ""}`;
          const first = seen.get(key);
          if (first !== undefined) problem = `Same item as row ${first}. Keep one line for each`;
          else seen.set(key, row.line);
        }
      }
      const was = target ? heldNow.get(`${target.productId}:${target.variantId ?? ""}`) : undefined;
      return { ...row, problem, target, was };
    });
  }, [text, products.data, current]);

  const bad = rows.filter((row) => row.problem).length;
  const ready = rows.length > 0 && bad === 0 && Boolean(products.data);

  const mutation = useMutation({
    mutationFn: () =>
      setSupplierStockBulk(
        supplier.id,
        rows.map((row) => ({
          productId: row.target!.productId,
          variantId: row.target!.variantId,
          quantity: row.quantity!,
          rate: row.rate ?? undefined,
        })),
        reason.trim() || "Imported list",
      ),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: masterDataKeys.suppliers });
      queryClient.invalidateQueries({ queryKey: masterDataKeys.products });
      toast.success(`${supplier.name}: ${saved.length} ${saved.length === 1 ? "line" : "lines"} updated`);
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not import the list."),
  });

  const downloadList = () => {
    const quote = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
    const lines = current.length
      ? current.map((line) => [line.sku ?? "", String(line.quantity), line.rate == null ? "" : String(line.rate)])
      : [["FUR-001", "20", "125.50"]];
    const csv = ["SKU,Quantity,Rate", ...lines.map((cells) => cells.map(quote).join(","))].join("\r\n");
    saveFile(new Blob([csv], { type: "text/csv" }), `${supplier.name.replace(/[^\w-]+/g, "-")}-stock.csv`);
  };

  return (
    <Dialog
      open
      onClose={mutation.isPending ? () => undefined : onClose}
      title={`Import stock for ${supplier.name}`}
      description="Paste rows copied from Excel, or load a CSV file. Columns: SKU, Quantity, Rate."
      className="max-w-3xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            disabled={!ready || mutation.isPending}
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
          >
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            {ready ? `Import ${rows.length} ${rows.length === 1 ? "line" : "lines"}` : "Import"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <Alert tone="error" title={error} /> : null}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="supplier-import-text" className="text-xs font-medium">
              Rows
            </label>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={downloadList}>
                <Download />
                {current.length ? "Download current list" : "Download example"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
                <FileUp />
                Load CSV file
              </Button>
            </div>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/plain"
            className="sr-only"
            tabIndex={-1}
            aria-label="Choose a CSV file"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              if (file.size > 1_000_000) {
                setError("That file is too large to be a price list. Keep it under 1 MB.");
                return;
              }
              setError(null);
              setText(await file.text());
            }}
          />
          <Textarea
            id="supplier-import-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={6}
            spellCheck={false}
            placeholder={"SKU\tQuantity\tRate\nFUR-001\t20\t125.50\nFUR-002\t0\t80"}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            The first row may name the columns (SKU, Quantity or Qty, Rate or Price) in any order. A variant is
            identified by its own SKU. A count of 0 means none right now. A rate left empty keeps the current one. Up
            to {MAX_IMPORT_LINES} lines.
          </p>
        </div>

        {products.isError ? (
          <Alert tone="error" title="Could not load the catalogue to match SKUs against. Close this and try again." />
        ) : null}

        {rows.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm" aria-live="polite">
              {bad === 0 ? (
                <span className="text-[var(--success)]">
                  {rows.length} {rows.length === 1 ? "line is" : "lines are"} ready to import.
                </span>
              ) : (
                <span className="text-destructive">
                  {bad} {bad === 1 ? "row needs" : "rows need"} fixing before anything can be imported.
                </span>
              )}
            </p>
            <div className="overflow-hidden rounded-md border border-border">
              <TableWrapper className="max-h-72 overflow-y-auto">
                <Table>
                  <THead>
                    <tr>
                      <TH>Row</TH>
                      <TH>Item</TH>
                      <TH className="text-right">Available</TH>
                      <TH className="text-right">Rate</TH>
                      <TH>Check</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {rows.slice(0, SHOWN).map((row) => (
                      <TR key={row.line}>
                        <TD className="tabular text-xs text-muted-foreground">{row.line}</TD>
                        <TD>
                          <span className="font-medium">{row.target?.label ?? (row.sku || "—")}</span>
                          {row.target ? <span className="block font-mono text-[0.7rem] text-muted-foreground">{row.sku}</span> : null}
                        </TD>
                        <TD className="tabular text-right">
                          {row.quantity ?? "—"}
                          {row.was && !row.problem ? (
                            <span className="block text-[0.7rem] text-muted-foreground">was {row.was.quantity}</span>
                          ) : null}
                        </TD>
                        <TD className="tabular text-right">
                          {row.rate == null ? (
                            <span className="text-muted-foreground">keep</span>
                          ) : (
                            formatMoney({ amount: row.rate, currency: "INR" })
                          )}
                          {row.was?.rate != null && !row.problem && row.rate != null ? (
                            <span className="block text-[0.7rem] text-muted-foreground">
                              was {formatMoney({ amount: row.was.rate, currency: "INR" })}
                            </span>
                          ) : null}
                        </TD>
                        <TD className="text-xs">
                          {row.problem ? (
                            <span className="text-destructive">{row.problem}</span>
                          ) : row.was ? (
                            <Badge variant="outline">Update</Badge>
                          ) : (
                            <Badge variant="success">New</Badge>
                          )}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableWrapper>
              {rows.length > SHOWN ? (
                <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                  And {rows.length - SHOWN} more rows. Every row is checked, but only the first {SHOWN} are listed.
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="supplier-import-reason" className="text-xs font-medium">
                Reason <span className="font-normal text-muted-foreground">(optional, kept in the history)</span>
              </label>
              <Input
                id="supplier-import-reason"
                value={reason}
                maxLength={200}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Imported list"
              />
            </div>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
