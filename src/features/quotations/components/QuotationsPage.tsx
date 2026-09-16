"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { getQuotation, quotationKeys } from "@/features/quotations/api";
import type { QuotationStatus } from "@/features/quotations/types";
import { ApiError } from "@/services/api-client";
import { DEMO_QUOTATION_EXAMPLES } from "@/mock-data/seed";
import { formatMoney } from "@/lib/money";
import { IdLookup } from "@/components/id-lookup";
import { PageHeader } from "@/components/page-header";
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

export function QuotationsPage() {
  const [quotationId, setQuotationId] = useState("");

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
              <Badge variant={STATUS_VARIANT[data.status]}>{data.status}</Badge>
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
        </>
      ) : null}
    </div>
  );
}
