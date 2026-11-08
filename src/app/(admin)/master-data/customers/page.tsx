import { Suspense } from "react";
import { CustomersPage } from "@/features/master-data";
import { RequirePermission } from "@/components/require-permission";

export default function Page() {
  return (
    <RequirePermission permission="MASTER_DATA_READ">
      {/* useSearchParams (the "Add customer" hand-off from a quotation) needs a Suspense boundary above it. */}
      <Suspense>
        <CustomersPage />
      </Suspense>
    </RequirePermission>
  );
}
