"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, MapPin } from "lucide-react";
import { getQuotationPlan, quotationKeys } from "@/features/quotations/api";
import { isFromStorefront } from "@/features/quotations/source";
import type { QuotationVenue, QuotationView } from "@/features/quotations/types";
import { IS_MOCK } from "@/services/data-source";

const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const formatDay = (value?: string | null) => (value ? day.format(new Date(`${value}T00:00:00Z`)) : "Date not set");

/** A Google Maps link for a venue: the exact point when the customer picked one, else a search on the text. */
function mapLink(venue: QuotationVenue) {
  const query =
    venue.latitude != null && venue.longitude != null ? `${venue.latitude},${venue.longitude}` : encodeURIComponent(venue.text);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
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

  return (
    <section className="mt-4 space-y-3 border-t border-border pt-4">
      <h3 className="text-sm font-medium">Where and what</h3>
      {quotation.venue ? (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <MapPin className="size-4 text-muted-foreground" />
          <span>{quotation.venue.text}</span>
          <a
            href={mapLink(quotation.venue)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            Open map <ExternalLink className="size-3" />
          </a>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">No venue given.</p>
      )}
      {plan.isPending && enabled ? <p className="text-xs text-muted-foreground">Loading the plan…</p> : null}
      {plan.data ? (
        <div className="space-y-3 text-sm">
          {plan.data.subEvents.map((fn) => (
            <div key={fn.id}>
              <p className="font-medium">
                {fn.name} <span className="font-normal text-muted-foreground">· {formatDay(fn.scheduledOn)}</span>
                {fn.venueDetail ? <span className="font-normal text-muted-foreground"> · {fn.venueDetail.label}</span> : null}
              </p>
              <ul className="ml-4 list-disc text-muted-foreground">
                {fn.items.map((item) => (
                  <li key={item.id}>
                    {item.productName} × {item.quantity} · {item.rentalDays} day{item.rentalDays === 1 ? "" : "s"}
                    {item.subEventIds.length > 1 ? " · shared across functions" : ""}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {plan.data.generalItems.length > 0 ? (
            <div>
              <p className="font-medium">Whole event</p>
              <ul className="ml-4 list-disc text-muted-foreground">
                {plan.data.generalItems.map((item) => (
                  <li key={item.id}>
                    {item.productName} × {item.quantity} · {item.rentalDays} day{item.rentalDays === 1 ? "" : "s"}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
