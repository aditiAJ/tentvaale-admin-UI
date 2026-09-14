import type { Money } from "@/lib/money";

/**
 * Mirrors com.tentvaale.reporting.api.AdminDashboardView.
 *
 * Six figures, and that is genuinely all of it — the reporting module owns no
 * tables and assembles these from the quotation and order modules' public APIs.
 * The legacy admin's dashboard (revenue trend, overdue payments, late returns,
 * low stock, top products) has no equivalent here yet, because each of those
 * needs a read method on the module that owns the data.
 */
export interface AdminDashboardView {
  draftQuotations: number;
  sentQuotations: number;
  acceptedQuotations: number;
  convertedQuotations: number;
  totalOrders: number;
  totalOrderValue: Money;
}
