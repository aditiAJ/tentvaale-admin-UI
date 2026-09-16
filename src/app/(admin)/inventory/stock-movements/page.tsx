import { StockMovementsPage } from "@/features/inventory";
import { RequirePermission } from "@/components/require-permission";

export default function Page() {
  return (
    <RequirePermission permission="INVENTORY_READ">
      <StockMovementsPage />
    </RequirePermission>
  );
}
