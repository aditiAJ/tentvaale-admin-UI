import { Suspense } from "react";
import { QuotationForm } from "@/features/quotations";
import { RequirePermission } from "@/components/require-permission";

export default function Page() {
  return (
    <RequirePermission permission="QUOTATION_ADD">
      {/* useSearchParams (coming back from adding a customer) needs a Suspense boundary above it. */}
      <Suspense>
        <QuotationForm />
      </Suspense>
    </RequirePermission>
  );
}
