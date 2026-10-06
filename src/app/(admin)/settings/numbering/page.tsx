import { NumberingPage } from "@/features/settings";
import { RequirePermission } from "@/components/require-permission";

export default function Page() {
  return (
    <RequirePermission permission="CONFIG_WRITE">
      <NumberingPage />
    </RequirePermission>
  );
}
