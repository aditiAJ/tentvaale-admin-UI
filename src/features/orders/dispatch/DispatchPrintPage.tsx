"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { Download, Loader2, Printer } from "lucide-react";
import { getOrder, orderKeys } from "@/features/orders/api";
import { getQuotation, quotationKeys } from "@/features/quotations/api";
import { getCompany, settingsKeys } from "@/features/settings/api";
import { BackButton } from "@/components/back-button";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * An order's dispatch list as a real PDF (A4, page numbers) in the quotation's look: a card per item with its picture,
 * grouped by warehouse. Previewed here, then downloaded or printed.
 */
export function DispatchPrintPage({ orderId }: { orderId: string }) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "dark" : "light";
  const order = useQuery({
    queryKey: orderKeys.byId(orderId),
    queryFn: ({ signal }) => getOrder(orderId, signal),
    enabled: orderId !== "",
    staleTime: 0,
  });
  const quotationId = order.data?.quotationId ?? "";
  const quotation = useQuery({
    queryKey: quotationKeys.byId(quotationId),
    queryFn: ({ signal }) => getQuotation(quotationId, signal),
    enabled: quotationId !== "",
  });
  const company = useQuery({ queryKey: settingsKeys.company, queryFn: ({ signal }) => getCompany(signal) });
  const [pdf, setPdf] = useState<{ key: string; url: string; missing: number } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const o = order.data;
  const q = quotation.data;
  const c = company.data;
  // The quotation is only waited for when there is one; an order without one is listed from its own lines.
  const ready = Boolean(o) && !company.isPending && (quotationId === "" || !quotation.isPending);
  const key = `${o?.id}:${o?.status}:${theme}`;

  useEffect(() => {
    if (!ready || !o) return;
    let cancelled = false;
    let made: string | null = null;
    void (async () => {
      try {
        // Loaded here only: the PDF engine is large and runs in the browser.
        const [{ pdf: render }, { DispatchListDocument }, { buildDispatchDoc }] = await Promise.all([
          import("@react-pdf/renderer"),
          import("@/features/orders/dispatch/DispatchListDocument"),
          import("@/features/orders/dispatch/buildDispatchDoc"),
        ]);
        const doc = await buildDispatchDoc(o, q, c);
        const blob = await render(<DispatchListDocument doc={doc} theme={theme} />).toBlob();
        if (cancelled) return;
        made = URL.createObjectURL(blob);
        setPdf({ key, url: made, missing: doc.picturesMissing });
        setFailed(null);
      } catch (error) {
        if (!cancelled) setFailed(error instanceof Error ? error.message : "The PDF could not be made.");
      }
    })();
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [ready, o, q, c, theme, key]);

  const failure = (title: string) => (
    <div className="mx-auto max-w-4xl space-y-4">
      <BackButton fallback="/orders" />
      <Alert tone="error" title={title} />
    </div>
  );
  if (orderId === "") return failure("No order was chosen.");
  if (order.isPending || company.isPending) return <Skeleton className="h-96" />;
  if (order.isError || !o) return failure("The order could not be loaded.");

  const current = pdf?.key === key ? pdf.url : null;
  const fileName = `Dispatch-${o.orderNumber}.pdf`;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackButton fallback={`/orders?id=${o.id}`} />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={!current} onClick={() => current && window.open(current, "_blank", "noopener")}>
            <Printer /> Open to print
          </Button>
          <Button
            size="sm"
            disabled={!current}
            onClick={() => {
              if (!current) return;
              const a = document.createElement("a");
              a.href = current;
              a.download = fileName;
              a.click();
            }}
          >
            <Download /> Download PDF
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{theme === "dark" ? "Dark" : "Light"} edition, following the back office theme.</p>

      {failed ? <Alert tone="error" title={`The PDF could not be made: ${failed}`} /> : null}
      {current && pdf && pdf.missing > 0 ? (
        <Alert
          tone="info"
          title={`${pdf.missing} product picture${pdf.missing === 1 ? "" : "s"} could not be loaded, so ${pdf.missing === 1 ? "its item shows" : "their items show"} without a picture.`}
        />
      ) : null}

      {current ? (
        <iframe title={fileName} src={current} className="h-[80vh] w-full rounded-lg border border-border bg-card" />
      ) : failed ? null : (
        <div className="flex h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Making the dispatch list…
        </div>
      )}
    </div>
  );
}
