import { Suspense } from "react";
import { SettingsPage } from "@/features/settings";
import { RequirePermission } from "@/components/require-permission";

export default function Page() {
  return (
    <RequirePermission permission="MASTER_DATA_READ">
      <Suspense fallback={null}>
        <SettingsPage />
      </Suspense>
    </RequirePermission>
  );
}
