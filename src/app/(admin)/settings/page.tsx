import { Suspense } from "react";
import { SettingsPage } from "@/features/settings";
import { RequirePermission } from "@/components/require-permission";

export default function Page() {
  return (
    <RequirePermission permission="OWN_PASSWORD_CHANGE">
      <Suspense fallback={null}>
        <SettingsPage />
      </Suspense>
    </RequirePermission>
  );
}
