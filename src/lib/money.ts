/**
 * The backend's shared Money record: an amount plus an explicit currency,
 * always scaled to 2 decimal places server-side.
 *
 * `amount` is typed to accept a string as well as a number because it is a Java
 * BigDecimal on the wire. Jackson renders it as a JSON number by default, but a
 * single configuration change (WRITE_BIGDECIMAL_AS_PLAIN / quoting) would make
 * it a string, and money silently becoming NaN is not a failure worth risking
 * for the sake of a narrower type.
 */
export interface Money {
  amount: number | string;
  currency: string;
}

const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(currency: string): Intl.NumberFormat {
  let formatter = formatters.get(currency);
  if (!formatter) {
    // en-IN so amounts group the way the business reads them (1,20,000 not
    // 120,000) — the backend is INR-only today but the currency is not assumed.
    formatter = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    formatters.set(currency, formatter);
  }
  return formatter;
}

export function formatMoney(money: Money | null | undefined): string {
  if (!money) return "—";
  const amount = typeof money.amount === "string" ? Number(money.amount) : money.amount;
  if (!Number.isFinite(amount)) return "—";
  return formatterFor(money.currency || "INR").format(amount);
}
