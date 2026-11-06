"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InvoiceSource } from "./buildInvoiceDoc";
import { makeInvoicePdf, saveInvoicePdf } from "./downloadInvoicePdf";

/**
 * The invoice as it is: the very PDF that Download saves, shown on the page, with Download and Print. Print prints this PDF, so
 * what comes out of the printer is what is on screen and in the file. Written once and used unchanged by the back office and the
 * storefront.
 */
export function InvoicePdfView({ source }: { source: InvoiceSource }) {
  const [state, setState] = useState<{ status: "making" } | { status: "ready"; blob: Blob; url: string } | { status: "failed" }>({ status: "making" });
  const [attempt, setAttempt] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  const key = `${source.number}:${attempt}`;

  useEffect(() => {
    let cancelled = false;
    let made: string | null = null;
    makeInvoicePdf(source)
      .then((blob) => {
        if (cancelled) return;
        made = URL.createObjectURL(blob);
        setState({ status: "ready", blob, url: made });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "failed" });
      });
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
    // The invoice never changes once issued, so it is made again only for another invoice or a retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const print = () => {
    const win = frame.current?.contentWindow;
    if (win) {
      win.focus();
      win.print();
    } else if (state.status === "ready") {
      window.open(state.url, "_blank");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
        <Button size="sm" disabled={state.status !== "ready"} onClick={() => state.status === "ready" && saveInvoicePdf(state.blob, source.number)}>
          <Download /> Download PDF
        </Button>
        <Button size="sm" variant="outline" disabled={state.status !== "ready"} onClick={print}>
          <Printer /> Print
        </Button>
      </div>
      {state.status === "making" ? (
        <div className="flex h-[70vh] items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Preparing the invoice…
        </div>
      ) : null}
      {state.status === "failed" ? (
        <div role="alert" className="flex h-[40vh] flex-col items-center justify-center gap-3 text-sm text-destructive">
          The invoice could not be shown.
          <Button size="sm" variant="outline" onClick={() => {
              setState({ status: "making" });
              setAttempt((n) => n + 1);
            }}>
            Try again
          </Button>
        </div>
      ) : null}
      {state.status === "ready" ? (
        <iframe
          ref={frame}
          title={`Tax invoice ${source.number}`}
          src={`${state.url}#view=FitH`}
          className="h-[calc(100vh-11rem)] min-h-[720px] w-full rounded-lg border border-border bg-white"
        />
      ) : null}
    </div>
  );
}
