import { PaymentQueuePage } from "@/features/billing";
import { RequirePermission } from "@/components/require-permission";

export default function Page() {
  return (
    <RequirePermission permission="PAYMENT_READ">
      <PaymentQueuePage />
    </RequirePermission>
  );
}
