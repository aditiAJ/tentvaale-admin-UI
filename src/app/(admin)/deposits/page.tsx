import { DepositsPage } from "@/features/deposits";
import { RequirePermission } from "@/components/require-permission";

/** `?orderId=` opens straight onto one order's deposit — the order screen links here. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { orderId } = await searchParams;

  return (
    <RequirePermission permission="DEPOSIT_READ">
      <DepositsPage initialOrderId={typeof orderId === "string" ? orderId : ""} />
    </RequirePermission>
  );
}
