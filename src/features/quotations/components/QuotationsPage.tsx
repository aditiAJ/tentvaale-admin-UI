"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, ChevronRight, FileText, Inbox, MapPin, Plus, SearchX } from "lucide-react";
import { getQuotation, listQuotations, quotationKeys } from "@/features/quotations/api";
import type { QuotationView } from "@/features/quotations/types";
import { bucketOf, isFromStorefront, type QuotationBucket } from "@/features/quotations/source";
import { QuotationVersions } from "@/features/quotations/components/QuotationPanels";
import { QuotationPlanPanel } from "@/features/quotations/components/QuotationPlanPanel";
import { ReceivedCards, ReceivedDetail } from "@/features/quotations/components/ReceivedView";
import {
  LinesByFunction,
  PriceGrid,
  StatusBadge,
  StatusStepper,
  VenueRow,
  formatEventDate,
} from "@/features/quotations/components/QuotationParts";
import { QuotationActions } from "@/features/quotations/components/QuotationActions";
import { useCan } from "@/features/auth";
import { ConvertToOrderDialog } from "@/features/orders";
import { OrderBillingPanel } from "@/features/billing";
import { IS_MOCK } from "@/services/data-source";
import { ApiError } from "@/services/api-client";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { WorkspaceListSkeleton, WorkspaceSearch } from "@/components/workspace";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The status chips of the "Quotations" side, in the order a quotation moves through them. Requests from the storefront that
 * nobody has priced yet are not here: they have their own tab, "Received".
 */
const FILTERS: { key: string; label: string; status?: QuotationBucket }[] = [
  { key: "all", label: "All" },
  ...(IS_MOCK
    ? [
        { key: "new", label: "New", status: "NEW" as const },
        { key: "reviewed", label: "Reviewed", status: "REVIEWED" as const },
      ]
    : []),
  { key: "draft", label: "Draft", status: "DRAFT" },
  { key: "sent", label: "Sent", status: "SENT" },
  { key: "accepted", label: "Accepted", status: "ACCEPTED" },
  { key: "converted", label: "Order placed", status: "CONVERTED" },
  { key: "rejected", label: "Rejected", status: "REJECTED" },
  { key: "expired", label: "Expired", status: "EXPIRED" },
  ...(IS_MOCK ? [{ key: "discarded", label: "Discarded", status: "DISCARDED" as const }] : []),
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The page URL for a tab or chip, optionally with a quotation open in it. */
function hrefFor(status: string, id?: string) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (id) params.set("id", id);
  const query = params.toString();
  return query ? `/quotations?${query}` : "/quotations";
}

/**
 * Quotations in two places. "Received" holds what customers sent in from the storefront and nobody has priced yet, as cards
 * you open to price and send back. "Quotations" holds everything that is in the flow (draft, sent, accepted, order placed,
 * rejected, expired), whoever started it. `?status=` picks the tab or chip and `?id=` opens one, so every view can be
 * linked to and reloaded.
 */
export function QuotationsPage({ quotationId, status }: { quotationId: string; status: string }) {
  const canWrite = useCan("QUOTATION_WRITE");
  const [search, setSearch] = useState("");

  // Fresh on every visit: a quotation raised, edited or converted a moment ago changes what the list shows.
  const list = useQuery({
    queryKey: quotationKeys.list,
    queryFn: ({ signal }) => listQuotations(signal),
    staleTime: 0,
    retry: false,
  });

  const received = useMemo(() => (list.data ?? []).filter((q) => bucketOf(q) === "RECEIVED"), [list.data]);
  const inFlow = useMemo(() => (list.data ?? []).filter((q) => bucketOf(q) !== "RECEIVED"), [list.data]);
  const counts = useMemo(() => {
    const byBucket = new Map<string, number>();
    for (const q of inFlow) byBucket.set(bucketOf(q), (byBucket.get(bucketOf(q)) ?? 0) + 1);
    return byBucket;
  }, [inFlow]);

  // With nothing asked for, a visit starts on Received when something is waiting there.
  const tab: "received" | "flow" = status.toLowerCase() === "received" ? "received" : status === "" && received.length > 0 && list.data ? "received" : "flow";
  const chip = FILTERS.find((f) => f.key === status.toLowerCase()) ?? FILTERS[0];
  const tabKey = tab === "received" ? "received" : chip.key;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Quotations"
        description="Requests from customers on the storefront, and the quotations you send."
        actions={
          canWrite ? (
            <Link href="/quotations/new" className={buttonVariants()}>
              <Plus />
              New quotation
            </Link>
          ) : null
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[240px_1fr]">
        <SideTabs
          active={tabKey}
          received={received.length}
          counts={counts}
          total={inFlow.length}
          loaded={Boolean(list.data)}
        />

        <div className="min-w-0 space-y-4">
          {quotationId ? (
            <QuotationDetail
              key={quotationId}
              quotationId={quotationId}
              backHref={hrefFor(tabKey)}
              backLabel={tab === "received" ? "Received requests" : `${chip.label} quotations`}
            />
          ) : list.error ? (
            <Card>
              <EmptyState
                title="Could not load quotations"
                description={list.error.message}
                action={
                  <Button variant="outline" onClick={() => list.refetch()}>
                    Try again
                  </Button>
                }
              />
            </Card>
          ) : list.isPending ? (
            <WorkspaceListSkeleton />
          ) : tab === "received" ? (
            <ReceivedCards quotations={received} hrefFor={(id) => hrefFor("received", id)} />
          ) : (
            <QuotationList quotations={inFlow} chip={chip} search={search} onSearch={setSearch} />
          )}
        </div>
      </div>
    </div>
  );
}

