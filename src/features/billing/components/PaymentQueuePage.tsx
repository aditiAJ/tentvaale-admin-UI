"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCan } from "@/features/auth";
import {
  MODE_LABEL,
  PAYMENT_MODES,
  STATUS_LABEL,
  billingKeys,
  getLedger,
  type LedgerFilter,
  type PaymentMode,
  type PaymentStatus,
} from "@/features/billing/api";
import { PaymentRowActions, PaymentStatusCell } from "@/features/billing/components/PaymentParts";
import { formatMoney } from "@/lib/money";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

/** "" is every status; the page opens on what Accounts have to check. */
type StatusChoice = PaymentStatus | "";

/**
 * Every payment of the company, for Accounts: the ones waiting to be checked first, and a way to search the rest by
 * order, UTR or receipt number, mode and date. Verify, reject, edit, void and history work from here as they do on
 * an order.
 */
export function PaymentQueuePage() {
  const canWrite = useCan("PAYMENT_WRITE");
  const canVerify = useCan("PAYMENT_VERIFY");
  const canVoid = useCan("PAYMENT_VOID");
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusChoice>("RECORDED");
  const [mode, setMode] = useState<PaymentMode | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  /** Counts from 1 here (the Pagination control); the server counts from 0. */
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // The search waits for a pause in typing so each keystroke is not a request.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const filter: LedgerFilter = {
    status: status || undefined,
    mode: mode || undefined,
    from: from || undefined,
    to: to || undefined,
    q: q || undefined,
    page: page - 1,
    size: pageSize,
  };
  const ledger = useQuery({
    queryKey: billingKeys.ledger(filter),
    queryFn: ({ signal }) => getLedger(filter, signal),
    placeholderData: keepPreviousData,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["billing"] });
  const changeFilter = (apply: () => void) => {
    apply();
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Payments</h1>
        <p className="text-sm text-muted-foreground">
          Money staff have recorded. Only verified payments reduce an order&apos;s balance. Nothing is deleted: a mistake is
          edited before it is verified and voided after.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <Select
          className="w-52"
          value={status}
          onChange={(e) => changeFilter(() => setStatus(e.target.value as StatusChoice))}
          aria-label="Status"
        >
          <option value="">All statuses</option>
          {(Object.keys(STATUS_LABEL) as PaymentStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <Select
          className="w-40"
          value={mode}
          onChange={(e) => changeFilter(() => setMode(e.target.value as PaymentMode | ""))}
          aria-label="Mode"
        >
          <option value="">Any mode</option>
          {PAYMENT_MODES.map((m) => (
            <option key={m} value={m}>
              {MODE_LABEL[m]}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Paid from
          <Input className="w-40" type="date" value={from} onChange={(e) => changeFilter(() => setFrom(e.target.value))} />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          to
          <Input className="w-40" type="date" value={to} onChange={(e) => changeFilter(() => setTo(e.target.value))} />
        </label>
        <Input
          className="w-64"
          type="search"
          placeholder="Order, UTR or receipt number"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search payments"
        />
      </div>

      {ledger.isPending ? <Skeleton className="h-40" /> : null}
      {ledger.isError ? <Alert tone="error" title="The payments could not be loaded." /> : null}
      {ledger.data && ledger.data.items.length === 0 ? (
        <Card>
          <EmptyState title="Nothing here" description="No payments match these filters." />
        </Card>
      ) : null}
      {ledger.data && ledger.data.items.length > 0 ? (
        <TableWrapper>
          <Table>
            <THead>
              <TR>
                <TH>Order</TH>
                <TH>Date</TH>
                <TH>For</TH>
                <TH>Mode</TH>
                <TH>Reference</TH>
                <TH className="text-right">Amount</TH>
                <TH>Status</TH>
                <TH>Recorded by</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {ledger.data.items.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <Link href={p.orderId ? `/orders?id=${p.orderId}` : `/quotations?id=${p.quotationId}`} className="underline">
                      {p.orderNumber ?? p.quotationNumber}
                    </Link>
                  </TD>
                  <TD>{p.paidOn}</TD>
                  <TD>{p.purpose === "DEPOSIT" ? "Deposit" : "Rental"}</TD>
                  <TD>{MODE_LABEL[p.mode]}</TD>
                  <TD>
                    {p.reference ?? "—"}
                    {p.proofUrl ? (
                      <a href={p.proofUrl} target="_blank" rel="noreferrer" className="ml-2 text-xs underline">
                        proof
                      </a>
                    ) : null}
                  </TD>
                  <TD className="tabular text-right">{formatMoney(p.amount)}</TD>
                  <TD>
                    <PaymentStatusCell payment={p} />
                  </TD>
                  <TD>{p.recordedBy}</TD>
                  <TD>
                    <PaymentRowActions
                      payment={p}
                      canWrite={canWrite}
                      canVerify={canVerify}
                      canVoid={canVoid}
                      onChanged={refresh}
                    />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={ledger.data.total}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            noun="payments"
          />
        </TableWrapper>
      ) : null}
    </div>
  );
}
