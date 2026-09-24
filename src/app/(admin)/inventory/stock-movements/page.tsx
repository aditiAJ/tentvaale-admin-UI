import { StockMovementsPage } from "@/features/inventory";
import { RequirePermission } from "@/components/require-permission";

/** `?orderId=` opens straight onto one order's movements — the order screen links here. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { orderId } = await searchParams;

  return (
    <RequirePermission permission="INVENTORY_READ">
      <StockMovementsPage initialOrderId={typeof orderId === "string" ? orderId : ""} />
    </RequirePermission>
  );
}
