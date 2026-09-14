"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, CircleAlert, CircleCheck, CircleSlash, Clock, Search } from "lucide-react";
import {
  listNotifications,
  listNotificationsBySubject,
  notificationKeys,
} from "@/features/notifications/api";
import {
  CHANNELS,
  DELIVERY_STATUSES,
  DELIVERY_STATUS_MEANING,
  type DeliveryStatus,
  type NotificationLogView,
} from "@/features/notifications/types";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const COLUMNS = 6;

/**
 * 200 is the backend's own ceiling (NotificationService.MAX_LIMIT clamps to it),
 * so a larger option here would silently return 200 and quietly lie about what
 * the user is looking at. Rows arrive ordered attemptedAt DESC from the
 * repository, so no client-side sort is applied.
 */
const LIMITS = [50, 100, 200];

/**
 * Status carries both an icon and a word, never colour alone — these rows are
 * scanned for failures, which is exactly the case where colour-only encoding
 * fails a red-green colourblind reader.
 */
const STATUS_STYLE: Record<
  DeliveryStatus,
  { variant: "success" | "destructive" | "warning" | "default"; icon: typeof CircleCheck }
> = {
  SENT: { variant: "success", icon: CircleCheck },
  FAILED: { variant: "destructive", icon: CircleAlert },
  PENDING: { variant: "warning", icon: Clock },
  SKIPPED: { variant: "default", icon: CircleSlash },
};

function StatusBadge({ status }: { status: DeliveryStatus }) {
  const { variant, icon: Icon } = STATUS_STYLE[status];
  return (
    <Badge variant={variant} title={DELIVERY_STATUS_MEANING[status]}>
      <Icon className="size-3" aria-hidden="true" />
      {status}
    </Badge>
  );
}

export function NotificationsPage() {
  const [limit, setLimit] = useState(LIMITS[0]);
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  // `subject` is committed on submit, not on every keystroke: it is a separate
  // server round trip, unlike the other three which filter what is already here.
  const [subject, setSubject] = useState("");

  const deferredSearch = useDeferredValue(search);

  const recent = useQuery({
    queryKey: notificationKeys.recent(limit),
    queryFn: ({ signal }) => listNotifications(limit, signal),
    enabled: subject === "",
  });

  const bySubject = useQuery({
    queryKey: notificationKeys.bySubject(subject),
    queryFn: ({ signal }) => listNotificationsBySubject(subject, signal),
    enabled: subject !== "",
  });

  const query = subject === "" ? recent : bySubject;
  const { data, isPending, isError, error, refetch, isFetching } = query;

  const visible = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    return (data ?? []).filter((row: NotificationLogView) => {
      if (channel && row.channel !== channel) return false;
      if (status && row.status !== status) return false;
      if (!term) return true;
      return [row.recipient, row.subjectReference, row.templateKey]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [data, deferredSearch, channel, status]);

  const failures = visible.filter((row) => row.status === "FAILED").length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notifications"
        description="What was sent to customers, and what was not."
      />

      {failures > 0 ? (
        <Alert tone="warning" title={`${failures} failed ${failures === 1 ? "attempt" : "attempts"} in view`}>
          Nothing here retries on its own — a failed message has to be re-triggered from whatever
          raised it.
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter by recipient, subject or template"
            className="pl-8"
            aria-label="Filter loaded notifications"
          />
        </div>

        <Select
          value={channel}
          onChange={(event) => setChannel(event.target.value)}
          aria-label="Channel"
          className="w-36"
        >
          <option value="">All channels</option>
          {CHANNELS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>

        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Delivery status"
          className="w-36"
        >
          <option value="">All statuses</option>
          {DELIVERY_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>

        <Select
          value={limit}
          onChange={(event) => setLimit(Number(event.target.value))}
          aria-label="How many to load"
          disabled={subject !== ""}
          title={subject !== "" ? "Showing every attempt for one subject." : undefined}
          className="w-32"
        >
          {LIMITS.map((value) => (
            <option key={value} value={value}>
              Last {value}
            </option>
          ))}
        </Select>
      </div>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get("subjectReference");
          setSubject(typeof value === "string" ? value.trim() : "");
        }}
      >
        <div className="min-w-56 flex-1 sm:max-w-xs">
          <label htmlFor="subject-lookup" className="mb-1.5 block text-xs font-medium">
            Full history for one document
          </label>
          <Input
            id="subject-lookup"
            name="subjectReference"
            defaultValue={subject}
            placeholder="Quotation or order number"
          />
        </div>
        <Button type="submit" variant="outline">
          Look up
        </Button>
        {subject !== "" ? (
          <Button type="button" variant="ghost" onClick={() => setSubject("")}>
            Back to recent
          </Button>
        ) : null}
      </form>

      <p className="text-xs text-muted-foreground tabular" aria-live="polite">
        {isPending
          ? "Loading…"
          : subject !== ""
            ? `${visible.length} shown for “${subject}”`
            : `${visible.length} of ${data?.length ?? 0} loaded`}
        {isFetching && !isPending ? " · refreshing" : ""}
      </p>

      <Card>
        <TableWrapper>
          <Table>
            <THead>
              <tr>
                <TH>Attempted</TH>
                <TH>Channel</TH>
                <TH>Recipient</TH>
                <TH>Subject</TH>
                <TH>Template</TH>
                <TH>Status</TH>
              </tr>
            </THead>
            <TBody>
              {isPending ? <TableSkeleton columns={COLUMNS} /> : null}

              {visible.map((row) => (
                <TR key={row.id}>
                  <TD className="tabular whitespace-nowrap text-muted-foreground">
                    {formatDateTime(row.attemptedAt)}
                  </TD>
                  <TD>
                    <Badge variant="outline">{row.channel}</Badge>
                  </TD>
                  <TD className="max-w-56 truncate">{row.recipient}</TD>
                  <TD className="font-mono text-xs">{row.subjectReference}</TD>
                  <TD className="text-muted-foreground">{row.templateKey}</TD>
                  <TD>
                    <StatusBadge status={row.status} />
                    {row.failureReason ? (
                      <span className="mt-1 block max-w-64 text-xs text-destructive">
                        {row.failureReason}
                      </span>
                    ) : null}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrapper>

        {isError ? (
          <EmptyState
            title="Could not load the notification log"
            description={error instanceof Error ? error.message : undefined}
            action={
              <Button variant="outline" onClick={() => refetch()}>
                Try again
              </Button>
            }
          />
        ) : null}

        {!isPending && !isError && visible.length === 0 ? (
          <EmptyState
            icon={<Bell />}
            title={data?.length ? "Nothing matches those filters" : "No delivery attempts recorded"}
            description={
              data?.length
                ? "Try a different channel, status or search term."
                : "Messages appear here once something triggers one."
            }
          />
        ) : null}
      </Card>
    </div>
  );
}
