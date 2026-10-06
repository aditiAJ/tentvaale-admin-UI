"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCan } from "@/features/auth";
import { uploadMedia } from "@/features/master-data/api/backend";
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
  const [pan, setPan] = useState(initial.pan ?? "");
  const [bankName, setBankName] = useState(initial.bankName ?? "");
  const [bankAccount, setBankAccount] = useState(initial.bankAccount ?? "");
  const [bankIfsc, setBankIfsc] = useState(initial.bankIfsc ?? "");
  const [upiId, setUpiId] = useState(initial.upiId ?? "");
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl ?? "");
  const [signatureUrl, setSignatureUrl] = useState(initial.signatureUrl ?? "");
  const [latitude, setLatitude] = useState(initial.latitude == null ? "" : String(initial.latitude));
  const [longitude, setLongitude] = useState(initial.longitude == null ? "" : String(initial.longitude));
  const [error, setError] = useState<string | null>(null);

  const latNumber = latitude.trim() === "" ? null : Number(latitude);
  const lngNumber = longitude.trim() === "" ? null : Number(longitude);
  const coordsInvalid =
    (latNumber === null) !== (lngNumber === null) ||
    (latNumber !== null && (Number.isNaN(latNumber) || latNumber < -90 || latNumber > 90)) ||
    (lngNumber !== null && (Number.isNaN(lngNumber) || lngNumber < -180 || lngNumber > 180));

  const upload = async (file: File | undefined, set: (url: string) => void) => {
    if (!file) return;
    const [result] = await uploadMedia([file]);
    if (result?.ok && result.url) set(result.url);
    else setError(result?.error ?? "The image could not be uploaded.");
  };

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
        pan: pan.trim() || null,
        bankName: bankName.trim() || null,
        bankAccount: bankAccount.trim() || null,
        bankIfsc: bankIfsc.trim() || null,
        upiId: upiId.trim() || null,
        logoUrl: logoUrl || null,
        signatureUrl: signatureUrl || null,
        latitude: latNumber,
        longitude: lngNumber,
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
        <h2 className="pt-2 text-sm font-semibold">On invoices and receipts</h2>
        <Field label="PAN">
          {(props) => <Input {...props} value={pan} onChange={(e) => setPan(e.target.value)} disabled={!canWrite} />}
        </Field>
        <Field label="Bank name">
          {(props) => <Input {...props} value={bankName} onChange={(e) => setBankName(e.target.value)} disabled={!canWrite} />}
        </Field>
        <Field label="Bank account number">
          {(props) => <Input {...props} value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} disabled={!canWrite} />}
        </Field>
        <Field label="IFSC">
          {(props) => <Input {...props} value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value)} disabled={!canWrite} />}
        </Field>
        <Field label="UPI id">
          {(props) => <Input {...props} value={upiId} onChange={(e) => setUpiId(e.target.value)} disabled={!canWrite} />}
        </Field>
        <Field label="Logo" hint={logoUrl ? logoUrl : "An image printed at the top of every document."}>
          {(props) => (
            <Input {...props} type="file" accept="image/*" disabled={!canWrite} onChange={(e) => upload(e.target.files?.[0], setLogoUrl)} />
          )}
        </Field>
        <Field label="Signature" hint={signatureUrl ? signatureUrl : "An image of the authorised signatory's signature."}>
          {(props) => (
            <Input {...props} type="file" accept="image/*" disabled={!canWrite} onChange={(e) => upload(e.target.files?.[0], setSignatureUrl)} />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Latitude" error={coordsInvalid ? "Give both, within the valid range" : undefined}>
            {(props) => <Input {...props} value={latitude} inputMode="decimal" onChange={(e) => setLatitude(e.target.value)} disabled={!canWrite} />}
          </Field>
          <Field label="Longitude">
            {(props) => <Input {...props} value={longitude} inputMode="decimal" onChange={(e) => setLongitude(e.target.value)} disabled={!canWrite} />}
          </Field>
        </div>
      </div>
      {canWrite ? (
        <Button onClick={() => save.mutate()} disabled={save.isPending || rateInvalid || coordsInvalid || name.trim() === ""}>
          {save.isPending ? <Loader2 className="animate-spin" /> : null}
          Save
        </Button>
      ) : null}
    </div>
  );
}
