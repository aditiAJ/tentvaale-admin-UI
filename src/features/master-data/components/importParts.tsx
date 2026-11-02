import type { ImportAction, ImportIssue } from "@/features/master-data/productImport";
import { ApiError } from "@/services/api-client";

/** Pieces the Excel import dialogs have in common (products, warehouses and stock). */

/** A preview can hold thousands of rows; a table shows this many and says how many more there are. */
export const MAX_ROWS = 200;

export type Step = "pick" | "checking" | "preview" | "importing" | "done";

/** The coloured label for what an import would do with a row. */
export const ACTION: Record<ImportAction, { label: string; className: string }> = {
  CREATE: { label: "Create", className: "border-transparent bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-[var(--success)]" },
  UPDATE: { label: "Update", className: "border-transparent bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  UNCHANGED: { label: "Unchanged", className: "border-border bg-muted text-muted-foreground" },
  INVALID: { label: "Error", className: "border-transparent bg-[color-mix(in_srgb,var(--destructive)_12%,transparent)] text-destructive" },
};

/** What to tell the user about a failed request: the server's own words, or a plain fallback. */
export function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
}

/** Findings as "Sheet, row 3, Column: message", errors and warnings alike. */
export function IssueList({ issues }: { issues: ImportIssue[] }) {
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
