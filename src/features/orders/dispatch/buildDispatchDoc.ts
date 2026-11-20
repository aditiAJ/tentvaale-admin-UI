import type { CompanyProfile } from "@/features/settings/api";
import type { QuotationView } from "@/features/quotations/types";
import { shortDate } from "@/features/quotations/components/QuotationDocument";
import { loadImageData, loadLivePictures, loadMarkData } from "@/features/quotations/components/pdfAssets";
import { listProducts } from "@/features/master-data/api";
import type { OrderView } from "@/features/orders/types";
import type { DispatchDoc, DispatchEntry, DispatchGroup } from "./DispatchListDocument";
import { pickPlan } from "./pickPlan";

/** "Round Table (Red)" is the product "Round Table" in the variant "Red". */
function splitName(name: string): [string, string | null] {
  const match = /^(.*) \((.+)\)$/.exec(name);
  return match ? [match[1], match[2]] : [name, null];
}

/** One thing to send out: from the quotation the order was made from (it knows the function and the picture), else the order. */
interface Source {
  productId: number | null;
  variantId: number | null;
  name: string;
  quantity: number;
  remark: string | null;
  occasion: string | null;
  image: string | null;
  /** What the quantity counts when it is not pieces; null for pieces. */
  unit: string | null;
}

const UNIT_OF = { SqFt: "SQ FT", SQFT: "SQ FT", RFt: "RFT", RFT: "RFT" } as const;
const unitFor = (rateType: string | null | undefined) => UNIT_OF[rateType as keyof typeof UNIT_OF] ?? null;

function sourcesOf(
  order: OrderView,
  quotation: QuotationView | undefined,
  pictureFor: Awaited<ReturnType<typeof loadLivePictures>>,
  rateOf: Map<string, string>,
): Source[] {
  if (quotation && quotation.lines.length > 0) {
    return quotation.lines.map((l) => ({
      productId: l.oneTime || !l.productId ? null : Number(l.productId),
      variantId: l.variantId ? Number(l.variantId) : null,
      name: l.productName,
      quantity: l.quantity,
      remark: l.remark ?? null,
      occasion: l.functionName ? [l.functionName, shortDate(l.functionDate)].filter(Boolean).join(" · ") : null,
      image: l.oneTime || !l.productId ? null : pictureFor(l.productId, l.variantId, l.imageUrl),
      unit: unitFor(l.rateType ?? (l.productId ? rateOf.get(String(l.productId)) : null)),
    }));
  }
  return order.lines.map((l) => ({
    productId: l.productId ? Number(l.productId) : null,
    variantId: l.variantId ? Number(l.variantId) : null,
    name: l.productName,
    quantity: l.quantity,
    remark: l.remark ?? null,
    occasion: null,
    image: l.productId ? pictureFor(l.productId, l.variantId, null) : null,
    unit: l.productId ? unitFor(l.rateType ?? rateOf.get(String(l.productId))) : null,
  }));
}

const NO_WAREHOUSE = "No warehouse assigned to this product";

/**
 * What the dispatch list prints. The backend says which warehouse and location each line is picked from; a line it
 * cannot place goes under "No warehouse assigned", and a line typed in by hand (no product, no stock) under "Other".
 */
