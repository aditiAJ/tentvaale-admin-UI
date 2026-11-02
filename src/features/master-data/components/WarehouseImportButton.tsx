"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  downloadWarehouseImportTemplate,
  importWarehouses,
  masterDataKeys,
  previewWarehouseImport,
} from "@/features/master-data/api";
import { importFileProblem, type ImportAction } from "@/features/master-data/productImport";
import {
  warehouseImportWillChange,
  type WarehouseImportOutcome,
  type WarehouseImportPreview,
} from "@/features/master-data/warehouseImport";
import { ACTION, IssueList, MAX_ROWS, messageOf, type Step } from "@/features/master-data/components/importParts";
import { NETWORK_ERROR_STATUS, ApiError } from "@/services/api-client";
import { saveFile } from "@/lib/download";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

/**
 * Import of warehouses and the stock they hold, from an Excel file. Same safe flow as the product import: the file is
 * checked (nothing saved), shown with old and new quantities, and only then imported, all or nothing. A stock number
 * REPLACES what the warehouse holds for that variant (as the stock grid does); lines the file leaves out are untouched.
 */
export function WarehouseImportButton() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<WarehouseImportPreview | null>(null);
  const [outcome, setOutcome] = useState<WarehouseImportOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [downloading, setDownloading] = useState(false);
  // A second click lands before React has re-rendered the button as disabled; this stops it sending twice.
  const sending = useRef(false);

  const busy = step === "checking" || step === "importing";

  function startOver() {
    setStep("pick");
    setFile(null);
    setPreview(null);
    setOutcome(null);
    setError(null);
    setShowUnchanged(false);
  }

  function close() {
    if (busy) return;
    setOpen(false);
    startOver();
  }

  function refreshLists() {
    // Warehouse stock lists are nested under the warehouses key, so this refreshes them too.
    void queryClient.invalidateQueries({ queryKey: masterDataKeys.warehouses });
    void queryClient.invalidateQueries({ queryKey: masterDataKeys.products });
  }

  async function downloadTemplate() {
    setDownloading(true);
    try {
      const { blob, filename } = await downloadWarehouseImportTemplate();
      saveFile(blob, filename);
    } catch (caught) {
      toast.error(messageOf(caught));
    } finally {
      setDownloading(false);
    }
  }

  async function check(chosen: File) {
    const problem = importFileProblem(chosen);
    if (problem) {
      setError(problem);
      return;
    }
    if (sending.current) return;
    sending.current = true;
    setError(null);
    setFile(chosen);
    setStep("checking");
    try {
      setPreview(await previewWarehouseImport(chosen));
      setStep("preview");
    } catch (caught) {
      setError(messageOf(caught));
      setFile(null);
      setStep("pick");
    } finally {
      sending.current = false;
    }
  }

  async function runImport() {
    if (!file || sending.current) return;
    sending.current = true;
    setError(null);
    setStep("importing");
    try {
      const result = await importWarehouses(file, preview?.fingerprint);
      if (!result.imported) {
        // Nothing was written: the file now has errors, or the data changed since the check and the import would no
        // longer do what the user was shown. Either way the fresh answer replaces the old one.
        setPreview(result.preview);
        setStep("preview");
        setError(
          result.stale
            ? "Warehouses or stock changed since you checked this file (someone else edited them), so nothing was imported. What would happen now is shown below: look it over, then import again."
            : "The file no longer passes the check, so nothing was imported. Fix the rows below and check it again.",
        );
        return;
      }
      setOutcome(result);
      setStep("done");
      toast.success("Import finished");
      refreshLists();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === NETWORK_ERROR_STATUS) {
        // The request may have reached the server and finished; importing again blindly is not safe to offer.
        refreshLists();
        setPreview(null);
        setFile(null);
        setStep("pick");
        setError("We lost the connection and cannot tell whether the import finished. The lists have been refreshed: check them, then choose the file again to see what is left to import.");
      } else {
        setError(`${messageOf(caught)} Nothing was imported.`);
        setStep("preview");
      }
    } finally {
      sending.current = false;
    }
  }

  const summary = preview?.summary;
  const errors = preview?.issues.filter((issue) => issue.severity === "ERROR") ?? [];
  const warnings = preview?.issues.filter((issue) => issue.severity === "WARNING") ?? [];
  const changes = summary ? warehouseImportWillChange(summary) : 0;
  const canImport = Boolean(preview?.canImport) && changes > 0;

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} title="Add or update warehouses and their stock from an Excel file">
        <Upload />
        Import
      </Button>

      <Dialog
        open={open}
        onClose={close}
        title="Import warehouses and stock from Excel"
        description="Nothing is saved until you press Import. A stock number replaces what the warehouse holds now."
        className="max-w-4xl"
        footer={
          <>
            {step === "done" ? (
              <>
                <Button variant="outline" onClick={startOver}>
                  Import another file
                </Button>
                <Button onClick={close}>Done</Button>
              </>
            ) : (
              <>
                {step === "preview" ? (
                  <Button variant="outline" onClick={startOver} disabled={busy}>
                    Choose another file
                  </Button>
                ) : null}
                <Button variant="outline" onClick={close} disabled={busy}>
                  Cancel
                </Button>
                {step === "preview" || step === "importing" ? (
                  <Button onClick={runImport} disabled={busy || !canImport}>
                    {step === "importing" ? <Loader2 className="animate-spin" /> : <Upload />}
                    {step === "importing" ? "Importing…" : "Import now"}
                  </Button>
                ) : null}
              </>
            )}
          </>
        }
      >
        <div className="space-y-4">
          {error ? <Alert tone="error" title={error} /> : null}

          {step === "pick" || step === "checking" ? (
            <>
              <label
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-border px-4 py-10 text-center text-sm",
                  busy ? "pointer-events-none opacity-60" : "hover:bg-muted/60",
                )}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const dropped = event.dataTransfer.files[0];
                  if (dropped && !busy) void check(dropped);
                }}
              >
                {step === "checking" ? <Loader2 className="size-6 animate-spin text-muted-foreground" /> : <FileSpreadsheet className="size-6 text-muted-foreground" />}
                <span className="font-medium">{step === "checking" ? `Checking ${file?.name ?? "the file"}…` : "Choose an Excel file, or drop it here"}</span>
                <span className="text-xs text-muted-foreground">
                  .xlsx only, up to 10 MB. Sheets: <strong>Warehouses</strong> (Code, Name, Address, City, Contact person, Contact number, Description, Status)
                  and <strong>Stock</strong> (Variant SKU, Warehouse, Quantity).
                </span>
                <input
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="sr-only"
                  aria-label="Excel file to import"
                  disabled={busy}
                  onChange={(event) => {
                    const chosen = event.target.files?.[0];
                    // Cleared so choosing the same file again (after fixing it in Excel) still fires.
                    event.target.value = "";
                    if (chosen) void check(chosen);
                  }}
                />
              </label>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <Button variant="outline" size="sm" onClick={downloadTemplate} disabled={busy || downloading}>
                  {downloading ? <Loader2 className="animate-spin" /> : <Download />}
                  Download template
                </Button>
                <span>The file holds your warehouses and stock as they are now. Change it in Excel, save, and choose it here.</span>
              </div>
            </>
          ) : null}

          {(step === "preview" || step === "importing") && preview && summary ? (
            <>
              <p className="text-xs text-muted-foreground">
                File: <span className="font-medium text-foreground">{file?.name}</span>
              </p>

              <div className="flex flex-wrap gap-2 text-sm" role="status">
                <Badge className={ACTION.CREATE.className}>{summary.warehousesToCreate} {summary.warehousesToCreate === 1 ? "warehouse" : "warehouses"} to create</Badge>
                <Badge className={ACTION.UPDATE.className}>{summary.warehousesToUpdate} {summary.warehousesToUpdate === 1 ? "warehouse" : "warehouses"} to update</Badge>
                <Badge className={ACTION.UPDATE.className}>{summary.stockToChange} {summary.stockToChange === 1 ? "stock number" : "stock numbers"} to change</Badge>
                <Badge className={ACTION.UNCHANGED.className}>
                  {summary.warehousesUnchanged + summary.stockUnchanged} unchanged
                </Badge>
                <Badge className={errors.length ? ACTION.INVALID.className : ACTION.UNCHANGED.className}>
                  {errors.length} {errors.length === 1 ? "error" : "errors"}
                </Badge>
                {warnings.length ? <Badge variant="warning">{warnings.length} {warnings.length === 1 ? "warning" : "warnings"}</Badge> : null}
              </div>

              {errors.length ? (
                <Alert tone="error" title="Fix these in the file, save it, and choose it again. Nothing is imported while any error remains.">
                  <IssueList issues={errors} />
                </Alert>
              ) : changes === 0 ? (
                <Alert tone="info" title="Nothing to import: every row already matches what is there." />
              ) : null}

              {warnings.length ? (
                <Alert tone="warning" title="Worth a look (these do not stop the import)">
                  <IssueList issues={warnings} />
                </Alert>
              ) : null}

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showUnchanged}
                  onChange={(event) => setShowUnchanged(event.target.checked)}
                  className="size-4 accent-[var(--primary)]"
                />
                Also list unchanged rows ({summary.warehousesUnchanged + summary.stockUnchanged})
              </label>

              <Section title="Warehouses" total={preview.warehouses.length} shown={preview.warehouses.filter((l) => showUnchanged || l.action !== "UNCHANGED")}>
                {(lines) => (
                  <Table>
                    <THead className="sticky top-0 bg-card">
                      <TR className="hover:bg-transparent">
                        <TH>Row</TH>
                        <TH>Code</TH>
                        <TH>Name</TH>
                        <TH>What happens</TH>
                        <TH>What changes</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {lines.slice(0, MAX_ROWS).map((line) => (
                        <TR key={`w${line.row}`} className={line.action === "INVALID" ? "bg-destructive/5" : undefined}>
                          <TD className="tabular text-muted-foreground">{line.row}</TD>
                          <TD className="text-xs">{line.code ?? <span className="text-muted-foreground">automatic</span>}</TD>
                          <TD>{line.name ?? "—"}</TD>
                          <TD><ActionBadge action={line.action} /></TD>
                          <TD className="text-xs text-muted-foreground">{line.changes.length ? line.changes.join(", ") : "—"}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                )}
              </Section>

              <Section title="Stock" total={preview.stock.length} shown={preview.stock.filter((l) => showUnchanged || l.action !== "UNCHANGED")}>
                {(lines) => (
                  <Table>
                    <THead className="sticky top-0 bg-card">
                      <TR className="hover:bg-transparent">
                        <TH>Row</TH>
                        <TH>Variant SKU</TH>
                        <TH>Warehouse</TH>
                        <TH>Quantity</TH>
                        <TH>What happens</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {lines.slice(0, MAX_ROWS).map((line) => (
                        <TR key={`s${line.row}`} className={line.action === "INVALID" ? "bg-destructive/5" : undefined}>
                          <TD className="tabular text-muted-foreground">{line.row}</TD>
                          <TD className="text-xs">{line.variantSku ?? "—"}</TD>
                          <TD>{line.warehouse ?? "—"}</TD>
                          <TD className="tabular">
                            {line.newQuantity === undefined ? (
                              "—"
                            ) : (
                              <span className="inline-flex items-center gap-1.5">
                                <span className="text-muted-foreground">{line.oldQuantity ?? "none"}</span>
                                <ArrowRight className="size-3.5 text-muted-foreground" aria-label="becomes" />
                                <strong>{line.newQuantity}</strong>
                              </span>
                            )}
                          </TD>
                          <TD><ActionBadge action={line.action} /></TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                )}
              </Section>

              {preview.notImportedColumns.length ? (
                <p className="text-xs text-muted-foreground">
                  Not imported (for your reference only): {preview.notImportedColumns.join(", ")}.
                </p>
              ) : null}
            </>
          ) : null}

          {step === "done" && outcome ? <DoneSummary outcome={outcome} /> : null}
        </div>
      </Dialog>
    </>
  );
}

function ActionBadge({ action }: { action: ImportAction }) {
  return <Badge className={ACTION[action].className}>{ACTION[action].label}</Badge>;
}

function Section<T>({
  title,
  total,
  shown,
  children,
}: {
  title: string;
  total: number;
  shown: T[];
  children: (lines: T[]) => React.ReactNode;
}) {
  if (total === 0) return null;
  const hidden = total - shown.length;
  return (
    <section className="space-y-1.5" aria-label={`${title} in the file`}>
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title} ({total})
      </h3>
      {shown.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing to show{hidden ? ` (${hidden} unchanged hidden)` : ""}.</p>
      ) : (
        <TableWrapper className="max-h-72 overflow-y-auto rounded-md border border-border">{children(shown)}</TableWrapper>
      )}
      {shown.length > MAX_ROWS ? (
        <p className="text-xs text-muted-foreground">Showing the first {MAX_ROWS} of {shown.length} rows.</p>
      ) : null}
    </section>
  );
}

function DoneSummary({ outcome }: { outcome: WarehouseImportOutcome }) {
  const s = outcome.preview.summary;
  const warnings = outcome.preview.issues.filter((issue) => issue.severity === "WARNING");
  return (
    <div className="space-y-3" role="status">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CheckCircle2 className="size-5 text-[var(--success)]" />
        Import finished. The warehouses are up to date.
      </div>
      <ul className="space-y-1 text-sm">
        <li>Warehouses created: <strong>{s.warehousesToCreate}</strong></li>
        <li>Warehouses updated: <strong>{s.warehousesToUpdate}</strong></li>
        <li>Stock numbers changed: <strong>{s.stockToChange}</strong></li>
        <li className="text-muted-foreground">Left as they were: {s.warehousesUnchanged + s.stockUnchanged}</li>
      </ul>
      {warnings.length ? (
        <Alert tone="warning" title="Noted during the import">
          <IssueList issues={warnings} />
        </Alert>
      ) : null}
    </div>
  );
}
