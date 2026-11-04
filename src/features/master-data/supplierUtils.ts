/**
 * Small pure helpers for the Suppliers screens: contact links, the GSTIN shape, how old a supplier's answer is, and
 * reading a pasted or uploaded price list. Nothing here touches React, the network or the "@/" alias, so `npm test`
 * can run it straight from the TypeScript.
 */

/** A GSTIN: 2-digit state code, the 10-character PAN, an entity number, a letter, "Z", and a check character. */
export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** A phone number as a `tel:` link, or null when it has no digits to dial. */
export function telUrl(phone: string | null | undefined): string | null {
  const cleaned = (phone ?? "").replace(/[^\d+]/g, "");
  return /\d/.test(cleaned) ? `tel:${cleaned}` : null;
}

/**
 * A WhatsApp chat link for a phone number. A number written with a leading + is used as it is; a bare 10-digit number
 * (or one with a leading 0) is taken to be Indian. Null when it is too short to be a mobile number.
 */
export function whatsappUrl(phone: string | null | undefined): string | null {
  const raw = (phone ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (raw.startsWith("+")) return `https://wa.me/${digits}`;
  if (digits.length === 10) return `https://wa.me/91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `https://wa.me/91${digits.slice(1)}`;
  return `https://wa.me/${digits}`;
}

/** A supplier's count older than this is shown as needing a fresh answer. */
export const STALE_AFTER_DAYS = 30;

const DAY = 86_400_000;

/** Whole days since an ISO timestamp, or null when there is none (or it cannot be read). */
export function daysSince(iso: string | null | undefined, now: number = Date.now()): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((now - then) / DAY));
}

/** "Today", "3 days ago", "2 months ago", and whether the answer is old enough to ask the supplier again. */
export function confirmedLabel(
  iso: string | null | undefined,
  now: number = Date.now(),
): { text: string; stale: boolean } {
  const days = daysSince(iso, now);
  if (days === null) return { text: "Not confirmed", stale: true };
  const stale = days >= STALE_AFTER_DAYS;
  if (days === 0) return { text: "Today", stale };
  if (days === 1) return { text: "Yesterday", stale };
  if (days < 60) return { text: `${days} days ago`, stale };
  return { text: `${Math.floor(days / 30)} months ago`, stale };
}

// ---- reading a pasted or uploaded price list ---------------------------------------------------

/** One line of a pasted list, before it is matched against the catalogue. `problem` says what is wrong with it. */
export interface ParsedStockRow {
  /** The row's number in what was pasted, counting the header, so it matches what the person sees. */
  line: number;
  sku: string;
  quantity: number | null;
  /** Null when the cell was empty: the rate already agreed is kept. */
  rate: number | null;
  problem?: string;
}

/** The most lines one import takes. The server refuses more, so the screen says so first. */
export const MAX_IMPORT_LINES = 300;

/** Splits one line on a delimiter, honouring "double quotes" so a name with a comma stays whole. */
function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

/** Tab when the text came from a spreadsheet, otherwise whichever of ; or , the first line uses more. */
function detectDelimiter(firstLine: string): string {
  if (firstLine.includes("\t")) return "\t";
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

const HEADER_WORDS = {
  sku: ["sku", "item code", "code", "product code"],
  quantity: ["quantity", "qty", "available", "stock", "units"],
  rate: ["rate", "price", "rate per unit", "price per unit", "rent"],
};

function columnOf(headers: string[], words: string[]): number {
  return headers.findIndex((header) => words.includes(header.toLowerCase().trim()));
}

/**
 * Reads rows of SKU, quantity and rate from text copied out of Excel (tab separated) or saved as CSV. A first line
 * that names its columns (SKU, Quantity or Qty, Rate or Price) may put them in any order; without one the order is
 * SKU, quantity, rate. A rate may carry a ₹ sign and thousands commas. Blank lines are skipped.
 */
export function parseStockTable(text: string): ParsedStockRow[] {
  const lines = text.split(/\r?\n/).map((line, index) => ({ line, number: index + 1 })).filter((l) => l.line.trim() !== "");
  if (lines.length === 0) return [];

  const delimiter = detectDelimiter(lines[0].line);
  const firstCells = splitLine(lines[0].line, delimiter);
  const skuColumn = columnOf(firstCells, HEADER_WORDS.sku);
  const hasHeader = skuColumn >= 0;
  const columns = hasHeader
    ? {
        sku: skuColumn,
        quantity: columnOf(firstCells, HEADER_WORDS.quantity),
        rate: columnOf(firstCells, HEADER_WORDS.rate),
      }
    : { sku: 0, quantity: 1, rate: 2 };

  return lines.slice(hasHeader ? 1 : 0).map(({ line, number }) => {
    const cells = splitLine(line, delimiter);
    const sku = (cells[columns.sku] ?? "").trim();
    const quantityText = columns.quantity >= 0 ? (cells[columns.quantity] ?? "").replace(/[\s,]/g, "") : "";
    const rateText = columns.rate >= 0 ? (cells[columns.rate] ?? "").replace(/[₹\s,]/g, "") : "";

    let problem: string | undefined;
    if (!sku) problem = "No SKU";
    else if (!/^\d+$/.test(quantityText)) problem = "Quantity must be a whole number, 0 or more";
    else if (rateText !== "" && !/^\d+(\.\d{1,2})?$/.test(rateText)) problem = "Rate must be an amount like 125 or 125.50";

    return {
      line: number,
      sku,
      quantity: /^\d+$/.test(quantityText) ? Number(quantityText) : null,
      rate: rateText !== "" && /^\d+(\.\d{1,2})?$/.test(rateText) ? Number(rateText) : null,
      problem,
    };
  });
}
