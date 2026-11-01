"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { importProducts, masterDataKeys, previewProductImport } from "@/features/master-data/api";
import {
  importFileProblem,
  importWillChange,
  type ImportAction,
  type ImportIssue,
  type ImportOutcome,
  type ImportPreview,
} from "@/features/master-data/productImport";
import { NETWORK_ERROR_STATUS, ApiError } from "@/services/api-client";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

/** A preview can hold thousands of rows; the table shows this many and says how many more there are. */
const MAX_ROWS = 200;

type Step = "pick" | "checking" | "preview" | "importing" | "done";

const ACTION: Record<ImportAction, { label: string; className: string }> = {
  CREATE: { label: "Create", className: "border-transparent bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-[var(--success)]" },
  UPDATE: { label: "Update", className: "border-transparent bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  UNCHANGED: { label: "Unchanged", className: "border-border bg-muted text-muted-foreground" },
  INVALID: { label: "Error", className: "border-transparent bg-[color-mix(in_srgb,var(--destructive)_12%,transparent)] text-destructive" },
};

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
}

/**
 * Import of the catalogue from the Excel file the Export button makes. Three real calls to the backend, no guessing
 * here: the file is checked (nothing saved), shown to the user, and only then imported, all or nothing.
 */
export function ProductImportButton() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showUnchanged, setShowUnchanged] = useState(false);
  const input = useRef<HTMLInputElement>(null);
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
      setPreview(await previewProductImport(chosen));
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
      const result = await importProducts(file, preview?.fingerprint);
      if (!result.imported) {
        // Nothing was written. Either the file now has errors, or the catalogue changed since the check and the
        // import would no longer do what the user was shown. Either way the fresh answer replaces the old one.
        setPreview(result.preview);
        setStep("preview");
        setError(
          result.stale
            ? "The catalogue changed since you checked this file (someone else added or edited a product or variant), so nothing was imported. What would happen now is shown below: look it over, then import again."
            : "The file no longer passes the check, so nothing was imported. Fix the rows below and check it again.",
        );
        return;
      }
      setOutcome(result);
      setStep("done");
      toast.success("Import finished");
      void queryClient.invalidateQueries({ queryKey: masterDataKeys.products });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === NETWORK_ERROR_STATUS) {
        // The request may have reached the server and finished. Importing the same file again blindly could add
        // products twice (rows without a SKU), so the user is sent back to a fresh check instead.
        void queryClient.invalidateQueries({ queryKey: masterDataKeys.products });
        setPreview(null);
        setFile(null);
        setStep("pick");
        setError("We lost the connection and cannot tell whether the import finished. The Products list has been refreshed: check it, then choose the file again to see what is left to import.");
      } else {
        // A rule refused it (for example a SKU taken meanwhile): everything was rolled back, nothing is saved.
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
  const changes = summary ? importWillChange(summary) : 0;
  const canImport = Boolean(preview?.canImport) && changes > 0;

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} title="Add or update products from an Excel file">
        <Upload />
        Import
      </Button>

      <Dialog
        open={open}
        onClose={close}
        title="Import products from Excel"
        description="Use a file made by Export. Nothing is saved until you press Import."
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
                {step === "preview" || (step === "pick" && file) ? (
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
                .xlsx only, up to 10 MB. The easiest start is a file you exported, edited and saved.
              </span>
              <input
                ref={input}
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
          ) : null}

          {(step === "preview" || step === "importing") && preview && summary ? (
            <>
              <p className="text-xs text-muted-foreground">
                File: <span className="font-medium text-foreground">{file?.name}</span>
              </p>

              <div className="flex flex-wrap gap-2 text-sm" role="status">
                <Badge className={ACTION.CREATE.className}>
                  {summary.productsToCreate + summary.variantsToCreate} to create
                </Badge>
                <Badge className={ACTION.UPDATE.className}>
                  {summary.productsToUpdate + summary.variantsToUpdate} to update
                </Badge>
                <Badge className={ACTION.UNCHANGED.className}>
                  {summary.productsUnchanged + summary.variantsUnchanged} unchanged
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
                <Alert tone="info" title="Nothing to import: every row already matches the catalogue." />
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
                Also list unchanged rows ({summary.productsUnchanged + summary.variantsUnchanged})
              </label>

              <LineTable
                title="Products"
                lines={preview.products.map((line) => ({ key: `p${line.row}`, row: line.row, sku: line.sku, name: line.name, action: line.action, changes: line.changes }))}
                showUnchanged={showUnchanged}
              />
              {preview.variants.length ? (
                <LineTable
                  title="Variants"
                  lines={preview.variants.map((line) => ({ key: `v${line.row}`, row: line.row, sku: line.sku, name: line.name, context: line.productSku ? `of ${line.productSku}` : undefined, action: line.action, changes: line.changes }))}
                  showUnchanged={showUnchanged}
                />
              ) : null}

              {preview.notImportedColumns.length ? (
                <p className="text-xs text-muted-foreground">
                  Not imported (read-only or handled elsewhere): {preview.notImportedColumns.join(", ")}.
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

interface Line {
  key: string;
  row: number;
  sku?: string;
  name?: string;
  /** Small print under the name: which product a variant belongs to. */
  context?: string;
  action: ImportAction;
  changes: string[];
}

function LineTable({ title, lines, showUnchanged }: { title: string; lines: Line[]; showUnchanged: boolean }) {
  const shown = lines.filter((line) => showUnchanged || line.action !== "UNCHANGED");
  const hidden = lines.length - shown.length;
  return (
    <section className="space-y-1.5" aria-label={`${title} in the file`}>
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title} ({lines.length})
      </h3>
      {shown.length === 0 ? (
        <p className="text-xs text-muted-foreground">No {title.toLowerCase()} to show{hidden ? ` (${hidden} unchanged hidden)` : ""}.</p>
      ) : (
        <TableWrapper className="max-h-72 overflow-y-auto rounded-md border border-border">
          <Table>
            <THead className="sticky top-0 bg-card">
              <TR className="hover:bg-transparent">
                <TH>Row</TH>
                <TH>SKU</TH>
                <TH>Name</TH>
                <TH>What happens</TH>
                <TH>What changes</TH>
              </TR>
            </THead>
            <TBody>
              {shown.slice(0, MAX_ROWS).map((line) => (
                <TR key={line.key} className={line.action === "INVALID" ? "bg-destructive/5" : undefined}>
                  <TD className="tabular text-muted-foreground">{line.row}</TD>
                  <TD className="text-xs">{line.sku ?? <span className="text-muted-foreground">automatic</span>}</TD>
                  <TD>
                    {line.name ?? "—"}
                    {line.context ? <span className="block text-xs text-muted-foreground">{line.context}</span> : null}
                  </TD>
                  <TD>
                    <Badge className={ACTION[line.action].className}>{ACTION[line.action].label}</Badge>
                  </TD>
                  <TD className="text-xs text-muted-foreground">{line.changes.length ? line.changes.join(", ") : "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrapper>
      )}
      {shown.length > MAX_ROWS ? (
        <p className="text-xs text-muted-foreground">Showing the first {MAX_ROWS} of {shown.length} rows.</p>
      ) : null}
    </section>
  );
}

function IssueList({ issues }: { issues: ImportIssue[] }) {
  return (
    <ul className="max-h-48 space-y-1 overflow-y-auto">
      {issues.map((issue, index) => (
        <li key={`${issue.sheet}-${issue.row}-${issue.column ?? ""}-${index}`}>
          <span className="font-medium">
            {issue.row > 0 ? `${issue.sheet}, row ${issue.row}` : issue.sheet}
            {issue.column ? `, ${issue.column}` : ""}:
          </span>{" "}
          {issue.message}
        </li>
      ))}
    </ul>
  );
}

function DoneSummary({ outcome }: { outcome: ImportOutcome }) {
  const s = outcome.preview.summary;
  const warnings = outcome.preview.issues.filter((issue) => issue.severity === "WARNING");
  return (
    <div className="space-y-3" role="status">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CheckCircle2 className="size-5 text-[var(--success)]" />
        Import finished. The Products list is up to date.
      </div>
      <ul className="space-y-1 text-sm">
        <li>Products created: <strong>{s.productsToCreate}</strong></li>
        <li>Products updated: <strong>{s.productsToUpdate}</strong></li>
        <li>Variants created: <strong>{s.variantsToCreate}</strong></li>
        <li>Variants updated: <strong>{s.variantsToUpdate}</strong></li>
        <li className="text-muted-foreground">Left as they were: {s.productsUnchanged + s.variantsUnchanged}</li>
      </ul>
      {warnings.length ? (
        <Alert tone="warning" title="Noted during the import">
          <IssueList issues={warnings} />
        </Alert>
      ) : null}
    </div>
  );
}
