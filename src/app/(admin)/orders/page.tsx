import { OrdersPage } from "@/features/orders";
import { RequirePermission } from "@/components/require-permission";

/**
 * `?status=` and `?id=` for the same reason the quotations route takes them —
 * see that page. `?id=` is also what conversion, deposits and credit notes
 * already link to.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id, status } = await searchParams;

  return (
    <RequirePermission permission="ORDER_READ">
      <OrdersPage
        orderId={typeof id === "string" ? id : ""}
        status={typeof status === "string" ? status : ""}
      />
    </RequirePermission>
  );
}
