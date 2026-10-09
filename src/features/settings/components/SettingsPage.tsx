"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Hash,
  Landmark,
  Loader2,
  Percent,
  ScrollText,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useCan } from "@/features/auth";
import { ApiError } from "@/services/api-client";
import { getCompany, settingsKeys, updateCompany, type CompanyProfile } from "@/features/settings/api";
import { NumberingPage } from "@/features/settings/components/NumberingPage";
import { PoliciesPage } from "@/features/settings/components/PoliciesPage";
import { ImageUploadField } from "@/features/settings/components/ImageUploadField";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type TabKey = "profile" | "tax" | "bank" | "numbering" | "policies";

const TABS: { key: TabKey; label: string; hint: string; icon: LucideIcon; needs: "MASTER_DATA_READ" | "CONFIG_WRITE" }[] = [
  { key: "profile", label: "Business profile", hint: "Name, address, contact, logo", icon: Building2, needs: "MASTER_DATA_READ" },
  { key: "tax", label: "Tax & GST", hint: "GSTIN, PAN, state, GST rate", icon: Percent, needs: "MASTER_DATA_READ" },
  { key: "bank", label: "Bank & payments", hint: "Bank account and UPI", icon: Landmark, needs: "MASTER_DATA_READ" },
  { key: "numbering", label: "Numbering", hint: "Quotation, order, invoice numbers", icon: Hash, needs: "CONFIG_WRITE" },
  { key: "policies", label: "Policies", hint: "Terms, cancellation, damage, delivery", icon: ScrollText, needs: "CONFIG_WRITE" },
];

/** The company details as the form holds them: text, so a half-typed number is never lost. */
interface Draft {
  name: string;
  gstin: string;
  state: string;
  addressLine: string;
  city: string;
  postalCode: string;
  primaryPhone: string;
  secondaryPhone: string;
  publicEmail: string;
  websiteUrl: string;
  gstRate: string;
  pan: string;
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  upiId: string;
  latitude: string;
  longitude: string;
  logoUrl: string;
  signatureUrl: string;
  skuPrefix: string;
  requirePaymentBeforeDispatch: boolean;
}

/** The draft fields that are typed text (the rest are switches). */
type TextKey = Exclude<keyof Draft, "requirePaymentBeforeDispatch">;

const draftOf = (c: CompanyProfile): Draft => ({
  name: c.name,
  gstin: c.gstin ?? "",
  state: c.state ?? "",
  addressLine: c.addressLine ?? "",
  city: c.city ?? "",
  postalCode: c.postalCode ?? "",
  primaryPhone: c.primaryPhone ?? "",
  secondaryPhone: c.secondaryPhone ?? "",
  publicEmail: c.publicEmail ?? "",
  websiteUrl: c.websiteUrl ?? "",
  gstRate: c.gstRate == null ? "" : String(c.gstRate),
  pan: c.pan ?? "",
  bankName: c.bankName ?? "",
  bankAccount: c.bankAccount ?? "",
  bankIfsc: c.bankIfsc ?? "",
  upiId: c.upiId ?? "",
  latitude: c.latitude == null ? "" : String(c.latitude),
  longitude: c.longitude == null ? "" : String(c.longitude),
  logoUrl: c.logoUrl ?? "",
  signatureUrl: c.signatureUrl ?? "",
  skuPrefix: c.skuPrefix ?? "",
  requirePaymentBeforeDispatch: c.requirePaymentBeforeDispatch ?? false,
});

const FIELDS_OF: Record<"profile" | "tax" | "bank", (keyof Draft)[]> = {
  profile: ["name", "addressLine", "city", "postalCode", "primaryPhone", "secondaryPhone", "publicEmail", "websiteUrl", "latitude", "longitude", "logoUrl", "signatureUrl", "skuPrefix", "requirePaymentBeforeDispatch"],
  tax: ["gstin", "pan", "state", "gstRate"],
  bank: ["bankName", "bankAccount", "bankIfsc", "upiId"],
};

/**
 * Everything about the business in one place: who it is, how it is taxed, where money goes, how documents are numbered
 * and which policies they point to. The company tabs share one draft, so a change on one tab survives a visit to
 * another, and one Save keeps it all.
 */
