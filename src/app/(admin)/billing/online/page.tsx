import { OnlinePaymentsPage } from "@/features/payments";
import { RequirePermission } from "@/components/require-permission";

export default function Page() {
  return (
    <RequirePermission permission="PAYMENT_READ">
      <OnlinePaymentsPage />
    </RequirePermission>
  );
}
