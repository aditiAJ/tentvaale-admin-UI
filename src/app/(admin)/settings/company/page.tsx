import { CompanySettingsPage } from "@/features/settings";
import { RequirePermission } from "@/components/require-permission";

export default function Page() {
  return (
    <RequirePermission permission="MASTER_DATA_READ">
      <CompanySettingsPage />
    </RequirePermission>
  );
}
