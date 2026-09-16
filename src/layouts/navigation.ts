import {
  BarChart3,
  Bell,
  Boxes,
  ClipboardList,
  FileText,
  Package,
  PiggyBank,
  Receipt,
  Shapes,
  Tags,
  Truck,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/services/permissions";

/**
 * The whole back-office information architecture, not just the parts that work.
 *
 * `status: "ready"` means the screen exists and talks to a real endpoint.
 * `status: "planned"` means the backend has no endpoint for it yet — those
 * render as disabled rows carrying the reason, rather than as links to a page
 * that would only apologise. Showing them is deliberate: the shape of the
 * finished system stays visible, and the gap between it and today stays
 * impossible to mistake for a bug.
 *
 * Every item names the permission that governs it, so a WAREHOUSE user and an
 * ACCOUNTS user see different menus from the same build.
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
        permission: "REPORTING_READ",
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
        permission: "MASTER_DATA_READ",
        status: "ready",
      },
      {
        label: "Categories",
        href: "/master-data/categories",
        icon: Tags,
        permission: "MASTER_DATA_READ",
        status: "ready",
      },
      {
        label: "Bundles",
        href: "/master-data/bundles",
        icon: Shapes,
        permission: "MASTER_DATA_READ",
        status: "ready",
      },
      {
        label: "Customers",
        href: "/master-data/customers",
        icon: Users,
        permission: "MASTER_DATA_READ",
        status: "ready",
      },
      {
        label: "Warehouses",
        href: "/master-data/warehouses",
        icon: Warehouse,
        permission: "MASTER_DATA_READ",
        status: "ready",
      },
      {
        label: "Trucks",
        href: "/master-data/trucks",
        icon: Truck,
        permission: "MASTER_DATA_READ",
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
        permission: "QUOTATION_READ",
        status: "ready",
      },
      {
        label: "Orders",
        href: "/orders",
        icon: ClipboardList,
        permission: "ORDER_READ",
        status: "ready",
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        label: "Stock movement",
        href: "/inventory/stock-movements",
        icon: Boxes,
        permission: "INVENTORY_READ",
        status: "ready",
      },
      {
        label: "Availability",
        href: "/inventory/availability",
        icon: Warehouse,
        permission: "INVENTORY_READ",
        status: "ready",
      },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        label: "Deposits",
        href: "/deposits",
        icon: PiggyBank,
        permission: "DEPOSIT_READ",
        status: "ready",
      },
      {
        label: "Credit notes",
        href: "/credit-notes",
        icon: Receipt,
        permission: "CREDIT_NOTE_READ",
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
        permission: "NOTIFICATION_READ",
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
