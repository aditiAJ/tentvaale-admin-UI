import { ClipboardList, IndianRupee, ShieldCheck, Truck, Warehouse, type LucideIcon } from "lucide-react";
import type { Role } from "@/services/permissions";

/** The picture and the few words each job title is recognised by, shared by the users list and the access form. */
export const ROLE_STYLE: Record<Role, { icon: LucideIcon; summary: string }> = {
  ADMIN: { icon: ShieldCheck, summary: "Full access" },
  SALES: { icon: ClipboardList, summary: "Quotes and orders" },
  OPERATIONS: { icon: Truck, summary: "Dispatch and delivery" },
  ACCOUNTS: { icon: IndianRupee, summary: "Payments and invoices" },
  WAREHOUSE: { icon: Warehouse, summary: "Stock and trucks" },
};
