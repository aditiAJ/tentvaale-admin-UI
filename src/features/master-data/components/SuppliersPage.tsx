"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  ChevronRight,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Search,
} from "lucide-react";
import { listSuppliers, masterDataKeys } from "@/features/master-data/api";
import type { SupplierView } from "@/features/master-data/types";
import { SupplierDialog } from "@/features/master-data/components/SupplierDialog";
import { SupplierDetail } from "@/features/master-data/components/SupplierDetail";
import { telUrl, whatsappUrl } from "@/features/master-data/supplierUtils";
import { useCan } from "@/features/auth";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Pagination, paginate } from "@/components/ui/pagination";
import { nextSort, SortHeader } from "@/components/ui/sort-header";
import { TableSkeleton } from "@/components/ui/skeleton";
import { formatCount } from "@/components/ui/stat";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** The path that opens one supplier. The id lives in the address, so Back returns to the same list. */
export const supplierHref = (id: string) => `/master-data/suppliers?supplier=${encodeURIComponent(id)}`;

/**
 * Rental suppliers and what each can provide. Internal only: customers never see a supplier. With a `selectedId`
 * (from `?supplier=`) the page shows that supplier's workspace instead of the list.
 */
export function SuppliersPage({ selectedId }: { selectedId?: string }) {
  return selectedId ? <SupplierDetail supplierId={selectedId} /> : <SupplierList />;
}

type Status = "all" | "active" | "inactive";
type SortKey = "name" | "location" | "leadTime" | "products" | "units";

const STATUSES: { id: Status; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
];

/** Name, contact, email, place and GSTIN match as typed; a phone matches on its digits, however it was spaced. */
function matches(supplier: SupplierView, term: string): boolean {
  const text = [
    supplier.name,
    supplier.contactPerson,
    supplier.email,
    supplier.city,
    supplier.state,
    supplier.gstin,
  ]
    .join(" ")
    .toLowerCase();
  if (text.includes(term)) return true;
  const digits = term.replace(/\D/g, "");
  return digits.length >= 3 && (supplier.phone ?? "").replace(/\D/g, "").includes(digits);
}

const COMPARE: Record<SortKey, (a: SupplierView, b: SupplierView) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  location: (a, b) =>
    `${a.state ?? "~"} ${a.city ?? ""}`.localeCompare(`${b.state ?? "~"} ${b.city ?? ""}`),
  // A supplier with no lead time known sorts after the ones that have one.
  leadTime: (a, b) => (a.leadTimeDays ?? Infinity) - (b.leadTimeDays ?? Infinity),
  products: (a, b) => a.productCount - b.productCount,
  units: (a, b) => a.totalUnits - b.totalUnits,
};

const dash = <span className="text-muted-foreground">—</span>;

