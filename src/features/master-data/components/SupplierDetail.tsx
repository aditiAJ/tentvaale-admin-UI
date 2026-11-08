"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, MapPin, MessageCircle, Pencil, Phone } from "lucide-react";
import { listSuppliers, masterDataKeys } from "@/features/master-data/api";
import type { SupplierView } from "@/features/master-data/types";
import { SupplierDialog } from "@/features/master-data/components/SupplierDialog";
import { SupplierHistoryPanel } from "@/features/master-data/components/SupplierHistoryPanel";
import { SupplierStockPanel } from "@/features/master-data/components/SupplierStockPanel";
import { telUrl, whatsappUrl } from "@/features/master-data/supplierUtils";
import { useCan } from "@/features/auth";
import { BackButton } from "@/components/back-button";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCount, StatTile } from "@/components/ui/stat";
import { cn } from "@/lib/utils";

const TABS = [
  ["overview", "Overview"],
  ["stock", "Stock"],
  ["history", "History"],
] as const;

type Tab = (typeof TABS)[number][0];

const LIST = "/master-data/suppliers";

/**
 * One supplier as a workspace: who they are, what they can provide (set here, with a rate for each item) and the trail
 * of every change. Opened from the list by `?supplier=<id>`, so Back returns to the list as it was.
 */
export function SupplierDetail({ supplierId }: { supplierId: string }) {
  const canWrite = useCan("LOGISTICS_WRITE");
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: masterDataKeys.suppliers,
    queryFn: ({ signal }) => listSuppliers(signal),
  });
  const supplier = data?.find((s) => s.id === supplierId);

  if (isPending) {
    return (
      <div className="space-y-4">
        <BackButton fallback={LIST} label="All suppliers" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError || !supplier) {
    return (
      <div className="space-y-4">
        <BackButton fallback={LIST} label="All suppliers" />
        <Card>
          <EmptyState
            title={isError ? "Could not load this supplier" : "This supplier was not found"}
            description={
              isError
                ? error instanceof Error
                  ? error.message
                  : undefined
                : "It may have been removed, or the link is out of date."
            }
            action={
              isError ? (
                <Button variant="outline" onClick={() => refetch()}>
                  Try again
                </Button>
              ) : undefined
            }
          />
        </Card>
      </div>
    );
  }

  const place = [supplier.city, supplier.state].filter(Boolean).join(", ");

  return (
    <div className="space-y-4">
      <BackButton fallback={LIST} label="All suppliers" />

      <PageHeader
        title={supplier.name}
        description={place || "Rental supplier"}
        actions={
          <>
            {!supplier.active ? <Badge>Inactive</Badge> : null}
            {canWrite ? (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil />
                Edit
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Products" value={formatCount(supplier.productCount)} hint="they can provide now" />
        <StatTile label="Units" value={formatCount(supplier.totalUnits)} hint="available in all" />
        <StatTile
          label="Lead time"
          value={supplier.leadTimeDays == null ? "—" : supplier.leadTimeDays === 0 ? "Same day" : `${supplier.leadTimeDays} d`}
          hint={supplier.leadTimeDays == null ? "not recorded" : "from asking to arrival"}
        />
        <StatTile
          label="Minimum order"
          value={supplier.minimumOrderQuantity == null ? "—" : formatCount(supplier.minimumOrderQuantity)}
          hint={supplier.minimumOrderQuantity == null ? "no minimum recorded" : "units at once"}
        />
      </div>

      <div role="tablist" aria-label="Supplier sections" className="flex gap-1 border-b border-border">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`supplier-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`supplier-panel-${id}`}
            onClick={() => setTab(id)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:text-foreground",
              tab === id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`supplier-panel-${tab}`} aria-labelledby={`supplier-tab-${tab}`}>
        {tab === "overview" ? <Overview supplier={supplier} /> : null}
        {tab === "stock" ? <SupplierStockPanel supplier={supplier} /> : null}
        {tab === "history" ? <SupplierHistoryPanel supplier={supplier} /> : null}
      </div>

      {editing ? <SupplierDialog existing={supplier} onClose={() => setEditing(false)} /> : null}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{children ?? <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <dl className="space-y-3">{children}</dl>
    </section>
  );
}

function Overview({ supplier }: { supplier: SupplierView }) {
  const call = telUrl(supplier.phone);
  const chat = whatsappUrl(supplier.phone);
  const empty = <span className="text-muted-foreground">—</span>;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Contact">
        <Detail label="Contact person">{supplier.contactPerson || empty}</Detail>
        <Detail label="Phone">
          {supplier.phone ? (
            <span className="inline-flex items-center gap-2">
              {call ? (
                <a href={call} className="tabular inline-flex items-center gap-1.5 hover:underline">
                  <Phone className="size-3.5" aria-hidden="true" />
                  {supplier.phone}
                </a>
              ) : (
                <span className="tabular">{supplier.phone}</span>
              )}
              {chat ? (
                <a
                  href={chat}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[var(--success)] hover:underline"
                >
                  <MessageCircle className="size-3.5" aria-hidden="true" />
                  WhatsApp
                </a>
              ) : null}
            </span>
          ) : (
            empty
          )}
        </Detail>
        <Detail label="Email">
          {supplier.email ? (
            <a href={`mailto:${supplier.email}`} className="inline-flex items-center gap-1.5 hover:underline">
              <Mail className="size-3.5" aria-hidden="true" />
              {supplier.email}
            </a>
          ) : (
            empty
          )}
        </Detail>
      </Section>

      <Section title="Location and tax">
        <Detail label="Address">
          {supplier.addressLine ? (
            <span className="inline-flex items-start gap-1.5 whitespace-pre-line">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              {supplier.addressLine}
            </span>
          ) : (
            empty
          )}
        </Detail>
        <Detail label="City">{supplier.city || empty}</Detail>
        <Detail label="State">{supplier.state || empty}</Detail>
        <Detail label="GSTIN">{supplier.gstin ? <span className="font-mono text-xs">{supplier.gstin}</span> : empty}</Detail>
      </Section>

      <Section title="Notes">
        {supplier.notes ? (
          <p className="whitespace-pre-line text-sm">{supplier.notes}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No notes. Use Edit to add payment terms or pickup details.</p>
        )}
      </Section>
    </div>
  );
}
