"use client";

import { ShieldAlert } from "lucide-react";
import { useSession } from "@/features/auth";
import type { Permission } from "@/services/permissions";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Page-level permission gate.
 *
 * The sidebar already hides what a user cannot open, but a bookmark or a pasted
 * link bypasses the sidebar. This turns that case into a clear explanation
 * rather than a screen of failed requests. It is presentation only — the
 * endpoint behind the page enforces the same permission itself.
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: React.ReactNode;
}) {
  const { can, session } = useSession();

  if (!can(permission)) {
    return (
      <EmptyState
        icon={<ShieldAlert />}
        title="You do not have access to this page"
        description={`It needs the ${permission} permission, which your role (${session?.role ?? "unknown"}) does not grant. An administrator can change your role.`}
      />
    );
  }

  return <>{children}</>;
}
