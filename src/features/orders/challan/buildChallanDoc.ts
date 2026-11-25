import type { CompanyProfile } from "@/features/settings/api";
import type { QuotationView } from "@/features/quotations/types";
import { loadImageData, loadLivePictures, loadMarkData } from "@/features/quotations/components/pdfAssets";
import { getCustomer, listProducts } from "@/features/master-data/api";
import type { OrderView } from "@/features/orders/types";
import { docCompany, sourcesOf, splitName } from "@/features/orders/dispatch/buildDispatchDoc";
import type { ChallanDoc } from "./ChallanDocument";

/** What the delivery challan prints: every line of the order, in the order the quotation has them, with the customer's details. */
export async function buildChallanDoc(
  order: OrderView,
  quotation: QuotationView | undefined,
  company: CompanyProfile | undefined,
): Promise<ChallanDoc> {
  // What each product's quantity counts (pieces, sq ft, running ft); a product that cannot be read counts as pieces.
  const rateOf = new Map((await listProducts(undefined, { includeInactive: true }).catch(() => [])).map((p) => [p.id, p.rateType as string]));
  const sources = sourcesOf(order, quotation, await loadLivePictures(), rateOf);
  // The customer's address is not on the order; staff without access to customers still get the challan, without it.
  const customer = order.customerId ? await getCustomer(order.customerId).catch(() => null) : null;

  const entries = sources.map((s) => {
    const [name, variant] = splitName(s.name);
    return { name, variant, remark: s.remark, occasion: s.occasion, quantity: s.quantity, unit: s.unit, image: s.image };
  });

  // Only the pictures that will be printed are loaded.
  const urls = [...new Set(entries.map((e) => e.image).filter((u): u is string => Boolean(u)))];
  const [wordmark, pictures] = await Promise.all([
    loadMarkData("/logo-wordmark-pdf.png"),
    Promise.all(urls.map(async (url) => [url, await loadImageData(url, 360)] as const)),
  ]);
  const images: Record<string, string> = {};
  for (const [url, data] of pictures) if (data) images[url] = data;

  return {
    orderNumber: order.orderNumber,
    quotationNumber: quotation?.quotationNumber ?? null,
    preparedOn: new Date().toISOString().slice(0, 10),
    eventDate: order.eventDate ?? quotation?.eventDate ?? null,
    venue: quotation?.venue?.text ?? null,
    customer: {
      name: order.customerName,
      phone: customer?.phone ?? null,
      email: order.customerEmail ?? customer?.email ?? null,
      address: [customer?.addressLine, customer?.state, customer?.postalCode].filter(Boolean).join(", ") || null,
      gstin: customer?.gstin ?? null,
    },
    entries,
    company: await docCompany(company, wordmark),
    images,
    picturesMissing: urls.length - Object.keys(images).length,
  };
}
