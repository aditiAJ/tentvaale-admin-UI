import { OrdersPage } from "@/features/orders";
import { RequirePermission } from "@/components/require-permission";

export default function Page() {
  return (
    <RequirePermission permission="ORDER_READ">
      <OrdersPage />
    </RequirePermission>
  );
}
