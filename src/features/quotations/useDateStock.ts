import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { checkDateAvailability } from "@/features/inventory";
import type { DateStockLineRequest, DateStockResult } from "@/features/inventory";

/** How long typing must pause before the stock is asked for, so a quantity being typed is not one request per digit. */
const PAUSE_MS = 400;

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

/**
 * The stock status of a quotation's lines on its event date (the Inventory column). It asks once typing has paused, and
 * keeps the last answer on screen meanwhile (`pending` says it is being replaced). Nothing is asked for without a date or
 * without lines, and a failed check only sets `failed`: it never stops the quotation from being saved.
 */
export function useDateStock({
  eventDate,
  excludeQuotationId,
  lines,
  enabled = true,
}: {
  eventDate?: string;
  excludeQuotationId?: string;
  lines: DateStockLineRequest[];
  enabled?: boolean;
}): { results: Map<string, DateStockResult>; pending: boolean; failed: boolean } {
  const request = JSON.stringify({ eventDate, excludeQuotationId, lines });
  const query = useQuery({
    queryKey: ["inventory", "date-stock", request],
    queryFn: async ({ signal }) => {
      await pause(PAUSE_MS, signal);
      return checkDateAvailability(JSON.parse(request), signal);
    },
    // A line that names its own function date can be checked without a quotation-wide event date.
    enabled: enabled && (Boolean(eventDate) || lines.some((line) => line.functionDate)) && lines.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    retry: false,
  });
  return {
    results: new Map((query.data ?? []).map((result) => [result.key, result])),
    pending: query.isFetching,
    failed: query.isError,
  };
}
