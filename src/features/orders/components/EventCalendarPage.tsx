"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CalendarX, ChevronLeft, ChevronRight, ClipboardList, FileText, PartyPopper } from "lucide-react";
import { listOrders, orderKeys } from "@/features/orders/api";
import { ORDER_STATUSES, ORDER_STATUS_MEANING, type OrderStatus, type OrderView } from "@/features/orders/types";
import { ORDER_STATUS_VARIANT } from "@/features/orders/display";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

/** One colour per stage, used for the dot on a small screen, the edge of a chip on a big one, and the filter. */
const STAGE: Record<OrderStatus, { label: string; dot: string; edge: string }> = {
  CONFIRMED: { label: "Confirmed", dot: "bg-primary", edge: "border-l-primary" },
  DISPATCHED: { label: "Dispatched", dot: "bg-sky-500", edge: "border-l-sky-500" },
  INSTALLATION: { label: "Installation", dot: "bg-violet-500", edge: "border-l-violet-500" },
  RETURNED: { label: "Returned", dot: "bg-warning", edge: "border-l-warning" },
  COMPLETED: { label: "Completed", dot: "bg-success", edge: "border-l-success" },
  CANCELLED: { label: "Cancelled", dot: "bg-destructive/60", edge: "border-l-destructive/60" },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthName = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" });
const dayName = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortDay = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" });

const pad = (n: number) => String(n).padStart(2, "0");
/** Dates here are plain yyyy-MM-dd text, the same as an order's event date, so no time zone can move one to another day. */
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (value: string, days: number) => {
  const d = parse(value);
  d.setDate(d.getDate() + days);
  return iso(d);
};

/** Every confirmed order on the day of its event, as a month, with the day's orders beside it. */
export function EventCalendarPage() {
  const list = useQuery({
    queryKey: orderKeys.list,
    queryFn: ({ signal }) => listOrders(signal),
    staleTime: 0,
    retry: false,
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Event calendar" description="Every order on the day of its event, from the moment a quotation is converted." />
      {list.isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-[480px]" />
        </div>
      ) : list.isError ? (
        <Alert tone="error" title="The orders could not be loaded.">
          <Button size="sm" variant="outline" className="mt-2" onClick={() => list.refetch()}>
            Try again
          </Button>
        </Alert>
      ) : (
        // Mounted only once the orders are here, so "today" is read in the browser and never differs from the server's.
        <Calendar orders={list.data} />
      )}
    </div>
  );
}

function Calendar({ orders }: { orders: OrderView[] }) {
  const [today] = useState(() => iso(new Date()));
  const [cursor, setCursor] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));
  const [selected, setSelected] = useState(today);
  // A cancelled order is not an event any more; it can be shown again with its filter.
  const [hidden, setHidden] = useState<Set<OrderStatus>>(() => new Set<OrderStatus>(["CANCELLED"]));

  const dated = useMemo(() => orders.filter((o) => o.eventDate), [orders]);
  const byDate = useMemo(() => {
    const map = new Map<string, OrderView[]>();
    for (const o of dated) {
      if (hidden.has(o.status)) continue;
      const day = (o.eventDate as string).slice(0, 10);
      map.set(day, [...(map.get(day) ?? []), o]);
    }
    return map;
  }, [dated, hidden]);

  const monthKey = `${cursor.y}-${pad(cursor.m + 1)}`;
  const monthStageCount = useMemo(() => {
    const counts = new Map<OrderStatus, number>();
    for (const o of dated) if ((o.eventDate as string).startsWith(monthKey)) counts.set(o.status, (counts.get(o.status) ?? 0) + 1);
    return counts;
  }, [dated, monthKey]);
  const inMonth = [...byDate.entries()].filter(([day]) => day.startsWith(monthKey)).reduce((n, [, os]) => n + os.length, 0);
  const next7 = Array.from({ length: 7 }, (_, i) => byDate.get(addDays(today, i))?.length ?? 0).reduce((a, b) => a + b, 0);
  const noDate = orders.length - dated.length;

  // The grid always starts on a Sunday and ends on a Saturday, so the weeks are whole.
  const first = new Date(cursor.y, cursor.m, 1);
  const weeks = Math.ceil((first.getDay() + new Date(cursor.y, cursor.m + 1, 0).getDate()) / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => iso(new Date(cursor.y, cursor.m, 1 - first.getDay() + i)));

  const pick = (day: string) => {
    setSelected(day);
    setCursor({ y: Number(day.slice(0, 4)), m: Number(day.slice(5, 7)) - 1 });
  };
  const go = (delta: number) => {
    const target = new Date(cursor.y, cursor.m + delta, 1);
    const key = `${target.getFullYear()}-${pad(target.getMonth() + 1)}`;
    setCursor({ y: target.getFullYear(), m: target.getMonth() });
    setSelected(today.startsWith(key) ? today : `${key}-01`);
  };
  const toggle = (status: OrderStatus) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });

  // Arrow keys walk the days; one tab stop for the whole grid.
  const onKey = (event: React.KeyboardEvent, day: string) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (!step) return;
    event.preventDefault();
    const target = addDays(day, step);
    pick(target);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-day="${target}"]`)?.focus());
  };

  const dayOrders = byDate.get(selected) ?? [];
  const upcoming = useMemo(
    () =>
      [...byDate.entries()]
        // Only what is still ahead: from today on, whichever day is open, and never a past date.
        .filter(([day]) => day >= today)
        .sort(([a], [b]) => a.localeCompare(b))
        .flatMap(([day, os]) => os.filter((o) => o.status !== "COMPLETED").map((o) => ({ day, order: o })))
        .slice(0, 5),
    [byDate, today],
  );

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="This month" value={inMonth} hint={inMonth === 1 ? "event" : "events"} />
        <Stat label="Today" value={byDate.get(today)?.length ?? 0} hint={shortDay.format(parse(today))} />
        <Stat label="Next 7 days" value={next7} hint="starting today" />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-3 sm:px-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-5 text-primary" />
              <h2 className="text-base font-semibold tracking-tight sm:text-lg" aria-live="polite">
                {monthName.format(first)}
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" onClick={() => pick(today)} disabled={selected === today && monthKey === today.slice(0, 7)}>
                Today
              </Button>
              <Button size="icon" variant="outline" className="size-8" aria-label="Previous month" onClick={() => go(-1)}>
                <ChevronLeft />
              </Button>
              <Button size="icon" variant="outline" className="size-8" aria-label="Next month" onClick={() => go(1)}>
                <ChevronRight />
              </Button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto border-b border-border px-3 py-2.5 sm:px-4" role="group" aria-label="Show stages">
            {ORDER_STATUSES.map((status) => {
              const on = !hidden.has(status);
              return (
                <button
                  key={status}
                  type="button"
                  aria-pressed={on}
                  title={ORDER_STATUS_MEANING[status]}
                  onClick={() => toggle(status)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                    on ? "border-border bg-card" : "border-dashed border-border text-muted-foreground opacity-60 hover:opacity-100",
                  )}
                >
                  <span className={cn("size-2 rounded-full", STAGE[status].dot)} />
                  {STAGE[status].label}
                  <span className="tabular text-muted-foreground">{monthStageCount.get(status) ?? 0}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2">
                <span className="sm:hidden">{d[0]}</span>
                <span className="hidden sm:inline">{d}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              const os = byDate.get(day) ?? [];
              const outside = !day.startsWith(monthKey);
              const isToday = day === today;
              const on = day === selected;
              return (
                <button
                  key={day}
                  type="button"
                  data-day={day}
                  tabIndex={on ? 0 : -1}
                  aria-pressed={on}
                  aria-label={`${dayName.format(parse(day))}, ${os.length === 0 ? "no events" : `${os.length} ${os.length === 1 ? "event" : "events"}`}`}
                  onClick={() => pick(day)}
                  onKeyDown={(e) => onKey(e, day)}
                  className={cn(
                    "relative flex min-h-[58px] flex-col items-center gap-1 border-b border-r border-border p-1 text-left transition-colors outline-none sm:min-h-[96px] sm:items-stretch sm:p-1.5 lg:min-h-[116px]",
                    i % 7 === 6 && "border-r-0",
                    i >= cells.length - 7 && "border-b-0",
                    outside ? "bg-muted/30 text-muted-foreground" : "bg-card hover:bg-accent/60",
                    on && "z-10 bg-primary/10 ring-2 ring-primary ring-inset",
                    "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
                  )}
                >
                  <span
                    className={cn(
                      "tabular flex size-6 items-center justify-center rounded-full text-xs font-medium sm:self-start",
                      isToday && "bg-primary text-primary-foreground",
                    )}
                  >
                    {Number(day.slice(8))}
                  </span>

                  {/* Small screen: a dot for each order. */}
                  <span className="flex flex-wrap justify-center gap-0.5 sm:hidden">
                    {os.slice(0, 4).map((o) => (
                      <span key={o.id} className={cn("size-1.5 rounded-full", STAGE[o.status].dot)} />
                    ))}
                    {os.length > 4 ? <span className="text-[9px] leading-[6px] text-muted-foreground">+</span> : null}
                  </span>

                  {/* From a tablet up: the customer on a chip. */}
                  <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                    {os.slice(0, 3).map((o) => (
                      <span
                        key={o.id}
                        className={cn(
                          "block truncate rounded-sm border-l-[3px] bg-muted/70 px-1.5 py-0.5 text-[11px] leading-4 text-foreground",
                          STAGE[o.status].edge,
                          o.status === "CANCELLED" && "line-through opacity-60",
                        )}
                      >
                        {o.customerName}
                      </span>
                    ))}
                    {os.length > 3 ? <span className="px-1 text-[11px] font-medium text-primary">+{os.length - 3} more</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        <aside className="space-y-3 xl:sticky xl:top-4" aria-label="Orders on the chosen day">
          <div>
            <p className="text-xs text-muted-foreground">{selected === today ? "Today" : selected < today ? "Past" : "Coming"}</p>
            <h2 className="text-base font-semibold tracking-tight">{dayName.format(parse(selected))}</h2>
          </div>

          {dayOrders.length === 0 ? (
            <Card>
              <EmptyState
                icon={<CalendarX />}
                title="No events on this day"
                description={noDate > 0 && upcoming.length === 0 ? `${noDate} order${noDate === 1 ? " has" : "s have"} no event date yet.` : "Nothing is booked for it."}
              />
            </Card>
          ) : (
            dayOrders.map((o) => <DayOrder key={o.id} order={o} />)
          )}

          {upcoming.length > 0 && dayOrders.length === 0 ? (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <PartyPopper className="size-3.5" /> Coming up
              </p>
              {upcoming.map(({ day, order }) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => pick(day)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:border-primary/40"
                >
                  <span className={cn("h-8 w-1 shrink-0 rounded-full", STAGE[order.status].dot)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{order.customerName}</span>
                    <span className="block text-xs text-muted-foreground">{shortDay.format(parse(day))}</span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <Card className="px-3 py-3 sm:px-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="tabular mt-0.5 text-2xl font-semibold">{value}</p>
      <p className="truncate text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}

function DayOrder({ order }: { order: OrderView }) {
  const open = order.status !== "CANCELLED";
  return (
    <Card className={cn("overflow-hidden border-l-4", STAGE[order.status].edge)}>
      <Link href={`/orders?id=${order.id}`} className="block space-y-1.5 p-3 transition-colors hover:bg-accent/50">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 text-sm font-semibold wrap-break-word">{order.customerName}</p>
          <Badge variant={ORDER_STATUS_VARIANT[order.status]} title={ORDER_STATUS_MEANING[order.status]}>
            {STAGE[order.status].label}
          </Badge>
        </div>
        <p className="font-mono text-xs">{order.orderNumber}</p>
        <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
          <span>
            {order.lines.length} {order.lines.length === 1 ? "item" : "items"}
          </span>
          <span>·</span>
          <span className="tabular">{formatMoney(order.totalAmount)}</span>
        </p>
      </Link>
      {open ? (
        <div className="flex gap-1.5 border-t border-border px-2 py-1.5">
          <Link href={`/orders/dispatch?id=${order.id}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 flex-1 text-xs")}>
            <ClipboardList /> Dispatch list
          </Link>
          <Link href={`/orders/challan?id=${order.id}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 flex-1 text-xs")}>
            <FileText /> Challan
          </Link>
        </div>
      ) : null}
    </Card>
  );
}
