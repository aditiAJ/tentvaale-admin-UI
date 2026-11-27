import { PaymentSetupPage } from "@/features/master-data";
import { RequirePermission } from "@/components/require-permission";

export default function Page() {
  return (
    <RequirePermission permission="PAYMENT_SETUP_VIEW">
      <PaymentSetupPage />
    </RequirePermission>
  );
}
