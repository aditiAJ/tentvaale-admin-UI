import { DispatchPrintPage } from "@/features/orders/dispatch/DispatchPrintPage";
import { RequirePermission } from "@/components/require-permission";

/** `?id=` names the order, as on the orders route; `?kind=pictures` picks the picture sheet, anything else the list. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id, kind } = await searchParams;
  return (
    <RequirePermission permission="ORDER_READ">
      <DispatchPrintPage orderId={typeof id === "string" ? id : ""} edition={kind === "pictures" ? "pictures" : "list"} />
    </RequirePermission>
  );
}
