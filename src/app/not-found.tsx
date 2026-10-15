import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <EmptyState
        icon={<SearchX />}
        title="Page not found"
        description="The page you opened does not exist or has moved."
        action={
          <Link href="/" className={buttonVariants()}>
            Go to dashboard
          </Link>
        }
      />
    </div>
  );
}
