import { CreditNotesPage } from "@/features/credit-notes";
import { RequirePermission } from "@/components/require-permission";

/**
 * `?status=` and `?id=` for the same reason the quotations and orders routes
 * take them — see the quotations page.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id, status } = await searchParams;

  return (
    <RequirePermission permission="CREDIT_NOTE_READ">
      <CreditNotesPage
        noteId={typeof id === "string" ? id : ""}
        status={typeof status === "string" ? status : ""}
      />
    </RequirePermission>
  );
}
