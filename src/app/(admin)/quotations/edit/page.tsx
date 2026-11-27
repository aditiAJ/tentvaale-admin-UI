import { Suspense } from "react";
import { EditQuotationPage } from "@/features/quotations";
import { RequirePermission } from "@/components/require-permission";

/** `?id=` names the quotation, the same way the quotations route takes one. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await searchParams;

  return (
    <RequirePermission permission={["QUOTATION_EDIT_DRAFT", "QUOTATION_EDIT_SENT"]}>
      <Suspense>
        <EditQuotationPage quotationId={typeof id === "string" ? id : ""} />
      </Suspense>
    </RequirePermission>
  );
}
