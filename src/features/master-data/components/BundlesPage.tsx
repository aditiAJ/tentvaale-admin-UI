"use client";

import { useQuery } from "@tanstack/react-query";
import { Shapes } from "lucide-react";
import { listBundles, masterDataKeys } from "@/features/master-data/api";
import { formatMoney } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const COLUMNS = 3;

export function BundlesPage() {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: masterDataKeys.bundles,
    queryFn: ({ signal }) => listBundles(signal),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bundles"
        description="Pre-priced groups of products quoted as a single line."
      />

      <Card>
        <TableWrapper>
          <Table>
            <THead>
              <tr>
                <TH>Name</TH>
                <TH>Contents</TH>
                <TH className="text-right">Rental rate</TH>
              </tr>
            </THead>
            <TBody>
              {isPending ? <TableSkeleton columns={COLUMNS} /> : null}

              {!isPending && data
                ? data.map((bundle) => (
                    <TR key={bundle.id}>
                      <TD className="font-medium">{bundle.name}</TD>
                      <TD>
                        <div className="flex flex-wrap gap-1">
                          {bundle.contents.map((item) => (
                            <Badge key={item} variant="outline">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      </TD>
                      <TD className="text-right tabular">{formatMoney(bundle.rentalRate)}</TD>
                    </TR>
                  ))
                : null}
            </TBody>
          </Table>
        </TableWrapper>

        {isError ? (
          <EmptyState
            title="Could not load bundles"
            description={error instanceof Error ? error.message : undefined}
            action={
              <Button variant="outline" onClick={() => refetch()}>
                Try again
              </Button>
            }
          />
        ) : null}

        {!isPending && !isError && !data?.length ? (
          <EmptyState icon={<Shapes />} title="No bundles yet" />
        ) : null}
      </Card>
    </div>
  );
}
