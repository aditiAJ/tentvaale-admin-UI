"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { ArrowLeft, Download, Loader2, Printer } from "lucide-react";
import { getQuotation, quotationKeys } from "@/features/quotations/api";
import { getCompany, settingsKeys } from "@/features/settings/api";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * A quotation as a real PDF (A4, selectable text, page numbers), in the storefront's look. It follows the
 * back office theme: dark when the screen is dark, light otherwise. Previewed here, then downloaded or printed.
 */
export function QuotationPrintPage({ quotationId }: { quotationId: string }) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "dark" : "light";
  const quotation = useQuery({
    queryKey: quotationKeys.byId(quotationId),
    queryFn: ({ signal }) => getQuotation(quotationId, signal),
    enabled: quotationId !== "",
  });
  const company = useQuery({ queryKey: settingsKeys.company, queryFn: ({ signal }) => getCompany(signal) });
  const [pdf, setPdf] = useState<{ key: string; url: string; missing: number } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const q = quotation.data;
  const c = company.data;
  const ready = Boolean(q) && !company.isPending;
  const key = `${q?.id}:${q?.status}:${q?.totalAmount.amount}:${theme}`;

  useEffect(() => {
    if (!ready || !q) return;
    let cancelled = false;
    let made: string | null = null;
    void (async () => {
      try {
        // Loaded here only: the PDF engine is large and runs in the browser.
        const [{ pdf: render }, { QuotationDocument }, { buildQuotationDoc }] = await Promise.all([
          import("@react-pdf/renderer"),
          import("@/features/quotations/components/QuotationDocument"),
          import("@/features/quotations/components/buildQuotationDoc"),
        ]);
        const doc = await buildQuotationDoc(q, c);
        const blob = await render(<QuotationDocument doc={doc} theme={theme} />).toBlob();
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
  }, [ready, q, c, theme, key]);

  if (quotationId === "") return <Alert tone="error" title="No quotation was chosen." />;
  if (quotation.isPending || company.isPending) return <Skeleton className="h-96" />;
  if (quotation.isError || !q) return <Alert tone="error" title="The quotation could not be loaded." />;

  const current = pdf?.key === key ? pdf.url : null;
  const fileName = `Quotation-${q.quotationNumber}.pdf`;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/quotations?id=${q.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to quotation {q.quotationNumber}
        </Link>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!current}
            onClick={() => current && window.open(current, "_blank", "noopener")}
          >
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

      <p className="text-xs text-muted-foreground">
        {theme === "dark" ? "Dark" : "Light"} edition, following the back office theme. Switch the theme to get the other.
      </p>

      {failed ? <Alert tone="error" title={`The PDF could not be made: ${failed}`} /> : null}
      {current && pdf && pdf.missing > 0 ? (
        <Alert
          tone="info"
          title={`${pdf.missing} product picture${pdf.missing === 1 ? "" : "s"} could not be loaded and show as plain tiles. Check the image address in the product, and that its host is allowed (PDF_IMAGE_HOSTS).`}
        />
      ) : null}

      {current ? (
        <iframe title={fileName} src={current} className="h-[80vh] w-full rounded-lg border border-border bg-card" />
      ) : failed ? null : (
        <div className="flex h-[60vh] items-center justify-center gap-2 rounded-lg border border-border bg-card text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Preparing the PDF…
        </div>
      )}
    </div>
  );
}
