import type { Money } from "@/lib/money";

/** The planner discount percentage that means "the wholesale rate itself"; the backend uses the same figure. */
const STANDARD_DISCOUNT = 20;

/**
 * What an event planner is quoted for a product or variant: its stored wholesale rate, moved by how far the planner's
 * discount is from 20 (each extra point takes one percent of the retail rate off; each point fewer adds it back). 0 means no
 * discount, so retail. Rounded to two decimals and never below zero, the same figure the backend works out when the
 * quotation is saved. A missing wholesale rate falls back to retail less 20%.
 */
export function plannerRate(retail: number, wholesale: number | null | undefined, percent: number): number {
  if (!percent) return retail;
  const base = wholesale ?? (retail * (100 - STANDARD_DISCOUNT)) / 100;
  const shift = ((percent - STANDARD_DISCOUNT) * retail) / 100;
  return Math.max(Math.round((base - shift + Number.EPSILON) * 100) / 100, 0);
}

/** A rate pair as the customer is quoted it: retail for a plain customer, the planner's rate otherwise. */
export function quotedMoney(retail: Money, wholesale: Money | null | undefined, percent: number): Money {
  return percent
    ? { amount: plannerRate(Number(retail.amount), wholesale ? Number(wholesale.amount) : null, percent), currency: retail.currency }
    : retail;
}
