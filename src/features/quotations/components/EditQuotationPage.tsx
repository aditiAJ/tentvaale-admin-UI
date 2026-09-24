"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { getQuotation, quotationKeys } from "@/features/quotations/api";
import { QuotationForm } from "@/features/quotations/components/QuotationForm";
import { ApiError } from "@/services/api-client";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loads one quotation and hands it to the form. A converted quotation is shown
 * as not editable rather than opened: its order was copied from it, and the
 * server would refuse the save anyway.
 */
export function EditQuotationPage({ quotationId }: { quotationId: string }) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: quotationKeys.byId(quotationId),
    queryFn: ({ signal }) => getQuotation(quotationId, signal),
    enabled: quotationId !== "",
    retry: false,
  });

  const back = (
    <Link
      href={quotationId ? `/quotations?id=${quotationId}` : "/quotations"}
      className={buttonVariants({ variant: "outline" })}
    >
      Back to quotation
    </Link>
  );

  if (!quotationId || (isError && error instanceof ApiError && error.status === 404)) {
    return (
      <div className="space-y-4">
        <PageHeader title="Edit quotation" actions={back} />
        <Card>
          <EmptyState icon={<FileText />} title="No quotation with that id" />
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <PageHeader title="Edit quotation" actions={back} />
        <Alert tone="error" title={error instanceof Error ? error.message : "Lookup failed"} />
      </div>
    );
  }

  if (isPending) return <Skeleton className="h-96" />;

  if (data.status === "CONVERTED") {
    return (
      <div className="space-y-4">
        <PageHeader title={`Edit ${data.quotationNumber}`} actions={back} />
        <Alert
          tone="error"
          title={`${data.quotationNumber} has been converted to an order and can no longer be edited.`}
        />
      </div>
    );
  }

  // Keyed by id so opening another quotation remounts the form with its values.
  return <QuotationForm key={data.id} existing={data} />;
}
