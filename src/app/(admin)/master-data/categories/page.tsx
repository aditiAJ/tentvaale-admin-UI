import { CategoriesPage } from "@/features/master-data";
import { RequirePermission } from "@/components/require-permission";

export default function Page() {
  return (
    <RequirePermission permission="CATEGORY_VIEW">
      <CategoriesPage />
    </RequirePermission>
  );
}
