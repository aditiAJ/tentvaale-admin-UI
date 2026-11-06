import { DispatchPrintPage } from "@/features/orders/dispatch/DispatchPrintPage";
import { RequirePermission } from "@/components/require-permission";

/** `?id=` names the order, as on the orders route. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await searchParams;
  return (
    <RequirePermission permission="ORDER_READ">
      <DispatchPrintPage orderId={typeof id === "string" ? id : ""} />
    </RequirePermission>
  );
}
