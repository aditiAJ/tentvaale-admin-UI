import { z } from "zod";

/**
 * A whole-number count of at least one, kept as a string through validation.
 *
 * Bound straight to a coercing number schema, an empty field becomes a
 * legitimate 0 — and 0 is a value the backend rejects rather than a missing
 * answer, so "blank" and "zero" have to stay different answers. Requiring the
 * string first does that, and the whole-number rule matches the int columns
 * behind every count the admin sends (line quantities, rental days, moved
 * quantities).
 *
 * Use with `useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>`
 * so the field stays a string in the form and arrives at the mutation as a
 * number.
 */
export function positiveIntegerField(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .regex(/^\d+$/, "Whole numbers only")
    .transform(Number)
    .refine((value) => value >= 1, `${label} must be at least 1`);
}

/**
 * A rupee amount of zero or more, kept as a string through validation.
 *
 * The same blank-versus-zero reasoning as positiveIntegerField: a coercing
 * number schema would turn an empty field into a legitimate 0 and quietly
 * create a free product or a no-deposit booking. The two-decimal rule matches
 * the numeric(19,2) money columns, so an over-precise amount is rejected here
 * rather than silently rounded by the database.
 */
export function amountField(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .regex(/^\d+(\.\d{1,2})?$/, "Enter an amount like 1500 or 1500.50")
    .transform(Number);
}

/**
 * A phone number as people write one: an optional leading +, then digits with
 * spaces, dashes or brackets between them, and at least 7 digits in all.
 * Deliberately loose — "+91 22 4455 6677" and "(022) 4455-6677" both pass —
 * because the point is to catch a mistyped email or a stray word, not to
 * enforce one country's format.
 */
export function isValidPhone(value: string): boolean {
  return /^\+?[\d\s()-]+$/.test(value) && (value.match(/\d/g)?.length ?? 0) >= 7;
}

/**
 * A real calendar date written as yyyy-MM-dd — the form Java's LocalDate
 * parses. "2026-02-30" has the right shape but is not a date, so the value is
 * round-tripped through Date rather than only pattern-matched.
 */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** The shape the backend's UUID path and body params accept. */
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
