import { ProductsPage } from "@/features/master-data";
import { RequirePermission } from "@/components/require-permission";

/**
 * `?category=` and `?sub=` open the list already filtered, which is where the Categories page links to. They are
 * read here, on the server component, so the client page needs no Suspense boundary for useSearchParams.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { category, sub } = await searchParams;

  return (
    <RequirePermission permission="MASTER_DATA_READ">
      <ProductsPage
        initialCategoryId={typeof category === "string" ? category : ""}
        initialSubCategoryId={typeof sub === "string" ? sub : ""}
      />
    </RequirePermission>
  );
}
