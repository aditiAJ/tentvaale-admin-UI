import { NotificationsPage } from "@/features/notifications";
import { RequirePermission } from "@/components/require-permission";

export default function Page() {
  return (
    <RequirePermission permission="NOTIFICATION_READ">
      <NotificationsPage />
    </RequirePermission>
  );
}
