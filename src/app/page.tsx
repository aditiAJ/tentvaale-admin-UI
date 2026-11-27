"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogoLoader } from "@/components/ui/logo-loader";
import { useSession } from "@/features/auth";
import { firstAvailableRoute } from "@/layouts/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

/**
 * People differ in what they may open, so there is no one page everyone can
 * land on. The landing route resolves the first screen this particular user
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
          title="Nothing is available for your account yet"
          description="No screen has been given to your account. An Administrator can add one on the Users screen."
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
    <LogoLoader />
  );
}
