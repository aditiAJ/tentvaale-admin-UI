import { FeaturedCollectionsPage } from "@/features/master-data";
import { RequirePermission } from "@/components/require-permission";

export default function Page() {
  return (
    <RequirePermission permission="COLLECTION_VIEW">
      <FeaturedCollectionsPage />
    </RequirePermission>
  );
}
