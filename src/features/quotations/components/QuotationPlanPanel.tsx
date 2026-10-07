"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ExternalLink, MapPin } from "lucide-react";
import { getQuotationPlan, quotationKeys } from "@/features/quotations/api";
import { isFromStorefront } from "@/features/quotations/source";
import type { QuotationVenue, QuotationView } from "@/features/quotations/types";
import { IS_MOCK } from "@/services/data-source";
import { Badge } from "@/components/ui/badge";

const weekday = new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "UTC" });
const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
/** "Tue 10 Nov 2026". */
const formatDay = (value?: string | null) => {
  if (!value) return "Date not set";
  const date = new Date(`${value}T00:00:00Z`);
  return `${weekday.format(date)} ${day.format(date)}`;
};

/** A Google Maps link for a venue: the exact point when the customer picked one, else a search on the text. */
function mapLink(venue: QuotationVenue) {
  const query =
    venue.latitude != null && venue.longitude != null ? `${venue.latitude},${venue.longitude}` : encodeURIComponent(venue.text);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

/** "Banquet Chair (Black)" is shown as the name with "Black" beside it. */
function splitVariant(productName: string) {
  const match = /^(.*?)\s*\(([^()]+)\)$/.exec(productName);
  return match ? { name: match[1], variant: match[2] } : { name: productName, variant: null };
}

interface PlanItem {
  id: string;
  productName: string;
  quantity: number;
  rentalDays: number;
  subEventIds: string[];
}

function ItemRows({ items }: { items: PlanItem[] }) {
  return (
    <ul className="divide-y divide-border">
      {items.map((item) => {
        const { name, variant } = splitVariant(item.productName);
        return (
          <li key={item.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium">{name}</span>
              {variant ? <Badge>{variant}</Badge> : null}
              {item.subEventIds.length > 1 ? <Badge variant="outline">Shared across functions</Badge> : null}
            </div>
            <span className="tabular w-16 shrink-0 text-right font-medium">× {item.quantity}</span>
            <span className="tabular w-16 shrink-0 text-right text-xs text-muted-foreground">
              {item.rentalDays} day{item.rentalDays === 1 ? "" : "s"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Read-only: the customer's plan behind a storefront quotation (functions, items, days, venue), so
 * staff know where the event is and what each line is for. Nothing here can be changed.
 */
export function QuotationPlanPanel({ quotation }: { quotation: QuotationView }) {
  const enabled = !IS_MOCK && isFromStorefront(quotation);
  const plan = useQuery({
    queryKey: quotationKeys.plan(quotation.id),
    queryFn: ({ signal }) => getQuotationPlan(quotation.id, signal),
    enabled,
  });

  if (!enabled && !quotation.venue) return null;

  const functions = plan.data?.subEvents ?? [];
  const wholeEvent = plan.data?.generalItems ?? [];
  const itemCount = functions.reduce((sum, fn) => sum + fn.items.length, 0) + wholeEvent.length;

  return (
    <section className="mt-5 space-y-4 border-t border-border pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Where and what</h3>
        {plan.data ? (
          <p className="text-xs text-muted-foreground">
            {functions.length} function{functions.length === 1 ? "" : "s"} · {itemCount} item line{itemCount === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MapPin className="size-4" />
        </span>
        {quotation.venue ? (
          <>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Venue</p>
              <p className="font-medium wrap-break-word">{quotation.venue.text}</p>
            </div>
            <a
              href={mapLink(quotation.venue)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-primary hover:bg-muted"
            >
              Open map <ExternalLink className="size-3" />
            </a>
          </>
        ) : (
          <p className="text-muted-foreground">The customer did not give a venue.</p>
        )}
      </div>

      {plan.isPending && enabled ? <p className="text-xs text-muted-foreground">Loading the plan…</p> : null}

      {plan.data ? (
        <div className="space-y-3">
          {functions.map((fn) => (
            <div key={fn.id} className="overflow-hidden rounded-lg border border-border">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-muted/40 px-4 py-2.5">
                <p className="text-sm font-semibold">{fn.name}</p>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarDays className="size-3.5" />
                  {formatDay(fn.scheduledOn)}
                </span>
                {fn.venueDetail ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3.5" />
                    {fn.venueDetail.label}
                  </span>
                ) : null}
                <span className="ml-auto text-xs text-muted-foreground">
                  {fn.items.length} item{fn.items.length === 1 ? "" : "s"}
                </span>
              </div>
              {fn.items.length ? (
                <ItemRows items={fn.items} />
              ) : (
                <p className="px-4 py-3 text-sm text-muted-foreground">Nothing added to this function.</p>
              )}
            </div>
          ))}

          {wholeEvent.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/40 px-4 py-2.5">
                <p className="text-sm font-semibold">Whole event</p>
                <span className="text-xs text-muted-foreground">Not tied to one function</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {wholeEvent.length} item{wholeEvent.length === 1 ? "" : "s"}
                </span>
              </div>
              <ItemRows items={wholeEvent} />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
