import type { Money } from "@/lib/money";

/**
 * Mirrors com.tentvaale.masterdata.api.ProductView.
 *
 * `categoryName` rather than a category id, and it is nullable twice over: the
 * product may have no category, or may point at one that no longer exists.
 * md_product.category_id is deliberately not a foreign key ("keeping it loose
 * here matches how products reference categories in the legacy data, which has
 * orphans"), so the UI has to render a missing category as normal, not as an
 * error.
 */
export interface ProductView {
  id: string;
  companyId: string;
  sku: string;
  name: string;
  description: string | null;
  categoryName: string | null;
  rentalRate: Money;
  securityDeposit: Money;
  active: boolean;
}

export interface CreateProductRequest {
  /** Optional, and not checked against md_category by the backend. */
  categoryId?: string;
  sku: string;
  name: string;
  description?: string;
  rentalRate: number;
  securityDeposit: number;
}
