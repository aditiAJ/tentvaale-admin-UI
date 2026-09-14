import { UsersPage } from "@/features/users";
import { RequirePermission } from "@/components/require-permission";

export default function Page() {
  return (
    <RequirePermission permission="USER_READ">
      <UsersPage />
    </RequirePermission>
  );
}
