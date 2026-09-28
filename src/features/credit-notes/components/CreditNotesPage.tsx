"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { useQueries, useQuery } from "@tanstack/react-query";
import { ChevronRight, Plus, Receipt, SearchX } from "lucide-react";
import { creditNoteKeys, listCreditNotesByCustomer } from "@/features/credit-notes/api";
import {
  remainingCredit,
  type CreditNoteStatus,
  type CreditNoteView,
} from "@/features/credit-notes/types";
import { CREDIT_NOTE_STATUS_VARIANT } from "@/features/credit-notes/display";
import { CreditNoteDetail } from "@/features/credit-notes/components/CreditNoteDetail";
import {
  ApplyCreditNoteEntry,
  IssueCreditNoteEntry,
} from "@/features/credit-notes/components/CreditNoteEntries";
import {
  CreditNoteActionDialog,
  type CreditNoteAction,
} from "@/features/credit-notes/components/CreditNoteActionDialog";
import { listCustomers, masterDataKeys } from "@/features/master-data/api";
import type { CustomerView } from "@/features/master-data/types";
import { listOrders, orderKeys } from "@/features/orders/api";
import { formatEventDate } from "@/features/orders/display";
import { useCan } from "@/features/auth";
import { formatMoney } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import {
  WorkspaceLayout,
  WorkspaceListSkeleton,
  WorkspaceSearch,
  workspaceHref as sharedWorkspaceHref,
  type WorkspaceFilter,
} from "@/components/workspace";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

/** The workspace's filters, live credit first. "" is all. */
const FILTERS: (WorkspaceFilter & { status?: CreditNoteStatus })[] = [
  { key: "", label: "All credit notes" },
  { key: "issued", label: "Issued", status: "ISSUED" },
  { key: "applied", label: "Applied", status: "APPLIED" },
  { key: "cancelled", label: "Cancelled", status: "CANCELLED" },
  { key: "reversed", label: "Reversed", status: "REVERSED" },
];

const workspaceHref = (filterKey: string, id?: string) =>
  sharedWorkspaceHref("/credit-notes", filterKey, id);

/** A note with the customer it belongs to, resolved for display and search. */
interface ListedNote {
  note: CreditNoteView;
  customer: CustomerView | undefined;
}

/**
 * The credit-note workspace, the same shape as the quotation and order ones:
 * status filters beside a searchable list of every note, or one note opened
 * from it, both in the URL (`?status=`, `?id=`).
 *
 * There is no company-wide credit-note endpoint — notes are read per customer —
 * so the list is every customer's notes read with that same call, one per
 * customer, under the same cache keys the issue, apply, cancel and reverse
 * dialogs already refresh. The customer list is the one the old customer
 * picker used.
 */
