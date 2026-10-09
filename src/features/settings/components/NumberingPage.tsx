"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/services/api-client";
import {
  listNumbering,
  settingsKeys,
  updateNumbering,
  type Numbering,
  type NumberedDocument,
} from "@/features/settings/api";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const LABEL: Record<NumberedDocument, string> = {
  QUOTATION: "Quotations",
  ORDER: "Orders",
  CREDIT_NOTE: "Credit notes",
  STOCK_MOVEMENT: "Stock movements",
  INVOICE: "Invoices",
  RECEIPT: "Receipts",
};

/** The look of each document number, and where it continues from (for example after moving from an old system). */
export function NumberingPage() {
  const list = useQuery({ queryKey: settingsKeys.numbering, queryFn: ({ signal }) => listNumbering(signal) });
  if (list.isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (list.isError) return <Alert tone="error" title="Could not load the numbering." />;
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-base font-semibold">Document numbering</h2>
        <p className="text-sm text-muted-foreground">
          With the financial-year option the number carries the year (for example INV-2026-27-000001) and starts again
          from 1 each 1 April. Changing the next number never touches documents already issued.
        </p>
      </header>
      {list.data.map((n) => (
        <NumberingRow key={`${n.documentType}-${n.nextValue}-${n.prefix}-${n.fyReset}`} numbering={n} />
      ))}
    </div>
  );
}

function NumberingRow({ numbering }: { numbering: Numbering }) {
  const queryClient = useQueryClient();
  const [prefix, setPrefix] = useState(numbering.prefix);
  const [nextValue, setNextValue] = useState(String(numbering.nextValue));
  const [padding, setPadding] = useState(String(numbering.padding));
  const [fyReset, setFyReset] = useState(numbering.fyReset);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      updateNumbering(numbering.documentType, {
        prefix: prefix.trim(),
        nextValue: Number(nextValue),
        padding: Number(padding),
        fyReset,
      }),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: settingsKeys.numbering });
      toast.success(`${LABEL[numbering.documentType]} numbering saved`);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not save the numbering."),
  });
  const invalid = prefix.trim() === "" || !(Number(nextValue) >= 1) || !(Number(padding) >= 1 && Number(padding) <= 10);

  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-medium">{LABEL[numbering.documentType]}</h2>
        <span className="tabular text-xs text-muted-foreground">Next: {numbering.example}</span>
      </div>
      {error ? <Alert tone="error" title={error} /> : null}
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Prefix">
          {(props) => <Input {...props} value={prefix} onChange={(e) => setPrefix(e.target.value)} />}
        </Field>
        <Field label="Next number">
          {(props) => <Input {...props} inputMode="numeric" value={nextValue} onChange={(e) => setNextValue(e.target.value)} />}
        </Field>
        <Field label="Digits">
          {(props) => <Input {...props} inputMode="numeric" value={padding} onChange={(e) => setPadding(e.target.value)} />}
        </Field>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" checked={fyReset} onChange={(e) => setFyReset(e.target.checked)} />
          Restart each financial year
        </label>
      </div>
      <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || invalid}>
        Save
      </Button>
    </section>
  );
}
