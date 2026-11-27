import {
  BarChart3,
  Bell,
  Boxes,
  Building2,
  CalendarDays,
  CreditCard,
  ClipboardList,
  FileText,
  Gem,
  Landmark,
  Package,
  PiggyBank,
  Receipt,
  Settings,
  Shapes,
  Tags,
  Truck,
  Users,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/services/permissions";

/**
 * The whole back-office information architecture, not just the parts that work.
 *
 * `status: "ready"` means the screen exists. Whether a real endpoint is behind
 * it, or only the mock, is recorded in the README's table, not here.
 * `status: "planned"` means there is no screen for it yet — those
 * render as disabled rows carrying the reason, rather than as links to a page
 * that would only apologise. Showing them is deliberate: the shape of the
 * finished system stays visible, and the gap between it and today stays
 * impossible to mistake for a bug.
 *
 * Every item names the permission that governs it, so each person sees the menus
 * their own ticked boxes allow. Settings is open to everyone: its General part
 * holds each person's theme and password, and the company part checks its own box.
 *
 * Order matters: firstAvailableRoute walks this top to bottom to pick a landing
 * page, so the most generally useful screen comes first.
 */
export interface NavItem {
  label: string;
  href?: string;
  icon: LucideIcon;
  permission: Permission;
  status: "ready" | "planned";
  /** Why it is not available. Shown on hover for planned items. */
  note?: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAVIGATION: NavSection[] = [
  {
    label: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: BarChart3,
        permission: "DASHBOARD_VIEW",
        status: "ready",
      },
    ],
  },
  {
    label: "Master data",
    items: [
      {
        label: "Products",
        href: "/master-data/products",
        icon: Package,
        permission: "PRODUCT_VIEW",
        status: "ready",
      },
      {
        label: "Categories",
        href: "/master-data/categories",
        icon: Tags,
        permission: "CATEGORY_VIEW",
        status: "ready",
      },
      {
        label: "Bundles",
        href: "/master-data/bundles",
        icon: Shapes,
        permission: "BUNDLE_VIEW",
        status: "ready",
      },
      {
        label: "Featured collections",
        href: "/master-data/featured-collections",
        icon: Gem,
        permission: "COLLECTION_VIEW",
        status: "ready",
      },
      {
        label: "Customers",
        href: "/master-data/customers",
        icon: Users,
        permission: "CUSTOMER_VIEW",
        status: "ready",
      },
      {
        label: "Warehouses",
        href: "/master-data/warehouses",
        icon: Warehouse,
        permission: "WAREHOUSE_VIEW",
        status: "ready",
      },
      {
        label: "Suppliers",
        href: "/master-data/suppliers",
        icon: Building2,
        permission: "SUPPLIER_VIEW",
        status: "ready",
      },
      {
        label: "Trucks",
        href: "/master-data/trucks",
        icon: Truck,
        permission: "TRUCK_VIEW",
        status: "ready",
      },
      {
        label: "Payment setup",
        href: "/master-data/payment",
        icon: Wallet,
        permission: "PAYMENT_SETUP_VIEW",
        status: "ready",
      },
    ],
  },
  {
    label: "Sales",
    items: [
      {
        label: "Quotations",
        href: "/quotations",
        icon: FileText,
        permission: "QUOTATION_VIEW",
        status: "ready",
      },
      {
        label: "Orders",
        href: "/orders",
        icon: ClipboardList,
        permission: "ORDER_VIEW",
        status: "ready",
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        label: "Event calendar",
        href: "/event-calendar",
        icon: CalendarDays,
        permission: "ORDER_VIEW",
        status: "ready",
      },
      {
        label: "Stock movement",
        href: "/inventory/stock-movements",
        icon: Boxes,
        permission: "STOCK_VIEW",
        status: "ready",
      },
      {
        label: "Availability",
        href: "/inventory/availability",
        icon: Warehouse,
        permission: "STOCK_VIEW",
        status: "ready",
      },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        label: "Payments",
        href: "/billing/payments",
        icon: Landmark,
        permission: "PAYMENT_VIEW",
        status: "ready",
      },
      {
        label: "Online payments",
        href: "/billing/online",
        icon: CreditCard,
        permission: "PAYMENT_VIEW",
        status: "ready",
      },
      {
        label: "Deposits",
        href: "/deposits",
        icon: PiggyBank,
        permission: "DEPOSIT_VIEW",
        status: "ready",
      },
      {
        label: "Credit notes",
        href: "/credit-notes",
        icon: Receipt,
        permission: "CREDIT_NOTE_VIEW",
        status: "ready",
      },
    ],
  },
  {
    label: "Communications",
    items: [
      {
        label: "Notifications",
        href: "/notifications",
        icon: Bell,
        permission: "NOTIFICATION_VIEW",
        status: "ready",
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        label: "Users",
        href: "/users",
        icon: Users,
        permission: "USER_READ",
        status: "ready",
      },
      {
        label: "Settings",
        href: "/settings",
        icon: Settings,
        permission: "OWN_PASSWORD_CHANGE",
        status: "ready",
      },
    ],
  },
];

/** The first route the signed-in user is actually allowed to open. */
export function firstAvailableRoute(permissions: Permission[]): string | null {
  for (const section of NAVIGATION) {
    for (const item of section.items) {
      if (item.status === "ready" && item.href && permissions.includes(item.permission)) {
        return item.href;
      }
    }
  }
  return null;
}
