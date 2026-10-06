"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  Plus,
  SearchX,
} from "lucide-react";
import { getQuotation, listQuotations, quotationKeys } from "@/features/quotations/api";
import type { QuotationView } from "@/features/quotations/types";
import { bucketOf, isFromStorefront, type QuotationBucket } from "@/features/quotations/source";
import { QuotationBreakdown, QuotationVersions, ReceivedPanel } from "@/features/quotations/components/QuotationPanels";
import { QuotationPlanPanel } from "@/features/quotations/components/QuotationPlanPanel";
import { useCan } from "@/features/auth";
import { ConvertToOrderDialog } from "@/features/orders";
import { QuotationActions } from "@/features/quotations/components/QuotationActions";
import { OrderBillingPanel } from "@/features/billing";
import { IS_MOCK } from "@/services/data-source";
import { MediaThumb, useProductMedia } from "@/features/master-data";
import { ApiError } from "@/services/api-client";
import { formatMoney } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import {
  WorkspaceLayout,
  WorkspaceListSkeleton,
  WorkspaceSearch,
  workspaceHref as sharedWorkspaceHref,
} from "@/components/workspace";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const STATUS_VARIANT: Record<
  QuotationBucket,
  "default" | "success" | "warning" | "destructive" | "outline"
> = {
  RECEIVED: "warning",
  NEW: "outline",
  REVIEWED: "warning",
  DISCARDED: "destructive",
  DRAFT: "default",
  SENT: "warning",
  ACCEPTED: "success",
  CONVERTED: "success",
  REJECTED: "destructive",
  EXPIRED: "destructive",
};

/**
 * The workspace's filters, in the order the inner sidebar lists them. "" is all.
 *
 * Against the real backend the statuses are the lifecycle's own: Draft, Sent, Accepted,
 * Converted, Rejected, Expired. The seeded mock data also uses New, Reviewed and Discarded, which
 * the backend does not have, so those only show in mock mode.
 */
const MOCK_ONLY_FILTERS: { key: string; label: string; status?: QuotationBucket }[] = [
  { key: "new", label: "New", status: "NEW" },
  { key: "reviewed", label: "Reviewed", status: "REVIEWED" },
  { key: "discarded", label: "Discarded", status: "DISCARDED" },
];

const FILTERS: { key: string; label: string; status?: QuotationBucket }[] = [
  { key: "", label: "All quotations" },
  // Requests from the storefront waiting on the team, ahead of everything else.
  { key: "received", label: "Received", status: "RECEIVED" },
  ...(IS_MOCK ? MOCK_ONLY_FILTERS.slice(0, 2) : []),
  { key: "draft", label: "Draft", status: "DRAFT" },
  { key: "sent", label: "Sent", status: "SENT" },
  { key: "accepted", label: "Accepted", status: "ACCEPTED" },
  { key: "converted", label: "Converted", status: "CONVERTED" },
  { key: "rejected", label: "Rejected", status: "REJECTED" },
  { key: "expired", label: "Expired", status: "EXPIRED" },
  ...(IS_MOCK ? MOCK_ONLY_FILTERS.slice(2) : []),
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const eventDateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** An event date is a calendar date, so it is read and shown in UTC to stay on its day. */
const formatEventDate = (value: string | null) => {
  if (!value) return "Not set";
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : eventDateFormat.format(date);
};

/** The workspace URL for a filter, optionally with a quotation open in it. */
const workspaceHref = (filterKey: string, id?: string) =>
  sharedWorkspaceHref("/quotations", filterKey, id);

/**
 * The quotation workspace: a filter sidebar of its own beside a list, or the
 * quotation opened from it. Both come from the URL (`?status=`, `?id=`), so
 * every view can be linked to, reloaded and stepped back out of, and links
 * made before the workspace existed (`/quotations?id=…`) still land on their
 * quotation.
 */
export function QuotationsPage({ quotationId, status }: { quotationId: string; status: string }) {
  const canWrite = useCan("QUOTATION_WRITE");
  const filter = FILTERS.find((candidate) => candidate.key === status.toLowerCase()) ?? FILTERS[0];
  const [search, setSearch] = useState("");

  // Fresh on every visit: a quotation raised, edited or converted a moment
  // ago changes what the list and its counts show.
  const list = useQuery({
    queryKey: quotationKeys.list,
    queryFn: ({ signal }) => listQuotations(signal),
    staleTime: 0,
    retry: false,
  });

  const counts = useMemo(() => {
    const byStatus = new Map<string, number>();
    for (const quotation of list.data ?? []) {
      const bucket = bucketOf(quotation);
      byStatus.set(bucket, (byStatus.get(bucket) ?? 0) + 1);
    }
    return byStatus;
  }, [list.data]);

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

      <WorkspaceLayout
        navLabel="Quotation filters"
        heading="Quotations"
        filters={FILTERS}
        activeKey={filter.key}
        counts={list.data ? counts : undefined}
        total={list.data?.length}
        hrefFor={(key) => workspaceHref(key)}
      >
          {quotationId ? (
            <QuotationDetail
              key={quotationId}
              quotationId={quotationId}
              backHref={workspaceHref(filter.key)}
              backLabel={filter.status ? `${filter.label} quotations` : "All quotations"}
            />
          ) : (
            <QuotationList
              quotations={list.data}
              isPending={list.isPending}
              error={list.error}
              onRetry={() => list.refetch()}
              filter={filter}
              search={search}
              onSearch={setSearch}
            />
          )}
      </WorkspaceLayout>
    </div>
  );
}

