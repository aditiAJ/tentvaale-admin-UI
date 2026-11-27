import { DashboardPage } from "@/features/dashboard";
import { RequirePermission } from "@/components/require-permission";

export default function Page() {
  return (
    <RequirePermission permission="DASHBOARD_VIEW">
      <DashboardPage />
    </RequirePermission>
  );
}
