"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { LoginForm, useSession } from "@/features/auth";
import { safeInternalPath } from "@/lib/navigation";
import { Card, CardContent } from "@/components/ui/card";

function LoginPanel() {
  const { session, loading } = useSession();
  const router = useRouter();
  const next = useSearchParams().get("next");

  // Someone who still has a valid token has no business on the login screen. This also runs the moment the form signs
  // in, so it goes to the same checked `next` as the form does: sending everyone to "/" here overrode the deep link.
  useEffect(() => {
    if (!loading && session) router.replace(safeInternalPath(next) ?? "/");
  }, [loading, session, router, next]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-5">
        <div className="space-y-1 text-center">
          <h1 className="text-lg font-semibold tracking-tight">Tentvaale Back Office</h1>
          <p className="text-sm text-muted-foreground">Sign in to continue</p>
        </div>

        <Card>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Your company is determined by your account — there is no company selector.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  // LoginForm reads `next` from the query string, and useSearchParams opts the
  // subtree into client rendering, which needs a Suspense boundary above it.
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <LoginPanel />
    </Suspense>
  );
}
