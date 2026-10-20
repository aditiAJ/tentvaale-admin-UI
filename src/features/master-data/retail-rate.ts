/**
 * The retail-rate rule agreed in the Release 1.0 review (MOM-10): Retail Rate = Wholesale Rate + 20%, to 2 decimals.
 *
 * It is a default, not a lock, and it works both ways: the form pre-fills the retail rate whenever the wholesale rate is
 * changed, and the wholesale rate (retail ÷ 1.2) whenever the retail rate is changed. Both stay editable; the one typed
 * last decides the other. The backend applies the same rule when a retail rate is left out of a save (`RetailRate.java`), so this is a
 * convenience for the form and not the only place the rule lives.
 */
export const RETAIL_MARKUP_PERCENT = 20;

/**
 * The suggested retail rate for a wholesale rate, as the text a field holds ("42", "21.6"), or null when the wholesale
 * rate is empty or not a valid amount. Worked in whole paise so 18 gives exactly 21.6, never 21.599999999999998.
 * (20% of a whole number of paise is never a half paisa, so there is no rounding tie to settle.)
 */
export function suggestedRetail(wholesale: string | undefined): string | null {
  const text = (wholesale ?? "").trim();
  if (!text) return null;
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const paise = Math.round(amount * 100);
  const retailPaise = Math.round((paise * (100 + RETAIL_MARKUP_PERCENT)) / 100);
  return String(retailPaise / 100);
}

/**
 * The wholesale rate a retail rate implies (retail ÷ 1.2), rounded to the paisa, as field text; null when the retail
 * rate is empty or not a valid amount. Retail ₹100 gives ₹83.33.
 */
export function suggestedWholesale(retail: string | undefined): string | null {
  const text = (retail ?? "").trim();
  if (!text) return null;
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const paise = Math.round(amount * 100);
  return String(Math.round((paise * 100) / (100 + RETAIL_MARKUP_PERCENT)) / 100);
}

/**
 * True when the pair follows the rule from either side. Worked back from a retail rate the wholesale is rounded to the
 * paisa, so wholesale + 20% can land a paisa off the retail rate typed (retail ₹1.05 gives wholesale ₹0.88, and
 * ₹0.88 + 20% is ₹1.06); a pair made from either field counts as following the rule.
 */
export function followsRetailRule(retail: string | undefined, wholesale: string | undefined): boolean {
  const fromWholesale = suggestedRetail(wholesale);
  const fromRetail = suggestedWholesale(retail);
  return (fromWholesale !== null && Number(retail) === Number(fromWholesale)) || (fromRetail !== null && Number(wholesale) === Number(fromRetail));
}
