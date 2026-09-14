"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useSession } from "@/features/auth";
import { firstAvailableRoute } from "@/layouts/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

/**
 * There is no dashboard to land on yet, and roles differ in what they may open
 * — WAREHOUSE cannot see Users, and a role without MASTER_DATA_READ cannot see
 * Products. So the landing route resolves the first screen this particular user
 * is allowed to open instead of hard-coding one that would 403 for some of them.
 */
export default function HomePage() {
  const { session, loading, signOut } = useSession();
  const router = useRouter();

  const destination = session ? firstAvailableRoute(session.permissions) : null;

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    if (destination) router.replace(destination);
  }, [loading, session, destination, router]);

  if (!loading && session && !destination) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <EmptyState
          title="Nothing is available for your role yet"
          description={`Your role (${session.role}) grants no permission that maps to a screen built so far. The modules it covers are still waiting on backend endpoints.`}
          action={
            <Button variant="outline" onClick={signOut}>
              Sign out
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
