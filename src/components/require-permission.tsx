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
  /** One permission, or several of which any one is enough. */
  permission: Permission | Permission[];
  children: React.ReactNode;
}) {
  const { can } = useSession();

  if (![permission].flat().some(can)) {
    return (
      <EmptyState
        icon={<ShieldAlert />}
        title="You do not have access to this page"
        description="Your account does not include this. An Administrator can add it on the Users screen."
      />
    );
  }

  return <>{children}</>;
}
