import { CreditNotesPage } from "@/features/credit-notes";
import { RequirePermission } from "@/components/require-permission";

export default function Page() {
  return (
    <RequirePermission permission="CREDIT_NOTE_READ">
      <CreditNotesPage />
    </RequirePermission>
  );
}
