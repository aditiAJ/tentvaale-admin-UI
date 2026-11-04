import { SuppliersPage } from "@/features/master-data";
import { RequirePermission } from "@/components/require-permission";

/**
 * `?supplier=<id>` opens that supplier's workspace. It is read here, on the server component, so the client page needs
 * no Suspense boundary for useSearchParams, and Back returns to the list as it was.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { supplier } = await searchParams;

  return (
    <RequirePermission permission="MASTER_DATA_READ">
      <SuppliersPage selectedId={typeof supplier === "string" && supplier ? supplier : undefined} />
    </RequirePermission>
  );
}
