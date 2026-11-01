/**
 * The product import as the backend describes it (ProductImport.java). The backend leaves out null fields, so the
 * ones that can be empty are optional here.
 */

export type ImportAction = "CREATE" | "UPDATE" | "UNCHANGED" | "INVALID";

export interface ImportIssue {
  sheet: string;
  /** The Excel row (the header is row 1); 0 for a problem with the whole file. */
  row: number;
  column?: string;
  severity: "ERROR" | "WARNING";
  message: string;
}

export interface ImportSummary {
  productRows: number;
  productsToCreate: number;
  productsToUpdate: number;
  productsUnchanged: number;
  variantRows: number;
  variantsToCreate: number;
  variantsToUpdate: number;
  variantsUnchanged: number;
  errors: number;
  warnings: number;
}

export interface ImportProductLine {
  row: number;
  sku?: string;
  name?: string;
  action: ImportAction;
  /** For an update: the columns whose value differs from the catalogue. */
  changes: string[];
}

export interface ImportVariantLine {
  row: number;
  productSku?: string;
  sku?: string;
  name?: string;
  action: ImportAction;
  changes: string[];
}

/** What a file would do. Writes nothing. */
export interface ImportPreview {
  summary: ImportSummary;
  products: ImportProductLine[];
  variants: ImportVariantLine[];
  issues: ImportIssue[];
  /** Columns in the file that import does not read (stock, photos, counts…). */
  notImportedColumns: string[];
  canImport: boolean;
  /** Identifies what this preview promised; the import must send it back. Absent when the file has errors. */
  fingerprint?: string;
}

/**
 * The answer to an import. `imported` false means nothing was written: the file had errors, or (`stale`) the
 * catalogue changed since the preview, so `preview` is what would happen now and needs a fresh look.
 */
export interface ImportOutcome {
  imported: boolean;
  stale: boolean;
  preview: ImportPreview;
}

/** The only file type the backend reads; also the limit it enforces (application.yml, 10 MB). */
export const IMPORT_MAX_BYTES = 10 * 1024 * 1024;

/** Why a file cannot even be sent, or null when it can. */
export function importFileProblem(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(".xlsx")) return "Only Excel (.xlsx) files can be imported.";
  if (file.size === 0) return "The file is empty.";
  if (file.size > IMPORT_MAX_BYTES) return "The file is larger than 10 MB.";
  return null;
}

/** Rows that would change something. An import of a file with none is pointless, so the button stays off. */
export function importWillChange(summary: ImportSummary): number {
  return summary.productsToCreate + summary.productsToUpdate + summary.variantsToCreate + summary.variantsToUpdate;
}
