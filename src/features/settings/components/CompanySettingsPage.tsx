"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCan } from "@/features/auth";
import { ApiError } from "@/services/api-client";
import { getCompany, settingsKeys, updateCompany, type CompanyProfile } from "@/features/settings/api";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

/** The business's own details, and the one GST rate every quotation uses. */
export function CompanySettingsPage() {
  const company = useQuery({ queryKey: settingsKeys.company, queryFn: ({ signal }) => getCompany(signal) });
  if (company.isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (company.isError) return <Alert tone="error" title="Could not load the company details." />;
  return <CompanyForm key={company.data.id} initial={company.data} />;
}

function CompanyForm({ initial }: { initial: CompanyProfile }) {
  const canWrite = useCan("MASTER_DATA_WRITE");
  const queryClient = useQueryClient();
  const [name, setName] = useState(initial.name);
  const [gstin, setGstin] = useState(initial.gstin ?? "");
  const [state, setState] = useState(initial.state ?? "");
  const [gstRate, setGstRate] = useState(initial.gstRate == null ? "" : String(initial.gstRate));
  const [error, setError] = useState<string | null>(null);

  const rateNumber = gstRate.trim() === "" ? null : Number(gstRate);
  const rateInvalid = rateNumber !== null && (Number.isNaN(rateNumber) || rateNumber < 0 || rateNumber > 100);

  const save = useMutation({
    mutationFn: () =>
      updateCompany({
        ...initial,
        name: name.trim(),
        gstin: gstin.trim() || null,
        state: state.trim() || null,
        gstRate: rateNumber,
      }),
    onSuccess: (saved) => {
      setError(null);
      queryClient.setQueryData(settingsKeys.company, saved);
      toast.success("Company settings saved");
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not save the settings."),
  });

  return (
    <div className="max-w-xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Company settings</h1>
        <p className="text-sm text-muted-foreground">
          GST is charged on a quotation&apos;s items after discounts. Same state as the customer: CGST + SGST. Another
          state: IGST. Delivery carries no GST and the security deposit is never taxed.
        </p>
      </header>
      {error ? <Alert tone="error" title={error} /> : null}
      <div className="space-y-4">
        <Field label="Company name" required>
          {(props) => <Input {...props} value={name} onChange={(e) => setName(e.target.value)} disabled={!canWrite} />}
        </Field>
        <Field label="GSTIN">
          {(props) => <Input {...props} value={gstin} onChange={(e) => setGstin(e.target.value)} disabled={!canWrite} />}
        </Field>
        <Field label="State" hint="The company's own state: the base for CGST + SGST versus IGST.">
          {(props) => <Input {...props} value={state} onChange={(e) => setState(e.target.value)} disabled={!canWrite} />}
        </Field>
        <Field
          label="GST rate (%)"
          error={rateInvalid ? "A percentage between 0 and 100" : undefined}
          hint="One rate for every quotation. A quotation cannot be sent until it is set (0 means no tax)."
        >
          {(props) => (
            <Input
              {...props}
              value={gstRate}
              inputMode="decimal"
              placeholder="18"
              onChange={(e) => setGstRate(e.target.value)}
              disabled={!canWrite}
            />
          )}
        </Field>
      </div>
      {canWrite ? (
        <Button onClick={() => save.mutate()} disabled={save.isPending || rateInvalid || name.trim() === ""}>
          {save.isPending ? <Loader2 className="animate-spin" /> : null}
          Save
        </Button>
      ) : null}
    </div>
  );
}
