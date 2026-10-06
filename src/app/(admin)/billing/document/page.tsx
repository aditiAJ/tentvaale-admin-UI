import { DocumentPage } from "@/features/billing";
import { RequirePermission } from "@/components/require-permission";

/** `?id=` is the document; the order page and the order's document list link here. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await searchParams;
  return (
    <RequirePermission permission="INVOICE_READ">
      <DocumentPage documentId={typeof id === "string" ? id : ""} />
    </RequirePermission>
  );
}
