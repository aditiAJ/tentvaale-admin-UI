import { TrucksPage } from "@/features/master-data";
import { RequirePermission } from "@/components/require-permission";

export default function Page() {
  return (
    <RequirePermission permission="TRUCK_VIEW">
      <TrucksPage />
    </RequirePermission>
  );
}
