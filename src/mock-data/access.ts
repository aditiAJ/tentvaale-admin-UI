import type { AccessOptions } from "@/features/users/types";
import type { Permission, Role } from "@/services/permissions";

/**
 * Demo mode only: a copy of what the server answers at /admin/users/access-options, because there is no server to ask.
 * Generated from the backend's Permission and Role; regenerate it when those change.
 */
export const MOCK_ACCESS_OPTIONS: AccessOptions = {
  modules: [
    {
      group: "Overview",
      title: "Dashboard",
      boxes: [
        { permission: "DASHBOARD_VIEW", label: "View", description: "The dashboard", sensitive: false, requires: [] },
      ],
    },
    {
      group: "Master data",
      title: "Products",
      boxes: [
        { permission: "PRODUCT_VIEW", label: "View", description: "Products menu and screens", sensitive: false, requires: [] },
        { permission: "PRODUCT_ADD", label: "Add", description: "New product, with its variants and pictures", sensitive: false, requires: ["PRODUCT_VIEW"] },
        { permission: "PRODUCT_EDIT", label: "Edit", description: "Change, activate and restore products and variants", sensitive: false, requires: ["PRODUCT_VIEW"] },
        { permission: "PRODUCT_DELETE", label: "Delete", description: "Delete, archive or deactivate a product or variant", sensitive: true, requires: ["PRODUCT_VIEW"] },
      ],
    },
    {
      group: "Master data",
      title: "Categories",
      boxes: [
        { permission: "CATEGORY_VIEW", label: "View", description: "Categories menu", sensitive: false, requires: [] },
        { permission: "CATEGORY_ADD", label: "Add", description: "Category, sub-category, filter, filter value, occasion", sensitive: false, requires: ["CATEGORY_VIEW"] },
        { permission: "CATEGORY_EDIT", label: "Edit", description: "Change, activate, restore, show", sensitive: false, requires: ["CATEGORY_VIEW"] },
        { permission: "CATEGORY_DELETE", label: "Delete", description: "Delete, archive, deactivate, hide", sensitive: true, requires: ["CATEGORY_VIEW"] },
      ],
    },
    {
      group: "Master data",
      title: "Bundles",
      boxes: [
        { permission: "BUNDLE_VIEW", label: "View", description: "Bundles menu", sensitive: false, requires: [] },
        { permission: "BUNDLE_ADD", label: "Add", description: "New bundle", sensitive: false, requires: ["BUNDLE_VIEW"] },
        { permission: "BUNDLE_EDIT", label: "Edit", description: "Change, activate, feature, unfeature", sensitive: false, requires: ["BUNDLE_VIEW"] },
        { permission: "BUNDLE_DELETE", label: "Delete", description: "Delete or deactivate", sensitive: true, requires: ["BUNDLE_VIEW"] },
      ],
    },
    {
      group: "Master data",
      title: "Featured collections",
      boxes: [
        { permission: "COLLECTION_VIEW", label: "View", description: "Featured collections menu", sensitive: false, requires: [] },
        { permission: "COLLECTION_ADD", label: "Add", description: "New collection", sensitive: false, requires: ["COLLECTION_VIEW"] },
        { permission: "COLLECTION_EDIT", label: "Edit", description: "Change and activate", sensitive: false, requires: ["COLLECTION_VIEW"] },
        { permission: "COLLECTION_DELETE", label: "Delete", description: "Deactivate", sensitive: true, requires: ["COLLECTION_VIEW"] },
      ],
    },
    {
      group: "Master data",
      title: "Customers",
      boxes: [
        { permission: "CUSTOMER_VIEW", label: "View", description: "Customers menu", sensitive: false, requires: [] },
        { permission: "CUSTOMER_ADD", label: "Add", description: "New customer", sensitive: false, requires: ["CUSTOMER_VIEW"] },
        { permission: "CUSTOMER_EDIT", label: "Edit", description: "Customer details and discounts", sensitive: false, requires: ["CUSTOMER_VIEW"] },
        { permission: "CUSTOMER_DELETE", label: "Delete", description: "Delete a customer", sensitive: true, requires: ["CUSTOMER_VIEW"] },
        { permission: "CUSTOMER_APPROVE_PLANNER", label: "Approve planners", description: "Approve or reject an event planner", sensitive: false, requires: ["CUSTOMER_VIEW"] },
      ],
    },
    {
      group: "Master data",
      title: "Warehouses",
      boxes: [
        { permission: "WAREHOUSE_VIEW", label: "View", description: "Warehouses menu and layout", sensitive: false, requires: [] },
        { permission: "WAREHOUSE_ADD", label: "Add", description: "New warehouse", sensitive: false, requires: ["WAREHOUSE_VIEW"] },
        { permission: "WAREHOUSE_EDIT", label: "Edit", description: "Warehouse and storage location details", sensitive: false, requires: ["WAREHOUSE_VIEW"] },
        { permission: "WAREHOUSE_DELETE", label: "Delete", description: "Delete or deactivate a warehouse or location", sensitive: true, requires: ["WAREHOUSE_VIEW"] },
        { permission: "WAREHOUSE_STOCK", label: "Update stock", description: "Stock numbers, add locations, place and move stock", sensitive: false, requires: ["WAREHOUSE_VIEW"] },
      ],
    },
    {
      group: "Master data",
      title: "Trucks",
      boxes: [
        { permission: "TRUCK_VIEW", label: "View", description: "Trucks menu", sensitive: false, requires: [] },
        { permission: "TRUCK_ADD", label: "Add", description: "New truck", sensitive: false, requires: ["TRUCK_VIEW"] },
        { permission: "TRUCK_EDIT", label: "Edit", description: "Truck details and maintenance", sensitive: false, requires: ["TRUCK_VIEW"] },
        { permission: "TRUCK_DELETE", label: "Delete", description: "Delete or deactivate a truck", sensitive: true, requires: ["TRUCK_VIEW"] },
      ],
    },
    {
      group: "Master data",
      title: "Suppliers",
      boxes: [
        { permission: "SUPPLIER_VIEW", label: "View", description: "Suppliers menu", sensitive: false, requires: [] },
        { permission: "SUPPLIER_ADD", label: "Add", description: "New supplier", sensitive: false, requires: ["SUPPLIER_VIEW"] },
        { permission: "SUPPLIER_EDIT", label: "Edit", description: "Supplier details", sensitive: false, requires: ["SUPPLIER_VIEW"] },
        { permission: "SUPPLIER_DELETE", label: "Delete", description: "Deactivate a supplier", sensitive: true, requires: ["SUPPLIER_VIEW"] },
        { permission: "SUPPLIER_STOCK", label: "Update stock", description: "Supplier stock and rate", sensitive: false, requires: ["SUPPLIER_VIEW"] },
      ],
    },
    {
      group: "Master data",
      title: "Payment setup",
      boxes: [
        { permission: "PAYMENT_SETUP_VIEW", label: "View", description: "Payment setup menu", sensitive: false, requires: [] },
        { permission: "PAYMENT_SETUP_ADD", label: "Add", description: "New payment mode or terms", sensitive: false, requires: ["PAYMENT_SETUP_VIEW"] },
        { permission: "PAYMENT_SETUP_EDIT", label: "Edit", description: "Change and activate", sensitive: false, requires: ["PAYMENT_SETUP_VIEW"] },
        { permission: "PAYMENT_SETUP_DELETE", label: "Delete", description: "Deactivate", sensitive: true, requires: ["PAYMENT_SETUP_VIEW"] },
      ],
    },
    {
      group: "Sales",
      title: "Quotations",
      boxes: [
        { permission: "QUOTATION_VIEW", label: "View", description: "List, details, versions and PDF", sensitive: false, requires: [] },
        { permission: "QUOTATION_ADD", label: "Add", description: "New quotation and duplicate", sensitive: false, requires: ["QUOTATION_VIEW"] },
        { permission: "QUOTATION_EDIT_DRAFT", label: "Edit draft", description: "Items, price, venue and date while it is a draft", sensitive: false, requires: ["QUOTATION_VIEW"] },
        { permission: "QUOTATION_EDIT_SENT", label: "Edit after sending", description: "The same on a sent or accepted quotation", sensitive: false, requires: ["QUOTATION_VIEW", "QUOTATION_EDIT_DRAFT"] },
        { permission: "QUOTATION_SEND", label: "Send", description: "Send to the customer", sensitive: false, requires: ["QUOTATION_VIEW"] },
        { permission: "QUOTATION_ACCEPT", label: "Accept", description: "Accept, including on the customer's behalf", sensitive: false, requires: ["QUOTATION_VIEW", "ORDER_VIEW"] },
        { permission: "QUOTATION_CLOSE", label: "Close", description: "Reject or close", sensitive: false, requires: ["QUOTATION_VIEW"] },
        { permission: "QUOTATION_WAIVE_DEPOSIT", label: "Waive deposit", description: "Do not collect the security deposit", sensitive: true, requires: ["QUOTATION_VIEW"] },
      ],
    },
    {
      group: "Sales",
      title: "Orders",
      boxes: [
        { permission: "ORDER_VIEW", label: "View", description: "Orders, event calendar, dispatch list and delivery challan", sensitive: false, requires: [] },
        { permission: "ORDER_CONVERT", label: "Convert", description: "Turn an accepted quotation into an order", sensitive: false, requires: ["ORDER_VIEW", "QUOTATION_VIEW"] },
        { permission: "ORDER_PROGRESS", label: "Install and complete", description: "Start installation and complete an order", sensitive: false, requires: ["ORDER_VIEW"] },
        { permission: "ORDER_EDIT", label: "Edit", description: "Venue or event date of a confirmed order", sensitive: false, requires: ["ORDER_VIEW", "QUOTATION_VIEW"] },
        { permission: "ORDER_CANCEL", label: "Cancel", description: "Cancel an order", sensitive: true, requires: ["ORDER_VIEW"] },
      ],
    },
    {
      group: "Operations",
      title: "Stock and dispatch",
      boxes: [
        { permission: "STOCK_VIEW", label: "View", description: "Stock movement and availability screens", sensitive: false, requires: [] },
        { permission: "STOCK_MOVE", label: "Dispatch and return", description: "Record stock movements", sensitive: false, requires: ["STOCK_VIEW", "ORDER_VIEW"] },
      ],
    },
    {
      group: "Finance",
      title: "Payments",
      boxes: [
        { permission: "PAYMENT_VIEW", label: "View", description: "Payments, history and online payments", sensitive: false, requires: [] },
        { permission: "PAYMENT_ADD", label: "Add", description: "Record a payment with its proof", sensitive: false, requires: ["PAYMENT_VIEW", "ORDER_VIEW"] },
        { permission: "PAYMENT_VERIFY", label: "Verify", description: "Verify or reject; check and convert online payments", sensitive: false, requires: ["PAYMENT_VIEW", "ORDER_VIEW"] },
        { permission: "PAYMENT_SCHEDULE", label: "Instalments", description: "Set instalment dates", sensitive: false, requires: ["PAYMENT_VIEW", "ORDER_VIEW"] },
        { permission: "PAYMENT_EDIT", label: "Edit", description: "Change a recorded payment", sensitive: false, requires: ["PAYMENT_VIEW"] },
        { permission: "PAYMENT_VOID", label: "Void", description: "Void a verified payment or dismiss an online one", sensitive: true, requires: ["PAYMENT_VIEW"] },
        { permission: "PAYMENT_REFUND", label: "Refund online", description: "Send money back through the gateway", sensitive: true, requires: ["PAYMENT_VIEW"] },
      ],
    },
    {
      group: "Finance",
      title: "Invoices",
      boxes: [
        { permission: "INVOICE_VIEW", label: "View", description: "Invoices and documents", sensitive: false, requires: [] },
        { permission: "INVOICE_ISSUE", label: "Issue", description: "Tax invoice and final invoice", sensitive: false, requires: ["INVOICE_VIEW", "ORDER_VIEW"] },
      ],
    },
    {
      group: "Finance",
      title: "Deposits",
      boxes: [
        { permission: "DEPOSIT_VIEW", label: "View", description: "Deposits", sensitive: false, requires: [] },
        { permission: "DEPOSIT_SETTLE", label: "Refund and forfeit", description: "Request a refund, confirm it, or forfeit", sensitive: false, requires: ["DEPOSIT_VIEW"] },
      ],
    },
    {
      group: "Finance",
      title: "Credit notes",
      boxes: [
        { permission: "CREDIT_NOTE_VIEW", label: "View", description: "Credit notes", sensitive: false, requires: [] },
        { permission: "CREDIT_NOTE_ISSUE", label: "Issue and apply", description: "Issue and apply a credit note", sensitive: false, requires: ["CREDIT_NOTE_VIEW"] },
        { permission: "CREDIT_NOTE_CANCEL", label: "Cancel and reverse", description: "Cancel or reverse a credit note", sensitive: true, requires: ["CREDIT_NOTE_VIEW"] },
      ],
    },
    {
      group: "Other",
      title: "Notifications",
      boxes: [
        { permission: "NOTIFICATION_VIEW", label: "View", description: "Notification log", sensitive: false, requires: [] },
        { permission: "NOTIFICATION_RETRY", label: "Retry", description: "Send a failed email again", sensitive: false, requires: ["NOTIFICATION_VIEW"] },
      ],
    },
    {
      group: "Other",
      title: "Settings",
      boxes: [
        { permission: "SETTINGS_VIEW", label: "View", description: "Company profile, tax, bank, numbering and policies", sensitive: false, requires: [] },
        { permission: "SETTINGS_EDIT", label: "Edit", description: "Change company settings and the storefront hero picture", sensitive: true, requires: ["SETTINGS_VIEW"] },
      ],
    },
  ],
  roleDefaults: {
    ADMIN: [
      "DASHBOARD_VIEW", "PRODUCT_VIEW", "PRODUCT_ADD", "PRODUCT_EDIT", "PRODUCT_DELETE",
      "CATEGORY_VIEW", "CATEGORY_ADD", "CATEGORY_EDIT", "CATEGORY_DELETE", "BUNDLE_VIEW",
      "BUNDLE_ADD", "BUNDLE_EDIT", "BUNDLE_DELETE", "COLLECTION_VIEW", "COLLECTION_ADD",
      "COLLECTION_EDIT", "COLLECTION_DELETE", "CUSTOMER_VIEW", "CUSTOMER_ADD", "CUSTOMER_EDIT",
      "CUSTOMER_DELETE", "CUSTOMER_APPROVE_PLANNER", "WAREHOUSE_VIEW", "WAREHOUSE_ADD",
      "WAREHOUSE_EDIT", "WAREHOUSE_DELETE", "WAREHOUSE_STOCK", "TRUCK_VIEW", "TRUCK_ADD",
      "TRUCK_EDIT", "TRUCK_DELETE", "SUPPLIER_VIEW", "SUPPLIER_ADD", "SUPPLIER_EDIT",
      "SUPPLIER_DELETE", "SUPPLIER_STOCK", "PAYMENT_SETUP_VIEW", "PAYMENT_SETUP_ADD",
      "PAYMENT_SETUP_EDIT", "PAYMENT_SETUP_DELETE", "QUOTATION_VIEW", "QUOTATION_ADD",
      "QUOTATION_EDIT_DRAFT", "QUOTATION_EDIT_SENT", "QUOTATION_SEND", "QUOTATION_ACCEPT",
      "QUOTATION_CLOSE", "QUOTATION_WAIVE_DEPOSIT", "ORDER_VIEW", "ORDER_CONVERT",
      "ORDER_PROGRESS", "ORDER_EDIT", "ORDER_CANCEL", "STOCK_VIEW", "STOCK_MOVE", "PAYMENT_VIEW",
      "PAYMENT_ADD", "PAYMENT_VERIFY", "PAYMENT_SCHEDULE", "PAYMENT_EDIT", "PAYMENT_VOID",
      "PAYMENT_REFUND", "INVOICE_VIEW", "INVOICE_ISSUE", "DEPOSIT_VIEW", "DEPOSIT_SETTLE",
      "CREDIT_NOTE_VIEW", "CREDIT_NOTE_ISSUE", "CREDIT_NOTE_CANCEL", "NOTIFICATION_VIEW",
      "NOTIFICATION_RETRY", "SETTINGS_VIEW", "SETTINGS_EDIT",
    ],
    SALES: [
      "DASHBOARD_VIEW", "PRODUCT_VIEW", "BUNDLE_VIEW", "CUSTOMER_VIEW", "CUSTOMER_ADD",
      "QUOTATION_VIEW", "QUOTATION_ADD", "QUOTATION_EDIT_DRAFT", "QUOTATION_SEND", "ORDER_VIEW",
      "ORDER_CONVERT", "STOCK_VIEW", "PAYMENT_VIEW", "INVOICE_VIEW", "DEPOSIT_VIEW",
      "CREDIT_NOTE_VIEW", "NOTIFICATION_VIEW",
    ],
    OPERATIONS: [
      "DASHBOARD_VIEW", "PRODUCT_VIEW", "BUNDLE_VIEW", "WAREHOUSE_VIEW", "WAREHOUSE_ADD",
      "WAREHOUSE_STOCK", "TRUCK_VIEW", "TRUCK_ADD", "SUPPLIER_VIEW", "SUPPLIER_ADD",
      "SUPPLIER_STOCK", "ORDER_VIEW", "ORDER_PROGRESS", "STOCK_VIEW", "STOCK_MOVE", "PAYMENT_VIEW",
    ],
    ACCOUNTS: [
      "DASHBOARD_VIEW", "PRODUCT_VIEW", "BUNDLE_VIEW", "CUSTOMER_VIEW", "QUOTATION_VIEW",
      "ORDER_VIEW", "PAYMENT_VIEW", "PAYMENT_ADD", "PAYMENT_VERIFY", "PAYMENT_SCHEDULE",
      "INVOICE_VIEW", "INVOICE_ISSUE", "DEPOSIT_VIEW", "DEPOSIT_SETTLE", "CREDIT_NOTE_VIEW",
      "CREDIT_NOTE_ISSUE", "NOTIFICATION_VIEW",
    ],
    WAREHOUSE: [
      "PRODUCT_VIEW", "BUNDLE_VIEW", "WAREHOUSE_VIEW", "WAREHOUSE_ADD", "WAREHOUSE_EDIT",
      "WAREHOUSE_STOCK", "TRUCK_VIEW", "TRUCK_ADD", "TRUCK_EDIT", "SUPPLIER_VIEW", "ORDER_VIEW",
      "STOCK_VIEW", "STOCK_MOVE",
    ],
  },
};

/** Everything a user may do: their ticked boxes (everything for an Administrator) and what everyone has. */
export function mockAccess(role: Role, ticked: Permission[]): Permission[] {
  const everyone: Permission[] = ["OWN_PASSWORD_CHANGE", "MASTER_DATA_READ"];
  return role === "ADMIN"
    ? [...everyone, "USER_READ", "USER_WRITE", ...MOCK_ACCESS_OPTIONS.roleDefaults.ADMIN]
    : [...everyone, ...ticked.filter((p) => !everyone.includes(p))];
}
