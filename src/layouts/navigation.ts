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
        icon: Tags,
        permission: "MASTER_DATA_READ",
        status: "planned",
        note: "md_category exists in the schema, but no controller lists or creates categories.",
      },
      {
        label: "Bundles",
        icon: Shapes,
        permission: "MASTER_DATA_READ",
        status: "planned",
        note: "Not carried over from the legacy admin yet — no tables or endpoints.",
      },
      {
        label: "Customers",
        icon: Users,
        permission: "MASTER_DATA_READ",
        status: "planned",
        note: "No customer master endpoints on the backend yet.",
      },
      {
        label: "Warehouses",
        icon: Warehouse,
        permission: "MASTER_DATA_READ",
        status: "planned",
        note: "Per-warehouse stock is not modelled in the rebuild yet.",
      },
      {
        label: "Trucks",
        icon: Truck,
        permission: "MASTER_DATA_READ",
        status: "planned",
        note: "Truck master and load calculation are not rebuilt yet.",
      },
    ],
  },
  {
    label: "Sales",
    items: [
      {
        label: "Quotations",
        icon: FileText,
        permission: "QUOTATION_READ",
        status: "planned",
        note: "Create and get-by-id exist, but there is no list endpoint to build a screen on.",
      },
      {
        label: "Orders",
        icon: ClipboardList,
        permission: "ORDER_READ",
        status: "planned",
        note: "Only create-from-quotation and get-by-id exist; no list endpoint.",
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        label: "Stock movement",
        icon: Boxes,
        permission: "INVENTORY_READ",
        status: "planned",
        note: "Movements can be recorded and listed per order, but not browsed.",
      },
      {
        label: "Availability",
        icon: Warehouse,
        permission: "INVENTORY_READ",
        status: "planned",
        note: "The availability model from the legacy admin is not rebuilt yet.",
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
        icon: Receipt,
        permission: "CREDIT_NOTE_READ",
        status: "planned",
        note: "Issue and per-customer reads exist; there is no company-wide list yet.",
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