/** The sections down the left, like Settings and Warehouses: what customers sent in, then each stage of the flow. */
function SideTabs({
  active,
  received,
  counts,
  total,
  loaded,
}: {
  active: string;
  received: number;
  counts: Map<string, number>;
  total: number;
  loaded: boolean;
}) {
  const item = (key: string, label: string, hint: string, icon: React.ReactNode, count: number | undefined, highlight = false) => {
    const on = active === key;
    return (
      <Link
        key={key}
        href={hrefFor(key)}
        aria-current={on ? "page" : undefined}
        className={cn(
          "flex shrink-0 items-center gap-3 rounded-lg border px-3.5 py-2.5 transition-colors lg:w-full",
          on ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40",
        )}
      >
        <span className={cn("shrink-0", on ? "text-primary" : "text-muted-foreground")}>{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{label}</span>
          <span className="hidden text-xs text-muted-foreground lg:block">{hint}</span>
        </span>
        {loaded && count !== undefined ? (
          <span
            className={cn(
              "tabular rounded-full px-2 py-0.5 text-xs",
              highlight && count > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {count}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <nav aria-label="Quotation sections" className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
      {item("received", "Received", "Requests from the storefront", <Inbox className="size-4" />, received, true)}
      <p className="hidden px-1 pt-2 text-[0.65rem] font-semibold tracking-wider text-muted-foreground uppercase lg:block">Quotations</p>
      {FILTERS.map((f) =>
        item(
          f.key,
          f.label,
          f.key === "all" ? "Everything in the flow" : STAGE_HINT[f.key] ?? "",
          <FileText className="size-4" />,
          f.status ? (counts.get(f.status) ?? 0) : total,
        ),
      )}
    </nav>
  );
}

const STAGE_HINT: Record<string, string> = {
  draft: "Being prepared, not sent",
  sent: "With the customer",
  accepted: "Approved, ready for an order",
  converted: "Became an order",
  rejected: "Turned down",
  expired: "Past its validity date",
  new: "Newly raised",
  reviewed: "Looked at",
  discarded: "Set aside",
};

function QuotationList({
  quotations,
  chip,
  search,
  onSearch,
}: {
  quotations: QuotationView[];
  chip: (typeof FILTERS)[number];
  search: string;
  onSearch: (value: string) => void;
}) {
  const deferred = useDeferredValue(search);
  const term = deferred.trim().toLowerCase();
  const inChip = useMemo(() => quotations.filter((q) => !chip.status || bucketOf(q) === chip.status), [quotations, chip.status]);
  const visible = useMemo(
    () =>
      !term
        ? inChip
        : inChip.filter(
            (q) =>
              q.customerName.toLowerCase().includes(term) ||
              q.quotationNumber.toLowerCase().includes(term) ||
              (q.customerEmail ?? "").toLowerCase().includes(term) ||
              q.id.toLowerCase() === term,
          ),
    [inChip, term],
  );
  // A pasted id still opens directly, including one the list does not hold.
  const pastedId = UUID.test(deferred.trim()) ? deferred.trim() : "";

  return (
    <div className="space-y-4">
      <WorkspaceSearch
        value={search}
        onChange={onSearch}
        placeholder="Search by customer, email or number…"
        label="Search quotations by customer, email or quotation number"
        summary={
          <>
            {visible.length} of {inChip.length}
          </>
        }
      />

      {pastedId && !visible.some((q) => q.id === pastedId) ? (
        <Link
          href={hrefFor(chip.key, pastedId)}
          className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border px-4 py-3 text-sm hover:border-primary/40 hover:bg-muted/50"
        >
          <span>
            Open quotation <span className="font-mono text-xs">{pastedId}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      ) : null}

      {visible.length === 0 ? (
        <Card>
          {term ? (
            <EmptyState
              icon={<SearchX />}
              title={`No quotations match “${deferred.trim()}”`}
              action={
                <Button variant="outline" onClick={() => onSearch("")}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<FileText />}
              title={chip.status ? `No ${chip.label.toLowerCase()} quotations` : "No quotations yet"}
              description={chip.status ? undefined : "Use New quotation to raise one."}
            />
          )}
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {visible.map((q) => (
              <li key={q.id}>
                <Link
                  href={hrefFor(chip.key, q.id)}
                  className="group flex items-center gap-4 px-4 py-3.5 transition-colors outline-none first:rounded-t-lg last:rounded-b-lg hover:bg-muted/50 focus-visible:bg-muted/50"
                  aria-label={`Open ${q.quotationNumber} for ${q.customerName}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate text-sm font-semibold">{q.customerName}</span>
                      <StatusBadge bucket={bucketOf(q)} />
                      {isFromStorefront(q) ? <Badge variant="outline">From storefront</Badge> : null}
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="font-mono">{q.quotationNumber}</span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="size-3" /> {formatEventDate(q.eventDate)}
                      </span>
                      {q.venue?.text ? (
                        <span className="inline-flex max-w-56 items-center gap-1 truncate">
                          <MapPin className="size-3 shrink-0" /> <span className="truncate">{q.venue.text}</span>
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tabular text-sm font-semibold">{formatMoney(q.totalAmount)}</p>
                    <p className="text-[0.7rem] text-muted-foreground">
                      {q.lines.length} line{q.lines.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** One quotation, opened. A request nobody has priced yet gets the request view; everything else the quotation view. */
function QuotationDetail({ quotationId, backHref, backLabel }: { quotationId: string; backHref: string; backLabel: string }) {
  const [converting, setConverting] = useState(false);
  const canReadPayments = useCan("PAYMENT_READ");

  const { data, isPending, isError, error } = useQuery({
    queryKey: quotationKeys.byId(quotationId),
    queryFn: ({ signal }) => getQuotation(quotationId, signal),
    retry: false,
  });
  const notFound = isError && error instanceof ApiError && error.status === 404;

  return (
    <div className="space-y-4">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>

      {isPending ? <Skeleton className="h-48" /> : null}

      {notFound ? (
        <Card>
          <EmptyState icon={<FileText />} title="No quotation with that id" description="Either the id is wrong, or the quotation belongs to another company." />
        </Card>
      ) : null}
      {isError && !notFound ? <Alert tone="error" title={error instanceof Error ? error.message : "Lookup failed"} /> : null}

      {data && bucketOf(data) === "RECEIVED" ? (
        <ReceivedDetail quotation={data} actions={<QuotationActions quotation={data} received onConvert={() => setConverting(true)} />} />
      ) : null}

      {data && bucketOf(data) !== "RECEIVED" ? (
        <FlowDetail quotation={data} onConvert={() => setConverting(true)} showBilling={canReadPayments} />
      ) : null}

      {data && converting ? <ConvertToOrderDialog quotation={data} onClose={() => setConverting(false)} /> : null}
    </div>
  );
}

function FlowDetail({ quotation: q, onConvert, showBilling }: { quotation: QuotationView; onConvert: () => void; showBilling: boolean }) {
  const bucket = bucketOf(q);
  return (
    <>
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold wrap-break-word">{q.customerName}</h2>
              <StatusBadge bucket={bucket} />
              {isFromStorefront(q) ? <Badge variant="outline">From storefront</Badge> : null}
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-mono text-foreground">{q.quotationNumber}</span>
              {q.customerEmail ? ` · ${q.customerEmail}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <QuotationActions quotation={q} onConvert={onConvert} />
          </div>
        </div>
        <StatusStepper status={q.status} />
        {q.changeRequestNote ? <Alert tone="warning" title={`Customer asked for changes: ${q.changeRequestNote}`} /> : null}
        {q.status === "REJECTED" && q.rejectionReason ? <Alert tone="error" title={`Rejected: ${q.rejectionReason}`} /> : null}
      </Card>

      <Card className="space-y-5 p-5">
        <PriceGrid quotation={q} />
        <dl className="grid gap-x-8 gap-y-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Event date</dt>
            <dd className="tabular mt-0.5 text-sm font-medium">{formatEventDate(q.eventDate, true)}</dd>
          </div>
          {q.sentAt ? (
            <div>
              <dt className="text-xs text-muted-foreground">Sent to customer</dt>
              <dd className="tabular mt-0.5 text-sm font-medium">{formatDateTime(q.sentAt)}</dd>
            </div>
          ) : null}
          {q.acceptedAt ? (
            <div>
              <dt className="text-xs text-muted-foreground">Accepted</dt>
              <dd className="tabular mt-0.5 text-sm font-medium">{formatDateTime(q.acceptedAt)}</dd>
            </div>
          ) : null}
          {(q.policies ?? []).length > 0 ? (
            <div>
              <dt className="text-xs text-muted-foreground">Policies sent with it</dt>
              <dd className="mt-0.5 text-sm font-medium">{(q.policies ?? []).map((p) => `${p.kind.toLowerCase()} v${p.version}`).join(", ")}</dd>
            </div>
          ) : null}
        </dl>
        <VenueRow venue={q.venue} />
      </Card>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Items</h3>
        <LinesByFunction quotation={q} />
        {isFromStorefront(q) && !q.lines.some((l) => l.functionName) ? <QuotationPlanPanel quotation={q} /> : null}
      </section>

      {showBilling && (q.status === "SENT" || q.status === "ACCEPTED") ? (
        <OrderBillingPanel quotationId={q.id} acceptsOnPayment={q.status === "SENT"} />
      ) : null}

      <QuotationVersions quotationId={q.id} />

      <p className="px-1 text-xs text-muted-foreground">
        Totals are worked out when the quotation is raised and stored, so a later change to a product&apos;s rate does not alter one that has already gone out.
      </p>
    </>
  );
}
