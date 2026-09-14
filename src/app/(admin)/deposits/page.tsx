import { DepositsPage } from "@/features/deposits";
import { RequirePermission } from "@/components/require-permission";

export default function Page() {
  return (
    <RequirePermission permission="DEPOSIT_READ">
      <DepositsPage />
    </RequirePermission>
  );
}
