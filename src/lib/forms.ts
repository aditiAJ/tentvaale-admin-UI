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

/** The shape the backend's UUID path and body params accept. */
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
