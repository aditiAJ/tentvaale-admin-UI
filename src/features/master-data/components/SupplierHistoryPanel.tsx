"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, History, Search } from "lucide-react";
import { listSupplierStockHistory, masterDataKeys } from "@/features/master-data/api";
import type { SupplierStockHistoryView, SupplierView } from "@/features/master-data/types";
import { formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Pagination, paginate } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const inr = (amount: number | null) => (amount == null ? "—" : formatMoney({ amount, currency: "INR" }));

/** "20 → 15" for a count that changed, or just "15" for the first entry of an item. */
function Change({ from, to }: { from: number | string | null; to: number | string }) {
  if (from === null || from === to) return <span className="tabular">{to}</span>;
  return (
    <span className="tabular inline-flex items-center gap-1">
      <span className="text-muted-foreground">{from}</span>
      <ArrowRight className="size-3 text-muted-foreground" aria-hidden="true" />
      <span className="font-medium">{to}</span>
    </span>
  );
}

const labelOf = (entry: Pick<SupplierStockHistoryView, "productName" | "variantName">) =>
  entry.variantName && entry.variantName !== "Standard" ? `${entry.productName} (${entry.variantName})` : entry.productName;

/**
 * Every change to what this supplier can provide, newest first: who made it, when, the count and rate before and
 * after, and the reason when one was given. Product names are kept as they were when the change was made.
 */
export function SupplierHistoryPanel({ supplier }: { supplier: SupplierView }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const history = useQuery({
    queryKey: masterDataKeys.supplierStockHistory(supplier.id),
    queryFn: ({ signal }) => listSupplierStockHistory(supplier.id, signal),
  });

  const all = useMemo(() => history.data ?? [], [history.data]);
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter((entry) =>
      `${labelOf(entry)} ${entry.reason ?? ""} ${entry.changedBy ?? ""}`.toLowerCase().includes(term),
    );
  }, [all, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          The latest 200 changes to what {supplier.name} can provide.
        </p>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Product, reason or person"
            aria-label="Search the history"
            className="pl-8"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-border">
        <TableWrapper>
          <Table>
            <THead>
              <tr>
                <TH>When</TH>
                <TH>Item</TH>
                <TH className="text-right">Available</TH>
                <TH className="text-right">Rate</TH>
                <TH>By</TH>
                <TH>Reason</TH>
              </tr>
            </THead>
            <TBody>
              {history.isPending ? <TableSkeleton rows={4} columns={6} /> : null}
              {paginate(rows, page, pageSize).map((entry) => (
                <TR key={entry.id}>
                  <TD className="text-xs whitespace-nowrap text-muted-foreground">{formatDateTime(entry.changedAt)}</TD>
                  <TD className="font-medium">{labelOf(entry)}</TD>
                  <TD className="text-right">
                    <Change from={entry.previousQuantity} to={entry.newQuantity} />
                  </TD>
                  <TD className="text-right">
                    <Change from={entry.previousRate === null ? null : inr(entry.previousRate)} to={inr(entry.newRate)} />
                  </TD>
                  <TD className="text-xs">{entry.changedBy ?? <span className="text-muted-foreground">—</span>}</TD>
                  <TD className="text-xs">{entry.reason ?? <span className="text-muted-foreground">—</span>}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrapper>

        {history.isError ? (
          <EmptyState
            title="Could not load the history"
            description={history.error instanceof Error ? history.error.message : undefined}
            action={
              <Button variant="outline" onClick={() => history.refetch()}>
                Try again
              </Button>
            }
          />
        ) : null}
        {history.data && !all.length ? (
          <EmptyState
            icon={<History />}
            title="No changes recorded yet"
            description="Each time a count or rate is set, it is noted here."
          />
        ) : null}
        {all.length > 0 && rows.length === 0 ? <EmptyState title="Nothing matches that search" /> : null}

        <Pagination
          page={page}
          pageSize={pageSize}
          total={rows.length}
          noun="changes"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>
    </div>
  );
}
