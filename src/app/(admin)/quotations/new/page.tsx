import { QuotationForm } from "@/features/quotations";
import { RequirePermission } from "@/components/require-permission";

export default function Page() {
  return (
    <RequirePermission permission="QUOTATION_WRITE">
      <QuotationForm />
    </RequirePermission>
  );
}
