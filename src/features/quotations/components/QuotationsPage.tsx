"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FileText, Plus } from "lucide-react";
import { getQuotation, quotationKeys } from "@/features/quotations/api";
import type { QuotationStatus } from "@/features/quotations/types";
import { useCan } from "@/features/auth";
import { ConvertToOrderDialog } from "@/features/orders";
import { ApiError } from "@/services/api-client";
import { DEMO_QUOTATION_EXAMPLES } from "@/mock-data/seed";
import { formatMoney } from "@/lib/money";
import { IdLookup } from "@/components/id-lookup";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const STATUS_VARIANT: Record<QuotationStatus, "default" | "success" | "warning" | "destructive"> = {
  DRAFT: "default",
  SENT: "warning",
  ACCEPTED: "success",
  CONVERTED: "success",
  REJECTED: "destructive",
  EXPIRED: "destructive",
};

/**
 * `initialQuotationId` comes from `?id=` on the route, which is how creating a
 * quotation can end on the record it just made. It is an initial value rather
 * than a controlled one: once the screen is open, the lookup box owns the id,
 * and a later edit there should not be fighting the URL.
 */
export function QuotationsPage({ initialQuotationId = "" }: { initialQuotationId?: string }) {
  const [quotationId, setQuotationId] = useState(initialQuotationId);
  const [converting, setConverting] = useState(false);
  const canWrite = useCan("QUOTATION_WRITE");
  // Converting writes an order, so it is ORDER_WRITE that governs it, not
  // QUOTATION_WRITE — which is why a SALES user sees both actions and an
  // ACCOUNTS user sees neither.
  const canConvert = useCan("ORDER_WRITE");

  const { data, isFetching, isError, error } = useQuery({
    queryKey: quotationKeys.byId(quotationId),
    queryFn: ({ signal }) => getQuotation(quotationId, signal),
    enabled: quotationId !== "",
    retry: false,
  });

  const notFound = isError && error instanceof ApiError && error.status === 404;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Quotations"
        description="What was quoted, to whom, and what became of it."
        actions={
          canWrite ? (
            // A link rather than a button with a router push: raising a
            // quotation is a navigation, and it should middle-click and open in
            // a new tab like one.
            <Link href="/quotations/new" className={buttonVariants()}>
              <Plus />
              New quotation
            </Link>
          ) : null
        }
      />

      <IdLookup
        label="Quotation ID"
        value={quotationId}
        onChange={setQuotationId}
        submitLabel="Open quotation"
        busy={isFetching}
        examples={DEMO_QUOTATION_EXAMPLES}
      />

      {isFetching ? <Skeleton className="h-48" /> : null}

      {notFound ? (
        <Card>
          <EmptyState
            icon={<FileText />}
            title="No quotation with that id"
            description="Either the id is wrong, or the quotation belongs to another company."
          />
        </Card>
      ) : null}

      {isError && !notFound ? (
        <Alert tone="error" title={error instanceof Error ? error.message : "Lookup failed"} />
      ) : null}

      {data && !isFetching ? (
        <>
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <div className="space-y-1">
                <CardTitle>{data.quotationNumber}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {data.customerName}
                  {data.customerEmail ? ` · ${data.customerEmail}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={STATUS_VARIANT[data.status]}>{data.status}</Badge>
                {canConvert ? (
                  // Only CONVERTED is refused: markConverted is the one rule
                  // the backend actually has here, so a rejected or expired
                  // quotation is still offered rather than being blocked by a
                  // rule this screen invented.
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={data.status === "CONVERTED"}
                    title={
                      data.status === "CONVERTED"
                        ? "This quotation has already been converted to an order"
                        : undefined
                    }
                    onClick={() => setConverting(true)}
                  >
                    Convert to order
                  </Button>
                ) : null}
              </div>
            </CardHeader>

            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Total</dt>
                  <dd className="mt-0.5 text-lg font-semibold">{formatMoney(data.totalAmount)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Security deposit</dt>
                  <dd className="mt-0.5 text-lg font-semibold">
                    {formatMoney(data.totalSecurityDeposit)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Event date</dt>
                  <dd className="tabular mt-0.5 text-lg font-semibold">
                    {data.eventDate ?? "Not set"}
                  </dd>
                </div>
              </dl>

              {data.sourceReference ? (
                <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
                  Raised via <span className="font-mono">{data.sourceReference}</span>
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lines</CardTitle>
            </CardHeader>
            <TableWrapper>
              <Table>
                <THead>
                  <tr>
                    <TH>Product</TH>
                    <TH className="text-right">Qty</TH>
                    <TH className="text-right">Days</TH>
                    <TH className="text-right">Rate/day</TH>
                    <TH className="text-right">Line total</TH>
                  </tr>
                </THead>
                <TBody>
                  {data.lines.map((line) => (
                    <TR key={line.id}>
                      <TD className="font-medium">{line.productName}</TD>
                      <TD className="text-right tabular">{line.quantity}</TD>
                      <TD className="text-right tabular">{line.rentalDays}</TD>
                      <TD className="text-right tabular">{formatMoney(line.unitRatePerDay)}</TD>
                      <TD className="text-right tabular">{formatMoney(line.lineTotal)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrapper>
            <CardContent className="border-t border-border text-xs text-muted-foreground">
              Totals were calculated when the quotation was raised and stored, so a later change to
              a product&apos;s rate does not alter a quote that has already gone out.
            </CardContent>
          </Card>

          {converting ? (
            <ConvertToOrderDialog quotation={data} onClose={() => setConverting(false)} />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
