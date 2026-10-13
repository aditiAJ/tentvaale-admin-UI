/**
 * The retail-rate rule agreed in the Release 1.0 review (MOM-10): Retail Rate = Wholesale Rate + 20%, to 2 decimals.
 *
 * It is a default, not a lock: the form pre-fills it whenever the wholesale rate is changed and the retail rate stays
 * editable. The backend applies the same rule when a retail rate is left out of a save (`RetailRate.java`), so this is a
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
