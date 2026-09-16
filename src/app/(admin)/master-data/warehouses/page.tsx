import { WarehousesPage } from "@/features/master-data";
import { RequirePermission } from "@/components/require-permission";

export default function Page() {
  return (
    <RequirePermission permission="MASTER_DATA_READ">
      <WarehousesPage />
    </RequirePermission>
  );
}
