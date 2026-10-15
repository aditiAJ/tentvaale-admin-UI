"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * What a page shows when it crashes while rendering. Next.js hands error.tsx the error and a reset
 * function that re-renders the segment; the files in app/ are thin wrappers around this.
 */
export function ErrorView({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="flex min-h-[60vh] items-center justify-center">
      <EmptyState
        icon={<TriangleAlert className="text-destructive" />}
        title="Something went wrong on this page"
        description={
          error.digest
            ? `Try again. If it keeps happening, tell support this reference: ${error.digest}.`
            : "Try again. If it keeps happening, reload the page or sign in again."
        }
        action={
          <div className="flex gap-2">
            <Button onClick={reset}>Try again</Button>
            <Link href="/" className={buttonVariants({ variant: "outline" })}>
              Go to dashboard
            </Link>
          </div>
        }
      />
    </div>
  );
}