export function CreditNotesPage({ noteId, status }: { noteId: string; status: string }) {
  const canWrite = useCan("CREDIT_NOTE_WRITE");
  const filter = FILTERS.find((candidate) => candidate.key === status.toLowerCase()) ?? FILTERS[0];
  const [search, setSearch] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [applying, setApplying] = useState<CreditNoteView | null>(null);
  const [acting, setActing] = useState<{ action: CreditNoteAction; note: CreditNoteView } | null>(
    null,
  );

  const customers = useQuery({
    queryKey: masterDataKeys.customers,
    queryFn: ({ signal }) => listCustomers(signal),
  });

  // Fresh on every visit, like the other workspaces: a note issued or applied
  // a moment ago changes the list and its counts.
  const perCustomer = useQueries({
    queries: (customers.data ?? []).map((customer) => ({
      queryKey: creditNoteKeys.byCustomer(customer.id),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        listCreditNotesByCustomer(customer.id, signal),
      staleTime: 0,
      retry: false,
    })),
    combine: (results) => ({
      notes: results.every((result) => result.data)
        ? results.flatMap((result) => result.data ?? [])
        : undefined,
      error: results.find((result) => result.error)?.error ?? null,
      refetch: () => results.forEach((result) => void result.refetch()),
    }),
  });

  // Only for showing order numbers rather than ids.
  const orders = useQuery({
    queryKey: orderKeys.list,
    queryFn: ({ signal }) => listOrders(signal),
    retry: false,
  });
  const orderNumbers = useMemo(
    () => new Map((orders.data ?? []).map((order) => [order.id, order.orderNumber])),
    [orders.data],
  );
  const orderNumber = (orderId: string) => orderNumbers.get(orderId) ?? orderId;

  const listed = useMemo<ListedNote[] | undefined>(() => {
    if (!customers.data || !perCustomer.notes) return undefined;
    const byId = new Map(customers.data.map((customer) => [customer.id, customer]));
    // Newest first, as each customer's list already comes.
    return [...perCustomer.notes]
      .sort(
        (a, b) =>
          Date.parse(b.issuedOn) - Date.parse(a.issuedOn) ||
          b.creditNoteNumber.localeCompare(a.creditNoteNumber),
      )
      .map((note) => ({ note, customer: byId.get(note.customerId) }));
  }, [customers.data, perCustomer.notes]);

  const counts = useMemo(() => {
    const byStatus = new Map<string, number>();
    for (const { note } of listed ?? []) {
      byStatus.set(note.status, (byStatus.get(note.status) ?? 0) + 1);
    }
    return byStatus;
  }, [listed]);

  const error = customers.error ?? perCustomer.error;
  const isPending = !listed && !error;
  const open = noteId ? listed?.find(({ note }) => note.id === noteId) : undefined;

  const actionsFor = {
    onApply: (note: CreditNoteView) => setApplying(note),
    onCancel: (note: CreditNoteView) => setActing({ action: "cancel", note }),
    onReverse: (note: CreditNoteView) => setActing({ action: "reverse", note }),
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Credit notes"
        description="Credit issued to customers, and what is left of it."
        actions={
          canWrite ? (
            <Button onClick={() => setIssuing(true)} disabled={!customers.data}>
              <Plus />
              Issue credit note
            </Button>
          ) : null
        }
      />

      <WorkspaceLayout
        navLabel="Credit note filters"
        heading="Credit notes"
        filters={FILTERS}
        activeKey={filter.key}
        counts={listed ? counts : undefined}
        total={listed?.length}
        hrefFor={(key) => workspaceHref(key)}
      >
        {noteId ? (
          open ? (
            <CreditNoteDetail
              key={noteId}
              note={open.note}
              customer={open.customer}
              orderNumber={orderNumber}
              backHref={workspaceHref(filter.key)}
              backLabel={filter.status ? `${filter.label} credit notes` : "All credit notes"}
              canWrite={canWrite}
              onApply={() => actionsFor.onApply(open.note)}
              onCancel={() => actionsFor.onCancel(open.note)}
              onReverse={() => actionsFor.onReverse(open.note)}
            />
          ) : isPending ? (
            <Skeleton className="h-64" />
          ) : (
            <Card>
              <EmptyState
                icon={<Receipt />}
                title="No credit note with that id"
                description="Either the id is wrong, or the note belongs to another company."
                action={
                  <Link href={workspaceHref(filter.key)} className="text-sm underline">
                    Back to credit notes
                  </Link>
                }
              />
            </Card>
          )
        ) : (
          <CreditNoteList
            listed={listed}
            isPending={isPending}
            error={error}
            onRetry={() => (customers.error ? customers.refetch() : perCustomer.refetch())}
            filter={filter}
            search={search}
            onSearch={setSearch}
            orderNumber={orderNumber}
            canWrite={canWrite}
            {...actionsFor}
          />
        )}
      </WorkspaceLayout>

      {issuing && customers.data ? (
        <IssueCreditNoteEntry
          customers={customers.data}
          defaultCustomerId={open?.note.customerId}
          onClose={() => setIssuing(false)}
        />
      ) : null}

      {applying ? (
        <ApplyCreditNoteEntry note={applying} onClose={() => setApplying(null)} />
      ) : null}

      {acting ? (
        <CreditNoteActionDialog
          action={acting.action}
          note={acting.note}
          onClose={() => setActing(null)}
        />
      ) : null}
    </div>
  );
}

