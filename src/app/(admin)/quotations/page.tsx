import { QuotationsPage } from "@/features/quotations";
import { RequirePermission } from "@/components/require-permission";

/**
 * `?id=` lets the screen be linked to, which is what makes "create, then look
 * at what you created" a navigation rather than a second lookup. It is read
 * here, on the server component, rather than with useSearchParams below, so the
 * client subtree does not need a Suspense boundary the way the login page does.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await searchParams;

  return (
    <RequirePermission permission="QUOTATION_READ">
      <QuotationsPage initialQuotationId={typeof id === "string" ? id : ""} />
    </RequirePermission>
  );
}
