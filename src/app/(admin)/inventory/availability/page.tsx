import { AvailabilityPage } from "@/features/inventory";
import { RequirePermission } from "@/components/require-permission";

export default function Page() {
  return (
    <RequirePermission permission="STOCK_VIEW">
      <AvailabilityPage />
    </RequirePermission>
  );
}
