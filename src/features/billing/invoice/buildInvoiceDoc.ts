/**
 * Turns an issued invoice (the stored snapshot) into the plain document the PDF prints, and loads the brand mark and the UPI code. Nothing is calculated here: every figure is read from the snapshot. Written once and used unchanged by the back office
 * and the storefront, except the one constant naming where the brand mark is served from.
 */
import { loadMarkData, loadQrCodes } from "@/features/quotations/components/pdfAssets";
import type { InvoiceDoc } from "./InvoiceDocument";

/** Where this app serves the brand mark that suits a dark band. */
const BRAND_MARK = "/logo-mark-pdf.png";

export interface InvoiceSource {
  number: string;
  issuedOn: string;
  orderNumber: string;
  body: InvoiceBody;
}

/** The invoice snapshot as the PDF reads it (body version 2). */
export interface InvoiceBody {
  bodyVersion?: number;
  quotationNumber?: string | null;
  paidOn?: string | null;
  seller?: {
    name?: string;
    gstin?: string | null;
    pan?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    bankName?: string | null;
    bankAccount?: string | null;
    bankIfsc?: string | null;
    upiId?: string | null;
  };
  buyer?: { name?: string; email?: string | null; phone?: string | null; gstin?: string | null; state?: string | null };
  event?: { date?: string | null; venue?: string | null };
  eventDate?: string | null;
  groups?: {
    title: string;
    date: string | null;
    subtotal: number;
    lines: {
      number: number;
      description: string;
      remark?: string | null;
      hsn: string | null;
      quantity: number;
      unit: string;
      days: number;
      rate: number;
      amount: number;
    }[];
  }[];
  summary?: {
    itemsTotal: number;
    discounts: number;
    rentalCharges: number;
    taxRate?: number | null;
    halfRate?: number | null;
    intraState?: boolean;
    placeOfSupply?: string | null;
    placeOfSupplyCode?: string | null;
    cgst?: number;
    sgst?: number;
    igst?: number;
    transportationAndHandling: number;
    installationAndDismantling: number;
    securityDeposit: number;
    creditNotesApplied?: number;
    grandTotal: number;
    amountInWords: string;
  };
  paymentsReceived?: { receiptNumber: string | null; purpose: string; mode: string; paidOn: string; reference: string | null; amount: number }[];
}

/** Whether the invoice carries the version-2 snapshot the PDF needs; an older one only has the print page. */
export const canMakeInvoicePdf = (source: { body: InvoiceBody }) =>
  source.body.bodyVersion === 2 && Boolean(source.body.groups) && Boolean(source.body.summary);

export async function buildInvoiceDoc(source: InvoiceSource): Promise<InvoiceDoc> {
  const b = source.body;
  const sm = b.summary;
  if (!canMakeInvoicePdf(source) || !sm || !b.groups) throw new Error("This invoice has no PDF layout.");
  const seller = b.seller ?? {};
  const name = seller.name ?? "Tentvaale";
  const [logoMark, qr] = await Promise.all([
    loadMarkData(BRAND_MARK),
    loadQrCodes({ name, upiId: seller.upiId ?? null, phone: seller.phone ?? null }),
  ]);
  // An order made from a quotation has no single event date: the event runs from its first function to its last.
  const dates = b.groups.map((g) => g.date).filter((d): d is string => Boolean(d)).sort();
  const eventDate = b.event?.date ?? b.eventDate ?? dates[0] ?? null;
  const lastDate = dates.length > 1 && dates[dates.length - 1] !== eventDate ? dates[dates.length - 1] : null;
  const address = [seller.address, seller.city, seller.state, seller.postalCode].filter(Boolean).join(", ");
  return {
    number: source.number,
    issuedOn: source.issuedOn,
    paidOn: b.paidOn ?? null,
    quotationNumber: b.quotationNumber ?? null,
    orderNumber: source.orderNumber,
    seller: {
      name,
      address: address || null,
      gstin: seller.gstin ?? null,
      pan: seller.pan ?? null,
      phone: seller.phone ?? null,
      email: seller.email ?? null,
      website: seller.website ?? null,
      bankName: seller.bankName ?? null,
      bankAccount: seller.bankAccount ?? null,
      bankIfsc: seller.bankIfsc ?? null,
      upiId: seller.upiId ?? null,
    },
    buyer: {
      name: b.buyer?.name ?? "",
      email: b.buyer?.email ?? null,
      phone: b.buyer?.phone ?? null,
      state: b.buyer?.state ?? null,
      gstin: b.buyer?.gstin ?? null,
    },
    event: {
      date: eventDate,
      dateTo: lastDate,
      venue: b.event?.venue ?? null,
      state: b.buyer?.state ?? sm.placeOfSupply ?? null,
      stateCode: sm.placeOfSupplyCode ?? null,
      placeOfSupply: sm.placeOfSupply ?? null,
      functions: b.groups.map((g) => g.title).filter((t) => t && t !== "Items").join(", ") || null,
    },
    groups: b.groups.map((g) => ({
      title: g.title,
      date: g.date,
      subtotal: g.subtotal,
      lines: g.lines.map((l) => ({
        number: l.number,
        description: l.description,
        remark: l.remark ?? null,
        hsn: l.hsn,
        quantity: l.quantity,
        unit: l.unit,
        days: l.days,
        rate: l.rate,
        amount: l.amount,
      })),
    })),
    summary: {
      discounts: sm.discounts,
      itemsTotal: sm.itemsTotal,
      rentalCharges: sm.rentalCharges,
      taxRate: sm.taxRate ?? null,
      halfRate: sm.halfRate ?? null,
      intraState: sm.intraState ?? true,
      cgst: sm.cgst ?? 0,
      sgst: sm.sgst ?? 0,
      igst: sm.igst ?? 0,
      transportationAndHandling: sm.transportationAndHandling,
      installationAndDismantling: sm.installationAndDismantling,
      securityDeposit: sm.securityDeposit,
      creditNotesApplied: sm.creditNotesApplied ?? 0,
      grandTotal: sm.grandTotal,
    },
    amountInWords: sm.amountInWords,
    payments: b.paymentsReceived ?? [],
    logoMark,
    upiQr: qr.upi,
  };
}
