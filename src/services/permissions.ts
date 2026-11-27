/**
 * The authorisation vocabulary, mirroring com.tentvaale.identity.api.Permission: one name for each tick box on the Users
 * screen, plus the four that are not boxes (the two everyone has, and the two for managing users, which only an
 * Administrator holds).
 *
 * The UI gates on permissions, never on roles, the same rule the backend follows. Which boxes a person has comes from
 * their token; what the access form offers comes from the server (see features/users).
 */
export const PERMISSIONS = [
  "OWN_PASSWORD_CHANGE", "MASTER_DATA_READ", "USER_READ", "USER_WRITE", "DASHBOARD_VIEW",
  "PRODUCT_VIEW", "PRODUCT_ADD", "PRODUCT_EDIT", "PRODUCT_DELETE", "CATEGORY_VIEW", "CATEGORY_ADD",
  "CATEGORY_EDIT", "CATEGORY_DELETE", "BUNDLE_VIEW", "BUNDLE_ADD", "BUNDLE_EDIT", "BUNDLE_DELETE",
  "COLLECTION_VIEW", "COLLECTION_ADD", "COLLECTION_EDIT", "COLLECTION_DELETE", "CUSTOMER_VIEW",
  "CUSTOMER_ADD", "CUSTOMER_EDIT", "CUSTOMER_DELETE", "CUSTOMER_APPROVE_PLANNER", "WAREHOUSE_VIEW",
  "WAREHOUSE_ADD", "WAREHOUSE_EDIT", "WAREHOUSE_DELETE", "WAREHOUSE_STOCK", "TRUCK_VIEW",
  "TRUCK_ADD", "TRUCK_EDIT", "TRUCK_DELETE", "SUPPLIER_VIEW", "SUPPLIER_ADD", "SUPPLIER_EDIT",
  "SUPPLIER_DELETE", "SUPPLIER_STOCK", "PAYMENT_SETUP_VIEW", "PAYMENT_SETUP_ADD",
  "PAYMENT_SETUP_EDIT", "PAYMENT_SETUP_DELETE", "QUOTATION_VIEW", "QUOTATION_ADD",
  "QUOTATION_EDIT_DRAFT", "QUOTATION_EDIT_SENT", "QUOTATION_SEND", "QUOTATION_ACCEPT",
  "QUOTATION_CLOSE", "QUOTATION_WAIVE_DEPOSIT", "ORDER_VIEW", "ORDER_CONVERT", "ORDER_PROGRESS",
  "ORDER_EDIT", "ORDER_CANCEL", "STOCK_VIEW", "STOCK_MOVE", "PAYMENT_VIEW", "PAYMENT_ADD",
  "PAYMENT_VERIFY", "PAYMENT_SCHEDULE", "PAYMENT_EDIT", "PAYMENT_VOID", "PAYMENT_REFUND",
  "INVOICE_VIEW", "INVOICE_ISSUE", "DEPOSIT_VIEW", "DEPOSIT_SETTLE", "CREDIT_NOTE_VIEW",
  "CREDIT_NOTE_ISSUE", "CREDIT_NOTE_CANCEL", "NOTIFICATION_VIEW", "NOTIFICATION_RETRY",
  "SETTINGS_VIEW", "SETTINGS_EDIT",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** The names the code and the server use. Screens show {@link ROLE_LABELS}. */
export const ROLES = ["ADMIN", "SALES", "OPERATIONS", "WAREHOUSE", "ACCOUNTS"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  SALES: "Sales Manager",
  OPERATIONS: "Operations Manager",
  WAREHOUSE: "Warehouse Manager",
  ACCOUNTS: "Accountant",
};

/** What each job title starts with. An Administrator can then tick or untick anything for one person. */
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: "Full access, including users and settings. Typically the owner.",
  SALES: "Starts able to add customers, prepare and send quotations, and turn accepted ones into orders.",
  OPERATIONS:
    "Starts able to run orders through dispatch, installation and completion, add warehouses, trucks and suppliers, and keep stock.",
  WAREHOUSE: "Starts able to add and edit warehouses and trucks, keep stock, and dispatch and receive goods. No money screens.",
  ACCOUNTS: "Starts able to record and verify payments, issue invoices and credit notes, and settle deposits.",
};

/** The label for a role name that may come from an older or newer server. */
export function roleLabel(role: string | null | undefined): string {
  return ROLE_LABELS[role as Role] ?? role ?? "unknown";
}

/** The marker authority every admin token carries, separating identity spaces. */
export const PRINCIPAL_ADMIN = "PRINCIPAL_ADMIN";
