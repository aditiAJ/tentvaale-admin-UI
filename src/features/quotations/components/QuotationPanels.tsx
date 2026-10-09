"use client";

import { useQuery } from "@tanstack/react-query";
import { listQuotationVersions, quotationKeys } from "@/features/quotations/api";
import { IS_MOCK } from "@/services/data-source";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Every version sent to the customer, newest first. Real backend only: demo data keeps none. */
export function QuotationVersions({ quotationId }: { quotationId: string }) {
  const { data } = useQuery({
    queryKey: [...quotationKeys.byId(quotationId), "versions"],
    queryFn: ({ signal }) => listQuotationVersions(quotationId, signal),
    enabled: !IS_MOCK,
    retry: false,
  });
  if (!data || data.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Version history</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {[...data].reverse().map((version) => (
          <details key={version.versionNo} className="rounded-lg border border-border px-4 py-2.5 text-sm">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                Version {version.versionNo}
                <span className="ml-2 font-normal text-muted-foreground">sent {formatDateTime(version.sentAt)}</span>
              </span>
              <span className="tabular font-medium">{formatMoney(version.totalAmount)}</span>
            </summary>
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              {version.lines.map((line, index) => (
                <p key={index} className="flex justify-between gap-3">
                  <span>
                    {line.productName} × {line.quantity} for {line.rentalDays} day{line.rentalDays === 1 ? "" : "s"}
                  </span>
                  <span className="tabular">{formatMoney(line.lineTotal)}</span>
                </p>
              ))}
              <p className="pt-1">
                Delivery {formatMoney(version.deliveryCharge)} · Discount {formatMoney(version.discountAmount)} ·
                Deposit {formatMoney(version.securityDeposit)}
              </p>
            </div>
          </details>
        ))}
      </CardContent>
    </Card>
  );
}
