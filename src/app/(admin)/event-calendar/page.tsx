import { EventCalendarPage } from "@/features/orders/components/EventCalendarPage";
import { RequirePermission } from "@/components/require-permission";

export default function Page() {
  return (
    <RequirePermission permission="ORDER_READ">
      <EventCalendarPage />
    </RequirePermission>
  );
}
