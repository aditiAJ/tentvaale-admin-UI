import { WarehousesPage } from "@/features/master-data";
import { RequirePermission } from "@/components/require-permission";

export default function Page() {
  return (
    <RequirePermission permission="WAREHOUSE_VIEW">
      <WarehousesPage />
    </RequirePermission>
  );
}