function QuotationList({
  quotations,
  isPending,
  error,
  onRetry,
  filter,
  search,
  onSearch,
}: {
  quotations: QuotationView[] | undefined;
  isPending: boolean;
  error: Error | null;
  onRetry: () => void;
  filter: (typeof FILTERS)[number];
  search: string;
  onSearch: (value: string) => void;
}) {
  const deferredSearch = useDeferredValue(search);
  const term = deferredSearch.trim().toLowerCase();

  const inFilter = useMemo(
    () =>
      (quotations ?? []).filter(
        (quotation) => !filter.status || bucketOf(quotation) === filter.status,
      ),
    [quotations, filter.status],
  );

  const visible = useMemo(() => {
    if (!term) return inFilter;
    return inFilter.filter(
      (quotation) =>
        quotation.customerName.toLowerCase().includes(term) ||
        quotation.quotationNumber.toLowerCase().includes(term) ||
        (quotation.customerEmail ?? "").toLowerCase().includes(term) ||
        quotation.id.toLowerCase() === term,
    );
  }, [inFilter, term]);

  // A pasted id is still openable directly, including one the list does not
  // hold, which is the only way to reach a quotation when there is no list.
  const pastedId = UUID.test(deferredSearch.trim()) ? deferredSearch.trim() : "";

  return (
    <>
      <WorkspaceSearch
        value={search}
        onChange={onSearch}
        placeholder="Search quotations…"
        label="Search quotations by customer, email or quotation number"
        summary={
          quotations ? (
            <>
              {visible.length} of {inFilter.length}{" "}
              {filter.status ? filter.label.toLowerCase() : ""} quotations
            </>
          ) : undefined
        }
      />

      {pastedId && !visible.some((quotation) => quotation.id === pastedId) ? (
        <Link
          href={workspaceHref(filter.key, pastedId)}
          className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border px-4 py-3 text-sm hover:border-primary/40 hover:bg-muted/50"
        >
          <span>
            Open quotation <span className="font-mono text-xs">{pastedId}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      ) : null}

      {isPending ? <WorkspaceListSkeleton /> : null}

      {error ? (
        <Card>
          <EmptyState
            title="Could not load quotations"
            description={error.message}
            action={
              <Button variant="outline" onClick={onRetry}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : null}

      {quotations && visible.length === 0 ? (
        <Card>
          {term ? (
            <EmptyState
              icon={<SearchX />}
              title={`No quotations match “${deferredSearch.trim()}”`}
              action={
                <Button variant="outline" onClick={() => onSearch("")}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<FileText />}
              title={
                filter.status
                  ? `No ${filter.label.toLowerCase()} quotations`
                  : "No quotations yet"
              }
            />
          )}
        </Card>
      ) : null}

      {visible.length > 0 ? (
        <Card>
          <ul className="divide-y divide-border">
            {visible.map((quotation) => (
              <li key={quotation.id}>
                <Link
                  href={workspaceHref(filter.key, quotation.id)}
                  className="group flex items-center gap-4 px-4 py-3.5 transition-colors outline-none first:rounded-t-lg last:rounded-b-lg hover:bg-muted/50 focus-visible:bg-muted/50"
                  aria-label={`Open ${quotation.quotationNumber} for ${quotation.customerName}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate text-sm font-semibold">
                        {quotation.customerName}
                      </span>
                      <Badge variant={STATUS_VARIANT[bucketOf(quotation)]}>{bucketOf(quotation)}</Badge>
                      {isFromStorefront(quotation) ? (
                        <Badge variant="outline">Storefront</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span className="font-mono">{quotation.quotationNumber}</span>
                      {quotation.customerEmail ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{quotation.customerEmail}</span>
                        </>
                      ) : null}
                    </p>
                    {/* On a narrow screen the figures sit under the name. */}
                    <p className="mt-1 text-xs text-muted-foreground tabular sm:hidden">
                      {formatEventDate(quotation.eventDate)} ·{" "}
                      <span className="font-medium text-foreground">
                        {formatMoney(quotation.totalAmount)}
                      </span>
                    </p>
                  </div>

                  <dl className="hidden shrink-0 items-center gap-6 text-right sm:flex">
                    <div className="w-24">
                      <dt className="text-[0.7rem] text-muted-foreground">Event date</dt>
                      <dd className="tabular text-sm">{formatEventDate(quotation.eventDate)}</dd>
                    </div>
                    <div className="hidden w-24 lg:block">
                      <dt className="text-[0.7rem] text-muted-foreground">Deposit</dt>
                      <dd className="tabular text-sm">
                        {formatMoney(quotation.totalSecurityDeposit)}
                      </dd>
                    </div>
                    <div className="w-28">
                      <dt className="text-[0.7rem] text-muted-foreground">Total</dt>
                      <dd className="tabular text-sm font-semibold">
                        {formatMoney(quotation.totalAmount)}
                      </dd>
                    </div>
                  </dl>

                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

/** One quotation, opened in the workspace. The same detail, edit and convert as before. */
function QuotationDetail({
  quotationId,
  backHref,
  backLabel,
}: {
  quotationId: string;
  backHref: string;
  backLabel: string;
}) {
  const [converting, setConverting] = useState(false);
  const canReadPayments = useCan("PAYMENT_READ");

  const { data, isPending, isError, error } = useQuery({
    queryKey: quotationKeys.byId(quotationId),
    queryFn: ({ signal }) => getQuotation(quotationId, signal),
    retry: false,
  });
  const productMedia = useProductMedia();

  const notFound = isError && error instanceof ApiError && error.status === 404;

  return (
    <>
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>

      {isPending ? <Skeleton className="h-48" /> : null}

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

      {data ? (
        <>
          {bucketOf(data) === "RECEIVED" ? (
            <ReceivedPanel
              quotation={data}
              actions={<QuotationActions quotation={data} received onConvert={() => setConverting(true)} />}
            />
          ) : null}

          <Card>
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-lg wrap-break-word">{data.customerName}</CardTitle>
                  <Badge variant={STATUS_VARIANT[bucketOf(data)]}>{bucketOf(data)}</Badge>
                  {isFromStorefront(data) ? <Badge variant="outline">From storefront</Badge> : null}
                </div>
                <p className="font-mono text-sm text-foreground">{data.quotationNumber}</p>
                {data.customerEmail ? (
                  <p className="text-xs text-muted-foreground">{data.customerEmail}</p>
                ) : null}
                {data.customerId ? (
                  <p className="font-mono text-xs text-muted-foreground">{data.customerId}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {bucketOf(data) === "RECEIVED" ? null : (
                  <QuotationActions quotation={data} onConvert={() => setConverting(true)} />
                )}
              </div>
            </CardHeader>

            <CardContent>
              <QuotationBreakdown quotation={data} />
              <QuotationPlanPanel quotation={data} />
              <p className="mt-3 text-xs text-muted-foreground">
                Event date <span className="tabular text-foreground">{formatEventDate(data.eventDate)}</span>
              </p>

              {data.changeRequestNote && bucketOf(data) !== "RECEIVED" ? (
                <Alert tone="warning" title={`Customer asked for changes: ${data.changeRequestNote}`} className="mt-4" />
              ) : null}

              {data.status === "REJECTED" && data.rejectionReason ? (
                <Alert tone="error" title={`Rejected: ${data.rejectionReason}`} className="mt-4" />
              ) : null}

              {data.validUntil || data.sentAt || data.acceptedAt ? (
                <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
                  {data.validUntil ? <>Valid until {formatEventDate(data.validUntil)}. </> : null}
                  {data.sentAt ? <>Sent {formatEventDate(data.sentAt)}. </> : null}
                  {data.acceptedAt ? <>Accepted {formatEventDate(data.acceptedAt)}.</> : null}
                </p>
              ) : null}

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
                      <TD>
                        <div className="flex items-center gap-2.5">
                          <MediaThumb media={productMedia.get(line.productId)} />
                          <span className="font-medium">{line.productName}</span>
                        </div>
                      </TD>
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

          {canReadPayments && (data.status === "SENT" || data.status === "ACCEPTED") ? (
            <OrderBillingPanel quotationId={data.id} acceptsOnPayment={data.status === "SENT"} />
          ) : null}

          <QuotationVersions quotationId={data.id} />

          {converting ? (
            <ConvertToOrderDialog quotation={data} onClose={() => setConverting(false)} />
          ) : null}
        </>
      ) : null}
    </>
  );
}
