import { type InvoiceSource } from "./buildInvoiceDoc";

/**
 * Makes the invoice PDF from the issued invoice. The PDF engine is large, so it is loaded only when asked. The same invoice
 * always gives the same document: it is drawn from the stored snapshot, never from live data. Written once and used unchanged
 * by the back office and the storefront.
 */
export async function makeInvoicePdf(source: InvoiceSource): Promise<Blob> {
  const [{ pdf }, { InvoiceDocument }, { buildInvoiceDoc }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./InvoiceDocument"),
    import("./buildInvoiceDoc"),
  ]);
  const doc = await buildInvoiceDoc(source);
  return pdf(<InvoiceDocument doc={doc} />).toBlob();
}

export const invoiceFileName = (number: string) => `Tentvaale-Invoice-${number}.pdf`;

/** Saves an already made PDF under the invoice's file name. */
export function saveInvoicePdf(blob: Blob, number: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = invoiceFileName(number);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function downloadInvoicePdf(source: InvoiceSource): Promise<void> {
  saveInvoicePdf(await makeInvoicePdf(source), source.number);
}
