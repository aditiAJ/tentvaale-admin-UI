import { OrdersPage } from "@/features/orders";
import { RequirePermission } from "@/components/require-permission";

/** `?id=` for the same reason the quotations route takes one — see that page. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await searchParams;

  return (
    <RequirePermission permission="ORDER_READ">
      <OrdersPage initialOrderId={typeof id === "string" ? id : ""} />
    </RequirePermission>
  );
}
