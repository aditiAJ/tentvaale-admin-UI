/** A state name compared the way the backend does: case, spacing and punctuation do not matter ("Gujarat", " gujarat."). */
const plain = (state: string) => state.toLowerCase().replace(/[^a-z0-9]/g, "");

export interface GstSplit {
  /** CGST + SGST (the customer is in the company's state) or IGST (anywhere else). */
  intraState: boolean;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

/**
 * The GST on a taxable amount, worked out as the backend does when the quotation is saved: one rate for everything, to two
 * decimals half up; in the company's state half is CGST and the rest SGST, elsewhere all of it is IGST. Null while the rate
 * or either state is not known, since the backend does not guess either.
 */
export function gstOn(taxable: number, rate: number | null | undefined, companyState?: string | null, customerState?: string | null): GstSplit | null {
  if (rate == null || !companyState?.trim() || !customerState?.trim()) return null;
  const total = Math.round(((taxable * rate) / 100 + Number.EPSILON) * 100) / 100;
  const intraState = plain(companyState) === plain(customerState);
  if (!intraState) return { intraState, cgst: 0, sgst: 0, igst: total, total };
  const cgst = Math.round((total / 2 + Number.EPSILON) * 100) / 100;
  return { intraState, cgst, sgst: Math.round((total - cgst) * 100) / 100, igst: 0, total };
}
