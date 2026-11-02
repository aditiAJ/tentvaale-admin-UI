/**
 * The warehouse and stock import as the backend describes it (WarehouseImport.java). Findings and actions are the
 * product import's own. The backend leaves out null fields, so the ones that can be empty are optional here.
 */
import type { ImportAction, ImportIssue } from "@/features/master-data/productImport";

export interface WarehouseImportSummary {
  warehouseRows: number;
  warehousesToCreate: number;
  warehousesToUpdate: number;
  warehousesUnchanged: number;
  stockRows: number;
  /** Stock numbers that differ from what the warehouse holds now (new lines and changed ones). */
  stockToChange: number;
  stockUnchanged: number;
  errors: number;
  warnings: number;
}

export interface WarehouseImportLine {
  row: number;
  code?: string;
  name?: string;
  action: ImportAction;
  /** For an update: the columns whose value differs from the warehouse as it is. */
  changes: string[];
}

export interface StockImportLine {
  row: number;
  variantSku?: string;
  warehouse?: string;
  /** What the warehouse holds now; absent when it holds no line for this variant yet. */
  oldQuantity?: number;
  newQuantity?: number;
  action: ImportAction;
}

/** What a file would do. Writes nothing. */
export interface WarehouseImportPreview {
  summary: WarehouseImportSummary;
  warehouses: WarehouseImportLine[];
  stock: StockImportLine[];
  issues: ImportIssue[];
  notImportedColumns: string[];
  canImport: boolean;
  /** Identifies what this preview promised; the import must send it back. Absent when the file has errors. */
  fingerprint?: string;
}

/** `imported` false means nothing was written: the file had errors, or (`stale`) the data changed since the preview. */
export interface WarehouseImportOutcome {
  imported: boolean;
  stale: boolean;
  preview: WarehouseImportPreview;
}

/** Rows that would change something. A file with none is pointless, so the button stays off. */
export function warehouseImportWillChange(summary: WarehouseImportSummary): number {
  return summary.warehousesToCreate + summary.warehousesToUpdate + summary.stockToChange;
}