export function SettingsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const canCompany = useCan("MASTER_DATA_READ");
  const canConfig = useCan("CONFIG_WRITE");
  const tabs = TABS.filter((t) => (t.needs === "MASTER_DATA_READ" ? canCompany : canConfig));
  const requested = params.get("tab");
  const active = tabs.find((t) => t.key === requested)?.key ?? tabs[0]?.key;

  const company = useQuery({ queryKey: settingsKeys.company, queryFn: ({ signal }) => getCompany(signal), enabled: canCompany });

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" description="Your business details, tax, bank account, document numbers and policies. Quotations, invoices and receipts all print from here." />

      {canCompany && company.data ? <Readiness company={company.data} onGo={(tab) => router.replace(`/settings?tab=${tab}`)} /> : null}

      <div className="grid items-start gap-5 lg:grid-cols-[260px_1fr]">
        <nav aria-label="Settings sections" className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => router.replace(`/settings?tab=${tab.key}`)}
                aria-current={active === tab.key ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-start gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors lg:w-full",
                  active === tab.key ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40",
                )}
              >
                <Icon className={cn("mt-0.5 size-4 shrink-0", active === tab.key ? "text-primary" : "text-muted-foreground")} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{tab.label}</span>
                  <span className="hidden text-xs text-muted-foreground lg:block">{tab.hint}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0">
          {active === "numbering" ? <NumberingPage /> : null}
          {active === "policies" ? <PoliciesPage /> : null}
          {active === "profile" || active === "tax" || active === "bank" ? (
            company.isPending ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : company.isError ? (
              <Alert tone="error" title="Could not load the company details." />
            ) : (
              <CompanyTabs key={company.data.id} initial={company.data} tab={active} />
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** What documents still lack, with a way straight to it. */
function Readiness({ company, onGo }: { company: CompanyProfile; onGo: (tab: TabKey) => void }) {
  const missing = useMemo(() => {
    const list: { label: string; tab: TabKey }[] = [];
    if (!company.gstin) list.push({ label: "GSTIN", tab: "tax" });
    if (!company.state) list.push({ label: "State", tab: "tax" });
    if (company.gstRate == null) list.push({ label: "GST rate", tab: "tax" });
    if (!company.addressLine) list.push({ label: "Address", tab: "profile" });
    if (!company.primaryPhone) list.push({ label: "Phone", tab: "profile" });
    if (!company.publicEmail) list.push({ label: "Email", tab: "profile" });
    if (!company.logoUrl) list.push({ label: "Logo", tab: "profile" });
    if (!company.bankAccount && !company.upiId) list.push({ label: "Bank account or UPI", tab: "bank" });
    return list;
  }, [company]);

  if (missing.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3.5 py-2.5 text-sm">
        <CheckCircle2 className="size-4 text-success" /> Your business details are complete: quotations, invoices and receipts have everything they print.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg border border-warning/40 bg-warning/10 px-3.5 py-2.5 text-sm">
      <AlertTriangle className="size-4 text-warning" />
      <span className="font-medium">Still to fill in for your documents:</span>
      {missing.map((m) => (
        <button key={m.label} type="button" onClick={() => onGo(m.tab)} className="rounded-md border border-border bg-card px-2 py-0.5 text-xs hover:border-primary">
          {m.label}
        </button>
      ))}
    </div>
  );
}

function Section({ title, shownOn, children }: { title: string; shownOn: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">Shown on: {shownOn}</p>
      </div>
      {children}
    </Card>
  );
}

function CompanyTabs({ initial, tab }: { initial: CompanyProfile; tab: "profile" | "tax" | "bank" }) {
  const canWrite = useCan("MASTER_DATA_WRITE");
  const queryClient = useQueryClient();
  const base = useMemo(() => draftOf(initial), [initial]);
  const [draft, setDraft] = useState<Draft>(base);
  const [error, setError] = useState<string | null>(null);
  const set = (key: TextKey) => (value: string) => setDraft((d) => ({ ...d, [key]: value }));
  const changed = (keys: (keyof Draft)[]) => keys.some((k) => draft[k] !== base[k]);
  const dirty = changed([...FIELDS_OF.profile, ...FIELDS_OF.tax, ...FIELDS_OF.bank]);

  const rate = draft.gstRate.trim() === "" ? null : Number(draft.gstRate);
  const rateInvalid = rate !== null && (Number.isNaN(rate) || rate < 0 || rate > 100);
  const lat = draft.latitude.trim() === "" ? null : Number(draft.latitude);
  const lng = draft.longitude.trim() === "" ? null : Number(draft.longitude);
  const coordsInvalid =
    (lat === null) !== (lng === null) ||
    (lat !== null && (Number.isNaN(lat) || lat < -90 || lat > 90)) ||
    (lng !== null && (Number.isNaN(lng) || lng < -180 || lng > 180));
  const emailInvalid = draft.publicEmail.trim() !== "" && !/^\S+@\S+\.\S+$/.test(draft.publicEmail.trim());
  const gstinOdd = draft.gstin.trim() !== "" && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i.test(draft.gstin.trim());
  const ifscOdd = draft.bankIfsc.trim() !== "" && !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(draft.bankIfsc.trim());
  const upiOdd = draft.upiId.trim() !== "" && !/^[\w.-]+@[\w.-]+$/.test(draft.upiId.trim());
  const skuInvalid = draft.skuPrefix.trim() !== "" && !/^[A-Za-z0-9]{2,6}$/.test(draft.skuPrefix.trim());
  const blocked = rateInvalid || coordsInvalid || emailInvalid || skuInvalid || draft.name.trim() === "";

  const save = useMutation({
    mutationFn: () => {
      const t = (v: string) => v.trim() || null;
      return updateCompany({
        ...initial,
        name: draft.name.trim(),
        gstin: t(draft.gstin),
        addressLine: t(draft.addressLine),
        city: t(draft.city),
        state: t(draft.state),
        postalCode: t(draft.postalCode),
        primaryPhone: t(draft.primaryPhone),
        secondaryPhone: t(draft.secondaryPhone),
        publicEmail: t(draft.publicEmail),
        websiteUrl: t(draft.websiteUrl),
        gstRate: rate,
        pan: t(draft.pan),
        bankName: t(draft.bankName),
        bankAccount: t(draft.bankAccount),
        bankIfsc: t(draft.bankIfsc),
        upiId: t(draft.upiId),
        logoUrl: t(draft.logoUrl),
        signatureUrl: t(draft.signatureUrl),
        skuPrefix: t(draft.skuPrefix),
        requirePaymentBeforeDispatch: draft.requirePaymentBeforeDispatch,
        latitude: lat,
        longitude: lng,
      });
    },
    onSuccess: (saved) => {
      setError(null);
      queryClient.setQueryData(settingsKeys.company, saved);
      setDraft(draftOf(saved));
      toast.success("Settings saved");
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not save the settings."),
  });

  // A Field child: called by the Field to draw the input, never mounted as a component of its own.
  const text = (key: TextKey, props: { placeholder?: string; type?: string; inputMode?: "decimal" | "numeric" } = {}) =>
    // eslint-disable-next-line react/display-name
    (p: { id: string; "aria-invalid": boolean; "aria-describedby": string | undefined }) => (
      <Input {...p} {...props} value={draft[key]} onChange={(e) => set(key)(e.target.value)} disabled={!canWrite} />
    );

  return (
    <div className="space-y-4">
      {error ? <Alert tone="error" title={error} /> : null}

      {tab === "profile" ? (
        <>
          <Section title="Business" shownOn="every document's header and footer">
            <Field label="Business name" required>{text("name")}</Field>
            <Field label="Address line">{text("addressLine", { placeholder: "e.g. 123 Ring Road, Industrial Area" })}</Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="City">{text("city")}</Field>
              <Field label="Postal code">{text("postalCode")}</Field>
            </div>
          </Section>

          <Section title="Contact" shownOn="document footers, the WhatsApp QR code, and the storefront's contact details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Primary phone" hint="Also the WhatsApp number on quotations.">
                {text("primaryPhone", { type: "tel", placeholder: "+91 98765 43210" })}
              </Field>
              <Field label="Secondary phone">{text("secondaryPhone", { type: "tel" })}</Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Public email" error={emailInvalid ? "That does not look like an email address" : undefined}>
                {text("publicEmail", { type: "email", placeholder: "contact@example.com" })}
              </Field>
              <Field label="Website" hint="Shown by its address only, e.g. www.example.com.">
                {text("websiteUrl", { type: "url", placeholder: "https://www.example.com" })}
              </Field>
            </div>
          </Section>

          <Section title="Logo and signature" shownOn="the quotation, invoice and receipt PDFs">
            <div className="grid gap-5 sm:grid-cols-2">
              <ImageUploadField label="Logo" hint="PNG or JPEG. A wide logo on a transparent background looks best." value={draft.logoUrl} onChange={set("logoUrl")} disabled={!canWrite} />
              <ImageUploadField label="Authorised signature" hint="PNG or JPEG of the signature on a plain background." value={draft.signatureUrl} onChange={set("signatureUrl")} disabled={!canWrite} />
            </div>
          </Section>

          <Section title="Product codes (SKU)" shownOn="every product, variant, bundle and collection code">
            <Field
              label="SKU code"
              error={skuInvalid ? "2 to 6 letters or digits, such as TENT" : undefined}
              hint="New items get codes like TENT-PRO-001 (product), TENT-PRO-001-V01 (its variant), TENT-BUN-001 (bundle) and TENT-FC-001 (collection). Changing it never renames codes already given."
            >
              {text("skuPrefix", { placeholder: "TENT" })}
            </Field>
          </Section>

          <Section title="Orders and payment" shownOn="the order screens and what customers see on their order">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[var(--primary)]"
                checked={draft.requirePaymentBeforeDispatch}
                disabled={!canWrite}
                onChange={(e) => setDraft((d) => ({ ...d, requirePaymentBeforeDispatch: e.target.checked }))}
              />
              <span>
                <span className="font-medium">Hold the goods until a payment is recorded</span>
                <span className="block text-xs text-muted-foreground">
                  An order is placed as soon as a quotation is accepted, but nothing can be dispatched until any payment is recorded
                  against it. The customer sees &quot;Payment awaited&quot;, then &quot;Payment confirmed&quot;.
                </span>
              </span>
            </label>
          </Section>

          <Section title="Location" shownOn="not printed yet; kept for the map location of your business">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Latitude" error={coordsInvalid ? "Give both, within the valid range" : undefined}>{text("latitude", { inputMode: "decimal" })}</Field>
              <Field label="Longitude">{text("longitude", { inputMode: "decimal" })}</Field>
            </div>
          </Section>
        </>
      ) : null}

      {tab === "tax" ? (
        <>
          <Section title="Tax registration" shownOn="quotations, invoices and receipts">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="GSTIN" error={undefined} hint={gstinOdd ? "This does not match the usual 15-character GSTIN format. Check it." : "15 characters, e.g. 24ABCDE1234F1Z5."}>
                {text("gstin")}
              </Field>
              <Field label="PAN" hint="10 characters, e.g. ABCDE1234F.">{text("pan")}</Field>
            </div>
          </Section>

          <Section title="GST on quotations" shownOn="the totals of every quotation">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your state" hint="The base for CGST + SGST versus IGST: a customer in this state pays CGST + SGST, anyone else IGST.">
                {text("state", { placeholder: "e.g. Gujarat" })}
              </Field>
              <Field label="GST rate (%)" error={rateInvalid ? "A percentage between 0 and 100" : undefined} hint="One rate for all quotations. A quotation cannot be sent until it is set (0 means no tax).">
                {text("gstRate", { inputMode: "decimal", placeholder: "18" })}
              </Field>
            </div>
            <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              GST is charged on the items after discounts. Delivery carries no GST, and the refundable security deposit is never taxed.
            </p>
          </Section>
        </>
      ) : null}

      {tab === "bank" ? (
        <Section title="Where customers pay" shownOn="the payment page of quotations, and invoices and receipts">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bank name">{text("bankName")}</Field>
            <Field label="Account number">{text("bankAccount", { inputMode: "numeric" })}</Field>
            <Field label="IFSC code" hint={ifscOdd ? "This does not match the usual IFSC format (4 letters, 0, then 6 characters)." : undefined}>
              {text("bankIfsc")}
            </Field>
            <Field label="UPI ID" hint={upiOdd ? "A UPI ID looks like name@bank." : "Customers can scan a QR code made from it."}>
              {text("upiId", { placeholder: "name@bank" })}
            </Field>
          </div>
        </Section>
      ) : null}

      {canWrite ? (
        <div className="sticky bottom-3 flex items-center justify-between gap-3 rounded-lg border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
          <p className="text-xs text-muted-foreground">
            {dirty ? "You have unsaved changes (across all the business tabs)." : "Everything is saved."}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!dirty || save.isPending} onClick={() => setDraft(base)}>
              Discard
            </Button>
            <Button size="sm" disabled={!dirty || blocked || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? <Loader2 className="animate-spin" /> : null}
              Save changes
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
