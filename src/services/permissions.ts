/**
 * The authorisation vocabulary, mirroring com.tentvaale.identity.api.Permission.
 *
 * The UI gates on permissions, never on roles — the same rule the backend
 * follows for its @PreAuthorize annotations. Roles are listed here only because
 * user administration has to offer them as a choice; the role -> permission
 * mapping is deliberately NOT duplicated client-side, since the token already
 * carries the resolved permission set and a second copy would silently drift
 * the first time a role is re-scoped on the server.
 */
export const PERMISSIONS = [
  "MASTER_DATA_READ",
  "MASTER_DATA_WRITE",
  "QUOTATION_READ",
  "QUOTATION_WRITE",
  "ORDER_READ",
  "ORDER_WRITE",
  "INVENTORY_READ",
  "INVENTORY_WRITE",
  "CREDIT_NOTE_READ",
  "CREDIT_NOTE_WRITE",
  "DEPOSIT_READ",
  "DEPOSIT_WRITE",
  "REPORTING_READ",
  "NOTIFICATION_READ",
  "CONFIG_WRITE",
  "USER_READ",
  "USER_WRITE",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = ["ADMIN", "SALES", "WAREHOUSE", "ACCOUNTS"] as const;

export type Role = (typeof ROLES)[number];

/** What each role is for, as described on the backend enum. Shown in the UI. */
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: "Full access, including settings and user management. Typically the owner.",
  SALES: "Customers, quotations and orders. Cannot move stock or issue credit.",
  WAREHOUSE: "Dispatches and receives goods. Reads orders; no financial access.",
  ACCOUNTS: "Credit notes, deposits and reporting. Cannot create orders or move stock.",
};

/** The marker authority every admin token carries, separating identity spaces. */
export const PRINCIPAL_ADMIN = "PRINCIPAL_ADMIN";