function SupplierList() {
  const canWrite = useCan("LOGISTICS_WRITE");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SupplierView | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({ key: "name", descending: false });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: masterDataKeys.suppliers,
    queryFn: ({ signal }) => listSuppliers(signal),
  });

  const deferredSearch = useDeferredValue(search);
  const all = useMemo(() => data ?? [], [data]);

  const counts: Record<Status, number> = {
    all: all.length,
    active: all.filter((s) => s.active).length,
    inactive: all.filter((s) => !s.active).length,
  };

  const visible = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    const compare = COMPARE[sort.key];
    return all
      .filter((s) => (status === "all" || (status === "active") === s.active) && (!term || matches(s, term)))
      .sort((a, b) => (sort.descending ? -compare(a, b) : compare(a, b)) || a.name.localeCompare(b.name));
  }, [all, deferredSearch, status, sort]);

  const rows = paginate(visible, page, pageSize);
  const filtering = search.trim() !== "" || status !== "all";

  const onSort = (key: SortKey) => {
    setSort((current) => nextSort(current, key));
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Suppliers"
        description="Outside rental partners you can draw stock from when your own runs out."
        actions={
          canWrite ? (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              New supplier
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={status === s.id}
              onClick={() => {
                setStatus(s.id);
                setPage(1);
              }}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                status === s.id
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {s.label}
              {data ? <span className="tabular ml-1.5 text-muted-foreground">{counts[s.id]}</span> : null}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search name, contact, phone, city or GSTIN"
            className="pl-8"
            aria-label="Search suppliers"
          />
        </div>
      </div>

      <Card>
        <TableWrapper>
          <Table>
            <THead>
              <tr>
                <SortHeader label="Supplier" column="name" sort={sort} onSort={onSort} />
                <TH>Contact</TH>
                <SortHeader label="Location" column="location" sort={sort} onSort={onSort} />
                <SortHeader label="Lead time" column="leadTime" sort={sort} onSort={onSort} className="text-right" />
                <SortHeader label="Products" column="products" sort={sort} onSort={onSort} className="text-right" />
                <SortHeader label="Units" column="units" sort={sort} onSort={onSort} className="text-right" />
                <TH className="text-right">
                  <span className="sr-only">Actions</span>
                </TH>
              </tr>
            </THead>
            <TBody>
              {isPending ? <TableSkeleton columns={7} /> : null}

              {!isPending
                ? rows.map((supplier) => {
                    const call = telUrl(supplier.phone);
                    const chat = whatsappUrl(supplier.phone);
                    return (
                      <TR key={supplier.id} className={cn(!supplier.active && "text-muted-foreground")}>
                        <TD>
                          <Link
                            href={supplierHref(supplier.id)}
                            className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:underline"
                          >
                            {supplier.name}
                          </Link>
                          {!supplier.active ? <Badge className="ml-2">Inactive</Badge> : null}
                          {supplier.contactPerson ? (
                            <span className="block text-xs text-muted-foreground">{supplier.contactPerson}</span>
                          ) : null}
                        </TD>
                        <TD className="text-xs">
                          {supplier.phone || supplier.email ? (
                            <div className="space-y-0.5">
                              {supplier.phone ? (
                                <div className="flex items-center gap-1.5">
                                  {call ? (
                                    <a
                                      href={call}
                                      className="tabular inline-flex items-center gap-1 hover:underline"
                                      title="Call"
                                    >
                                      <Phone className="size-3" aria-hidden="true" />
                                      {supplier.phone}
                                    </a>
                                  ) : (
                                    <span className="tabular">{supplier.phone}</span>
                                  )}
                                  {chat ? (
                                    <a
                                      href={chat}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      aria-label={`WhatsApp ${supplier.name}`}
                                      title="Open WhatsApp"
                                      className="text-[var(--success)] hover:opacity-80"
                                    >
                                      <MessageCircle className="size-3.5" />
                                    </a>
                                  ) : null}
                                </div>
                              ) : null}
                              {supplier.email ? (
                                <a
                                  href={`mailto:${supplier.email}`}
                                  className="inline-flex items-center gap-1 hover:underline"
                                  title="Send an email"
                                >
                                  <Mail className="size-3" aria-hidden="true" />
                                  {supplier.email}
                                </a>
                              ) : null}
                            </div>
                          ) : (
                            dash
                          )}
                        </TD>
                        <TD className="text-xs">
                          {supplier.city || supplier.state
                            ? [supplier.city, supplier.state].filter(Boolean).join(", ")
                            : dash}
                        </TD>
                        <TD className="tabular text-right">
                          {supplier.leadTimeDays == null
                            ? dash
                            : supplier.leadTimeDays === 0
                              ? "Same day"
                              : `${supplier.leadTimeDays} ${supplier.leadTimeDays === 1 ? "day" : "days"}`}
                        </TD>
                        <TD className="tabular text-right">
                          {supplier.productCount ? formatCount(supplier.productCount) : dash}
                        </TD>
                        <TD className="tabular text-right">
                          {supplier.totalUnits ? formatCount(supplier.totalUnits) : dash}
                        </TD>
                        <TD>
                          <div className="flex justify-end gap-1">
                            {canWrite ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditing(supplier)}
                                aria-label={`Edit ${supplier.name}`}
                                title="Edit"
                              >
                                <Pencil />
                              </Button>
                            ) : null}
                            <Link
                              href={supplierHref(supplier.id)}
                              aria-label={`Open ${supplier.name}`}
                              title="Open"
                              className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                              <ChevronRight className="size-4" />
                            </Link>
                          </div>
                        </TD>
                      </TR>
                    );
                  })
                : null}
            </TBody>
          </Table>
        </TableWrapper>

        {isError ? (
          <EmptyState
            title="Could not load suppliers"
            description={error instanceof Error ? error.message : undefined}
            action={
              <Button variant="outline" onClick={() => refetch()}>
                Try again
              </Button>
            }
          />
        ) : null}

        {!isPending && !isError && !all.length ? (
          <EmptyState
            icon={<Building2 />}
            title="No suppliers yet"
            description="Add the outside partners you rent from, then record what each can provide."
            action={
              canWrite ? (
                <Button onClick={() => setCreating(true)}>
                  <Plus />
                  New supplier
                </Button>
              ) : null
            }
          />
        ) : null}

        {!isPending && !isError && all.length > 0 && visible.length === 0 ? (
          <EmptyState
            title="No supplier matches"
            description="Try another word, or clear the filters."
            action={
              filtering ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setStatus("all");
                    setPage(1);
                  }}
                >
                  Show all suppliers
                </Button>
              ) : undefined
            }
          />
        ) : null}

        {!isPending && !isError ? (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={visible.length}
            noun="suppliers"
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        ) : null}
      </Card>

      <p className="text-xs text-muted-foreground tabular" aria-live="polite">
        {isPending ? "Loading…" : `${visible.length} of ${all.length} suppliers`}
        {isFetching && !isPending ? " · refreshing" : ""}
      </p>

      {creating ? <SupplierDialog onClose={() => setCreating(false)} /> : null}
      {editing ? <SupplierDialog existing={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
