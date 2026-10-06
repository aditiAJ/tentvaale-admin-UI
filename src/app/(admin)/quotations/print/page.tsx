import { QuotationPrintPage } from "@/features/quotations/components/QuotationPrintPage";
import { RequirePermission } from "@/components/require-permission";

/** `?id=` names the quotation, as on the quotations route. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await searchParams;
  return (
    <RequirePermission permission="QUOTATION_READ">
      <QuotationPrintPage quotationId={typeof id === "string" ? id : ""} />
    </RequirePermission>
  );
}