function CreditNoteList({
  listed,
  isPending,
  error,
  onRetry,
  filter,
  search,
  onSearch,
  orderNumber,
  canWrite,
  onApply,
  onCancel,
  onReverse,
}: {
  listed: ListedNote[] | undefined;
  isPending: boolean;
  error: Error | null;
  onRetry: () => void;
  filter: (typeof FILTERS)[number];
  search: string;
  onSearch: (value: string) => void;
  orderNumber: (orderId: string) => string;
  canWrite: boolean;
  onApply: (note: CreditNoteView) => void;
  onCancel: (note: CreditNoteView) => void;
  onReverse: (note: CreditNoteView) => void;
}) {
  const deferredSearch = useDeferredValue(search);
  const term = deferredSearch.trim().toLowerCase();

  const inFilter = useMemo(
    () => (listed ?? []).filter(({ note }) => !filter.status || note.status === filter.status),
    [listed, filter.status],
  );

  const visible = useMemo(() => {
    if (!term) return inFilter;
    return inFilter.filter(({ note, customer }) => {
      const orderIds = [note.againstOrderId, ...note.applications.map((a) => a.orderId)].filter(
        (id): id is string => Boolean(id),
      );
      return (
        note.creditNoteNumber.toLowerCase().includes(term) ||
        (customer?.fullName ?? "").toLowerCase().includes(term) ||
        (customer?.email ?? "").toLowerCase().includes(term) ||
        (note.reason ?? "").toLowerCase().includes(term) ||
        orderIds.some((id) => orderNumber(id).toLowerCase().includes(term) || id === term) ||
        note.id.toLowerCase() === term
      );
    });
  }, [inFilter, term, orderNumber]);

  return (
    <>
      <WorkspaceSearch
        value={search}
        onChange={onSearch}
        placeholder="Search credit notes…"
        label="Search credit notes by number, customer, reason or order number"
        summary={
          listed ? (
            <>
              {visible.length} of {inFilter.length}{" "}
              {filter.status ? filter.label.toLowerCase() : ""} credit notes
            </>
          ) : undefined
        }
      />

      {isPending ? <WorkspaceListSkeleton /> : null}

      {error ? (
        <Card>
          <EmptyState
            title="Could not load credit notes"
            description={error.message}
            action={
              <Button variant="outline" onClick={onRetry}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : null}

      {listed && visible.length === 0 ? (
        <Card>
          {term ? (
            <EmptyState
              icon={<SearchX />}
              title={`No credit notes match “${deferredSearch.trim()}”`}
              action={
                <Button variant="outline" onClick={() => onSearch("")}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<Receipt />}
              title={
                filter.status
                  ? `No ${filter.label.toLowerCase()} credit notes`
                  : "No credit notes yet"
              }
            />
          )}
        </Card>
      ) : null}

      {visible.length > 0 ? (
        <Card>
          <ul className="divide-y divide-border">
            {visible.map(({ note, customer }) => (
              <li key={note.id}>
                <CreditNoteRow
                  note={note}
                  customer={customer}
                  href={workspaceHref(filter.key, note.id)}
                  orderNumber={orderNumber}
                  canWrite={canWrite}
                  onApply={() => onApply(note)}
                  onCancel={() => onCancel(note)}
                  onReverse={() => onReverse(note)}
                />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

/**
 * One note in the list: the row opens it, and the actions its status allows
 * sit under it rather than inside it, since a button cannot live inside
 * a link.
 */
function CreditNoteRow({
  note,
  customer,
  href,
  orderNumber,
  canWrite,
  onApply,
  onCancel,
  onReverse,
}: {
  note: CreditNoteView;
  customer: CustomerView | undefined;
  href: string;
  orderNumber: (orderId: string) => string;
  canWrite: boolean;
  onApply: () => void;
  onCancel: () => void;
  onReverse: () => void;
}) {
  const currency = note.amount.currency;
  const remaining = { amount: remainingCredit(note), currency };
  const name = customer?.fullName ?? note.customerId;
  const live = note.status === "ISSUED";
  const unused = Number(note.appliedAmount.amount) === 0;

  return (
    <div className="flex flex-col">
      <Link
        href={href}
        className="group flex min-w-0 items-center gap-4 px-4 py-3.5 transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
        aria-label={`Open ${note.creditNoteNumber} for ${name}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-sm font-semibold">{name}</span>
            <Badge variant={CREDIT_NOTE_STATUS_VARIANT[note.status]}>{note.status}</Badge>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span className="font-mono">{note.creditNoteNumber}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular">{formatEventDate(note.issuedOn)}</span>
            <span aria-hidden="true">·</span>
            <span>
              {note.againstOrderId ? (
                <>
                  Against <span className="font-mono">{orderNumber(note.againstOrderId)}</span>
                </>
              ) : (
                "Goodwill"
              )}
            </span>
          </p>
          {note.reason ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{note.reason}</p>
          ) : null}
          {/* On a narrow screen the figures sit under the name. */}
          <p className="mt-1 text-xs text-muted-foreground tabular sm:hidden">
            {formatMoney(note.appliedAmount)} applied of {formatMoney(note.amount)} ·{" "}
            <span className="font-medium text-foreground">{formatMoney(remaining)} left</span>
          </p>
        </div>

        <dl className="hidden shrink-0 items-center gap-6 text-right sm:flex">
          <div className="hidden w-24 lg:block">
            <dt className="text-[0.7rem] text-muted-foreground">Amount</dt>
            <dd className="tabular text-sm">{formatMoney(note.amount)}</dd>
          </div>
          <div className="w-24">
            <dt className="text-[0.7rem] text-muted-foreground">Applied</dt>
            <dd className="tabular text-sm">{formatMoney(note.appliedAmount)}</dd>
          </div>
          <div className="w-24">
            <dt className="text-[0.7rem] text-muted-foreground">Remaining</dt>
            <dd className="tabular text-sm font-semibold">{formatMoney(remaining)}</dd>
          </div>
        </dl>

        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>

      {canWrite && live ? (
        <div className="-mt-1.5 flex gap-1 px-4 pb-3">
          <Button size="sm" variant="outline" onClick={onApply} aria-label={`Apply ${note.creditNoteNumber}`}>
            Apply
          </Button>
          {unused ? (
            <Button size="sm" variant="ghost" onClick={onCancel} aria-label={`Cancel ${note.creditNoteNumber}`}>
              Cancel
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={onReverse} aria-label={`Reverse ${note.creditNoteNumber}`}>
            Reverse
          </Button>
        </div>
      ) : null}
    </div>
  );
}