export async function buildDispatchDoc(
  order: OrderView,
  quotation: QuotationView | undefined,
  company: CompanyProfile | undefined,
): Promise<DispatchDoc> {
  // What each product's quantity counts (pieces, sq ft, running ft); a product that cannot be read counts as pieces.
  const rateOf = new Map((await listProducts(undefined, { includeInactive: true }).catch(() => [])).map((p) => [p.id, p.rateType as string]));
  const sources = sourcesOf(order, quotation, await loadLivePictures(), rateOf);
  const stocked = sources.filter((s): s is Source & { productId: number } => s.productId !== null);
  const plan = await pickPlan(stocked.map((s) => ({ productId: s.productId, variantId: s.variantId, quantity: s.quantity })));

  const warehouses = new Map<number, DispatchGroup>();
  const unassigned: DispatchEntry[] = [];
  const other: DispatchEntry[] = [];
  const entry = (s: Source, quantity: number, location: string | null, note: string | null): DispatchEntry => {
    const [name, variant] = splitName(s.name);
    return { name, variant, remark: s.remark, occasion: s.occasion, quantity, unit: s.unit, image: s.image, location, note };
  };

  for (const s of sources) {
    if (s.productId === null) other.push(entry(s, s.quantity, null, "One-time item, not from stock"));
  }
  stocked.forEach((s, i) => {
    const line = plan[i];
    for (const source of line?.sources ?? []) {
      let group = warehouses.get(source.warehouseId);
      if (!group) {
        group = { kind: "warehouse", title: source.warehouseName, subtitle: null, entries: [] };
        warehouses.set(source.warehouseId, group);
      }
      for (const place of source.locations) {
        group.entries.push(entry(s, place.quantity, place.path ? `${place.path} (${place.code})` : place.code, null));
      }
      if (source.unplaced > 0) group.entries.push(entry(s, source.unplaced, null, "Location not set"));
    }
    // A line some warehouse holds shows what it holds, no more; only one no warehouse holds at all is "not assigned".
    if (!line || line.sources.length === 0) unassigned.push(entry(s, s.quantity, null, NO_WAREHOUSE));
  });

  const byPlace = (a: DispatchEntry, b: DispatchEntry) =>
    (a.location ?? "￿").localeCompare(b.location ?? "￿") || a.name.localeCompare(b.name);
  const groups: DispatchGroup[] = [...warehouses.values()]
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((g) => ({ ...g, entries: g.entries.sort(byPlace) }));
  if (unassigned.length > 0) {
    groups.push({ kind: "unassigned", title: "No warehouse assigned", subtitle: "Set the stock in Warehouses, or arrange these separately", entries: unassigned });
  }
  if (other.length > 0) groups.push({ kind: "other", title: "Other items", subtitle: null, entries: other });

  // Only the pictures that will be printed are loaded.
  const urls = [...new Set(groups.flatMap((g) => g.entries).map((e) => e.image).filter((u): u is string => Boolean(u)))];
  const [wordmark, pictures] = await Promise.all([
    loadMarkData("/logo-wordmark-pdf.png"),
    Promise.all(urls.map(async (url) => [url, await loadImageData(url, 360)] as const)),
  ]);
  // Always the TENTVAALE wordmark, the same as the quotation, not the logo uploaded in Company settings.
  const logo = wordmark ?? (await loadMarkData("/logo-mark-pdf.png"));
  const images: Record<string, string> = {};
  for (const [url, data] of pictures) if (data) images[url] = data;

  return {
    orderNumber: order.orderNumber,
    quotationNumber: quotation?.quotationNumber ?? null,
    preparedOn: new Date().toISOString().slice(0, 10),
    eventDate: order.eventDate ?? quotation?.eventDate ?? null,
    venue: quotation?.venue?.text ?? null,
    customerName: order.customerName,
    status: order.status,
    groups,
    company: {
      name: company?.name ?? "Tentvaale",
      address: [company?.addressLine, company?.city, company?.state, company?.postalCode].filter(Boolean).join(", ") || null,
      gstin: company?.gstin ?? null,
      pan: company?.pan ?? null,
      phone: company?.primaryPhone ?? null,
      email: company?.publicEmail ?? null,
      website: company?.websiteUrl ?? null,
      bankName: company?.bankName ?? null,
      bankAccount: company?.bankAccount ?? null,
      bankIfsc: company?.bankIfsc ?? null,
      upiId: company?.upiId ?? null,
      logo,
    },
    images,
    picturesMissing: urls.length - Object.keys(images).length,
  };
}
