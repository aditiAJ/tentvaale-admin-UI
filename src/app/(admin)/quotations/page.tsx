import { QuotationsPage } from "@/features/quotations";
import { RequirePermission } from "@/components/require-permission";

/**
 * `?status=` is the workspace's filter and `?id=` the quotation open in it, so
 * a filter or a quotation can be linked to, reloaded, and stepped back out of
 * with the browser. `?id=` is also what creating, editing and an order's
 * "converted from" link already point at. Both are read here, on the server
 * component, rather than with useSearchParams below, so the client subtree
 * does not need a Suspense boundary the way the login page does.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id, status } = await searchParams;

  return (
    <RequirePermission permission="QUOTATION_READ">
      <QuotationsPage
        quotationId={typeof id === "string" ? id : ""}
        status={typeof status === "string" ? status : ""}
      />
    </RequirePermission>
  );
}
