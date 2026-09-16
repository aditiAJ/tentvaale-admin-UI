"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { dashboardKeys, getDashboard } from "@/features/dashboard/api";
import {
  QuotationPipeline,
  type PipelineStage,
} from "@/features/dashboard/components/QuotationPipeline";
import { formatMoney } from "@/lib/money";
import { formatCount, HeroFigure, StatTile } from "@/components/ui/stat";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

const STAGES: Omit<PipelineStage, "count">[] = [
  {
    label: "Draft",
    color: "--viz-stage-1",
    description: "Started but not yet sent to the customer.",
  },
  {
    label: "Sent",
    color: "--viz-stage-2",
    description: "With the customer, awaiting a decision.",
  },
  {
    label: "Accepted",
    color: "--viz-stage-3",
    description: "Agreed by the customer but not yet turned into an order.",
  },
  {
    label: "Converted",
    color: "--viz-stage-4",
    description: "An order has been created from it. Terminal.",
  },
];

export function DashboardPage() {
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: dashboardKeys.all,
    queryFn: ({ signal }) => getDashboard(signal),
  });

  const stages: PipelineStage[] = data
    ? [
        { ...STAGES[0], count: data.draftQuotations },
        { ...STAGES[1], count: data.sentQuotations },
        { ...STAGES[2], count: data.acceptedQuotations },
        { ...STAGES[3], count: data.convertedQuotations },
      ]
    : [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dashboard"
        description="Headline figures for this company."
        actions={
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={isFetching ? "animate-spin" : undefined} />
            Refresh
          </Button>
        }
      />

      {isError ? (
        <Card>
          <EmptyState
            title="Could not load the dashboard"
            description={error instanceof Error ? error.message : undefined}
            action={
              <Button variant="outline" onClick={() => refetch()}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : null}

      {isPending ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-36 lg:col-span-2" />
          <Skeleton className="h-36" />
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <HeroFigure
              className="lg:col-span-2"
              label="Total order value"
              value={formatMoney(data.totalOrderValue)}
              hint={`Across ${formatCount(data.totalOrders)} ${
                data.totalOrders === 1 ? "order" : "orders"
              }.`}
            />
            <StatTile
              label="Orders"
              value={formatCount(data.totalOrders)}
              hint="Every order ever raised for this company."
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Quotation pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <QuotationPipeline stages={stages} />
            </CardContent>
          </Card>

        </>
      ) : null}
    </div>
  );
}
