"use client";

import { useState } from "react";
import { ChevronDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportProducts } from "@/features/master-data/api";
import type { CategoryView } from "@/features/master-data/types";
import { ApiError } from "@/services/api-client";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/input";

/** "Export what I see" sends the product ids in the address; a few hundred fit, thousands would not. */
const MAX_SHOWN = 800;

type Scope = "all" | "shown" | "category";

function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Excel export of the catalogue. Pressing **Export** downloads every product at once; the arrow beside it opens the
 * options: what the list shows now, or one category (and sub-category), with or without inactive products.
 */
export function ProductExportButton({
  shownIds,
  categories,
}: {
  /** The products the list shows right now, after its filters. */
  shownIds: string[];
  categories: CategoryView[];
}) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>("all");
  const [categoryId, setCategoryId] = useState("");
  const [subCategoryId, setSubCategoryId] = useState("");
  const [includeInactive, setIncludeInactive] = useState(true);

  const category = categories.find((c) => c.id === categoryId);
  const canShowShown = shownIds.length > 0 && shownIds.length <= MAX_SHOWN;

  async function run(request: Parameters<typeof exportProducts>[0]) {
    setBusy(true);
    try {
      const { blob, filename } = await exportProducts(request);
      saveFile(blob, filename);
      toast.success("Excel file downloaded", { description: filename });
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not make the Excel file. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (scope === "shown") return run({ ids: shownIds, includeInactive: true });
    if (scope === "category") {
      return run({ categoryId, subCategoryId: subCategoryId || undefined, includeInactive });
    }
    return run({ includeInactive });
  }

  return (
    <>
      <div className="inline-flex">
        <Button
          variant="outline"
          className="rounded-r-none"
          disabled={busy}
          onClick={() => run({ includeInactive: true })}
          title="Download every product as an Excel file"
        >
          {busy ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
          Export
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="-ml-px rounded-l-none"
          disabled={busy}
          onClick={() => setOpen(true)}
          aria-label="Export options"
        >
          <ChevronDown />
        </Button>
      </div>

      <Dialog
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Export products to Excel"
        description="One file with two sheets: Products and Variants."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={download} disabled={busy || (scope === "category" && !categoryId)}>
              {busy ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
              Download Excel
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="sr-only">What to export</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="export-scope" checked={scope === "all"} onChange={() => setScope("all")} className="accent-[var(--primary)]" />
              All products
            </label>
            <label className={`flex items-center gap-2 text-sm ${canShowShown ? "" : "text-muted-foreground"}`}>
              <input
                type="radio"
                name="export-scope"
                checked={scope === "shown"}
                onChange={() => setScope("shown")}
                disabled={!canShowShown}
                className="accent-[var(--primary)]"
              />
              What the list shows now ({shownIds.length} {shownIds.length === 1 ? "product" : "products"})
              {shownIds.length > MAX_SHOWN ? " · too many, use a category" : ""}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="export-scope" checked={scope === "category"} onChange={() => setScope("category")} className="accent-[var(--primary)]" />
              One category
            </label>
          </fieldset>

          {scope === "category" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Category" required>
                {(props) => (
                  <Select
                    {...props}
                    value={categoryId}
                    onChange={(event) => {
                      setCategoryId(event.target.value);
                      setSubCategoryId("");
                    }}
                  >
                    <option value="">Choose a category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Sub-category">
                {(props) => (
                  <Select {...props} value={subCategoryId} onChange={(event) => setSubCategoryId(event.target.value)} disabled={!category}>
                    <option value="">All sub-categories</option>
                    {(category?.subCategories ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          ) : null}

          {scope !== "shown" ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(event) => setIncludeInactive(event.target.checked)}
                className="size-4 accent-[var(--primary)]"
              />
              Include inactive products (marked as Inactive)
            </label>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
