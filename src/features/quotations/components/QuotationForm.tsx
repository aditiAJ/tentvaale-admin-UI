"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListPlus, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createQuotation, quotationKeys, updateQuotation } from "@/features/quotations/api";
import type { QuotationView } from "@/features/quotations/types";
import { listCustomers, listProducts, masterDataKeys } from "@/features/master-data/api";
import type { ProductVariantView, ProductView } from "@/features/master-data/types";
import { dashboardKeys } from "@/features/dashboard/api";
import { ApiError } from "@/services/api-client";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { plannerRate, quotedMoney } from "@/lib/rate";
import { gstOn } from "@/lib/gst";
import { getCompany, settingsKeys } from "@/features/settings/api";
import { areaOf, bestFit } from "@/lib/area";
import { RATE_TYPES, RATE_TYPE_LABEL, ratePerDayLabel, unitLabel, type RateType } from "@/features/master-data/storefront";
import { amountField, isIsoDate, positiveIntegerField } from "@/lib/forms";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { InventoryChip, StockSummary, type LineStock } from "@/features/quotations/components/InventoryChip";
import { ProductPickerPanel, pictureOf, type ChosenProduct } from "@/features/quotations/components/ProductPickerPanel";
import { formatEventDate } from "@/features/quotations/components/QuotationParts";
import { useDateStock } from "@/features/quotations/useDateStock";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const schema = z.object({
  customerName: z.string().trim().min(1, "Enter the customer's name"),
  // Only filled in when more than one customer has the typed name; otherwise
  // the name alone resolves the customer on submit.
  customerId: z.string(),
  eventDate: z
    .string()
    .refine((value) => value === "" || isIsoDate(value), "Enter a valid date")
    .transform((value) => (value === "" ? undefined : value)),
  // One amount for the whole booking: products no longer carry a deposit of
  // their own, so nothing on the lines can add up to one.
  securityDeposit: amountField("Security deposit"),
  // Entered by staff; blank means none. The total the customer sees is items + delivery + transportation + installation - discount.
  deliveryCharge: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), "Enter an amount like 500 or 500.50")
    .transform((v) => (v === "" ? 0 : Number(v))),
  // The discount box holds either a rupee amount or a percentage, whichever `discountType` says (MOM-14).
  transportationCharge: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), "Enter an amount like 500 or 500.50")
    .transform((v) => (v === "" ? 0 : Number(v))),
  installationCharge: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), "Enter an amount like 500 or 500.50")
    .transform((v) => (v === "" ? 0 : Number(v))),
  discountType: z.enum(["FLAT", "PERCENT"]),
  discountAmount: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), "Enter an amount like 500 or 500.50")
    .transform((v) => (v === "" ? 0 : Number(v))),
  // Last day the quotation can be offered. Blank: the backend applies its default (15 days).
  validUntil: z
    .string()
    .refine((value) => value === "" || isIsoDate(value), "Enter a valid date")
    .transform((value) => (value === "" ? undefined : value)),
  lines: z
    .array(
      z.object({
        // "" for a line added in this form. Set for a line the quotation
        // already has; staff can change that saved rate below.
        lineId: z.string(),
        // A catalogue product's id; empty for a one-time line (checked below).
        productId: z.string(),
        // Required, by the check on submit, for a product that has variants.
        variantId: z.string(),
        quantity: positiveIntegerField("Quantity"),
        rentalDays: positiveIntegerField("Rental days"),
        unitRatePerDay: amountField("Rate per day").refine(
          (value) => value <= 99999999.99,
          "Rate per day must not exceed 99999999.99",
        ),
        rateOverride: z.boolean(),
        // A one-time line is quoted by the name and rate typed here, not taken from the catalogue.
        oneTime: z.boolean(),
        oneTimeName: z.string().trim().max(200, "Maximum 200 characters"),
        oneTimeRateType: z.enum(RATE_TYPES),
      }).superRefine((line, context) => {
        if (line.oneTime) {
          if (!line.oneTimeName) context.addIssue({ code: "custom", path: ["oneTimeName"], message: "Give the product a name" });
        } else if (!line.productId) {
          context.addIssue({ code: "custom", path: ["productId"], message: "Choose a product" });
        }
      }),
    )
    .min(1, "A quotation needs at least one line"),
}).superRefine((value, context) => {
  if (value.discountType === "PERCENT" && value.discountAmount > 100) {
    context.addIssue({ code: "custom", path: ["discountAmount"], message: "A percentage is between 0 and 100" });
  }
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

const emptyLine = () => ({
  lineId: "",
  productId: "",
  variantId: "",
  quantity: "1",
  rentalDays: "1",
  unitRatePerDay: "",
  rateOverride: false,
  oneTime: false,
  oneTimeName: "",
  oneTimeRateType: "Qty" as const,
});

/** Today plus the backend's default validity, as yyyy-MM-dd, shown so staff can see and change it. */
const defaultValidUntil = () => {
  const date = new Date();
  date.setDate(date.getDate() + 15);
  return date.toISOString().slice(0, 10);
};

/** The one box holds a rupee amount or a percentage; the request says which, and carries only that one. */
const discountRequest = (values: { discountType: "FLAT" | "PERCENT"; discountAmount: number }) =>
  values.discountType === "PERCENT"
    ? { discountType: "PERCENT" as const, discountPercent: values.discountAmount }
    : { discountType: "FLAT" as const, discountAmount: values.discountAmount };

/** Names compared the way a person would: ignoring case and extra spaces. */
const normaliseName = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();
const sameName = (a: string, b: string) => normaliseName(a) === normaliseName(b);

function EstimateRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex justify-between gap-6">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular">{formatMoney({ amount, currency: "INR" })}</span>
    </div>
  );
}

/**
 * Raises a quotation, or edits one that has not been converted.
 *
 * The line totals shown are an estimate: the server stores the final result,
 * using catalogue/trade pricing unless staff explicitly override a line rate.
 * Existing lines keep their saved rate unless staff changes it. Choosing a
 * different product for an existing line makes it a new line, priced afresh.
 */
export function QuotationForm({ existing }: { existing?: QuotationView }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  // The length and width boxes of an area line, as typed; until one is typed they show the best whole-number fit of the area.
  const [sides, setSides] = useState<Record<string, { length: string; width: string }>>({});
  // Back or Cancel with unsaved changes asks first; this holds the step to take once the user says to discard them.
  const [leaving, setLeaving] = useState<(() => void) | null>(null);

  const products = useQuery({
    queryKey: masterDataKeys.products,
    queryFn: ({ signal }) => listProducts(signal),
  });
  const customers = useQuery({
    queryKey: masterDataKeys.customers,
    queryFn: ({ signal }) => listCustomers(signal),
  });

  // The company's GST rate and state, for the running GST in the estimate; the server works out the saved figure.
  const company = useQuery({ queryKey: settingsKeys.company, queryFn: ({ signal }) => getCompany(signal) });

  const productsById = useMemo(
    () => new Map((products.data ?? []).map((product) => [product.id, product])),
    [products.data],
  );

  const storedLines = useMemo(
    () => new Map((existing?.lines ?? []).map((line) => [line.id, line])),
    [existing],
  );

  const {
    control,
    register,
    handleSubmit,
    getValues,
    setValue,
    setError,
    formState: { errors, isDirty },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: existing
      ? {
          customerName: existing.customerName,
          customerId: "",
          eventDate: existing.eventDate ?? "",
          validUntil: existing.validUntil ?? "",
          securityDeposit: String(Number(existing.totalSecurityDeposit.amount)),
          deliveryCharge: existing.deliveryCharge ? String(Number(existing.deliveryCharge.amount)) : "",
          transportationCharge: existing.transportationCharge ? String(Number(existing.transportationCharge.amount)) : "",
          installationCharge: existing.installationCharge ? String(Number(existing.installationCharge.amount)) : "",
          discountType: existing.discountType ?? "FLAT",
          // A percentage discount shows the percentage that was typed, not the rupees it came to.
          discountAmount:
            existing.discountType === "PERCENT" && existing.discountPercent != null
              ? String(Number(existing.discountPercent))
              : existing.discountAmount
                ? String(Number(existing.discountAmount.amount))
                : "",
          lines: existing.lines.map((line) => ({
            lineId: line.id,
            productId: line.productId,
            variantId: line.variantId ?? "",
            quantity: String(line.quantity),
            rentalDays: String(line.rentalDays),
            unitRatePerDay: String(Number(line.unitRatePerDay.amount)),
            rateOverride: false,
            oneTime: Boolean(line.oneTime),
            oneTimeName: line.oneTime ? line.productName : "",
            oneTimeRateType: line.rateType ?? "Qty",
          })),
        }
      : {
          customerName: "",
          customerId: "",
          eventDate: "",
          validUntil: defaultValidUntil(),
          securityDeposit: "",
          deliveryCharge: "",
          transportationCharge: "",
          installationCharge: "",
          discountType: "FLAT",
          discountAmount: "",
          lines: [emptyLine()],
        },
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: "lines" });

  const [picking, setPicking] = useState(false);

  // Watched rather than read on submit, because the running estimate is the
  // only feedback there is while the quotation is being built. useWatch rather
  // than form.watch: watch() hands back a function the React Compiler cannot
  // memoize safely, so using it opts this whole component out of compilation.
  const watchedLines = useWatch({ control, name: "lines" });
  const watchedCustomerName = useWatch({ control, name: "customerName" });
  const watchedCustomerId = useWatch({ control, name: "customerId" });
  const watchedEventDate = useWatch({ control, name: "eventDate" });

  // The name is typed, but a quotation still belongs to a customer record by
  // id — its order, deposit and credit notes all hang off that id — so the
  // name is resolved to an existing customer rather than stored on its own.
  // Names are not unique (emails are), so several matches ask which one.
  // Editing keeps the quotation's customer while its name is left as it was,
  // even if the customer has since been renamed.
  const keepsExistingCustomer = Boolean(
    existing?.customerId &&
      sameName(watchedCustomerName ?? "", existing.customerName),
  );
  const nameMatches = (customers.data ?? []).filter((customer) =>
    sameName(customer.fullName, watchedCustomerName ?? ""),
  );
  const selectedCustomer = keepsExistingCustomer
    ? customers.data?.find((customer) => customer.id === existing?.customerId)
    : nameMatches.length === 1
      ? nameMatches[0]
      : nameMatches.find((customer) => customer.id === watchedCustomerId);

  // An event planner is quoted the product's wholesale rate, moved by their own discount (20 unless staff set another, and 20
  // is the wholesale rate itself); anyone else, retail.
  const plannerPercent =
    selectedCustomer?.accountType === "EVENT_PLANNER" ? (selectedCustomer.plannerDiscountPercent ?? 20) : 0;
  const customerPercent =
    selectedCustomer && selectedCustomer.accountType !== "EVENT_PLANNER" ? (selectedCustomer.customerDiscountPercent ?? 0) : 0;

  /** What this customer is quoted for a product (or one of its variants): retail, or an event planner's wholesale-based rate. */
  const quotedFor = (product: ProductView, variant?: ProductVariantView): number => {
    const source = variant ?? product;
    const retail = Number(source.retailRate.amount);
    if (plannerPercent) return plannerRate(retail, Number(source.wholesaleRate.amount), plannerPercent);
    // A regular customer's own percentage off retail (same rounding as the backend: two decimals).
    return customerPercent ? Math.round(retail * (100 - customerPercent)) / 100 : retail;
  };

  /** The per-day rate a line is priced at, or null until it has a product. */
  const rateFor = (
    line: { lineId: string; productId: string; variantId?: string; unitRatePerDay?: string; oneTime?: boolean } | undefined,
  ) => {
    // A one-time line is priced at exactly what was typed, and has no catalogue rate to fall back on.
    if (line?.oneTime) {
      const typedRate = Number(line.unitRatePerDay);
      return line.unitRatePerDay?.trim() && Number.isFinite(typedRate) ? typedRate : null;
    }
    if (!line?.productId) return null;
    if (line.unitRatePerDay?.trim()) {
      const enteredRate = Number(line.unitRatePerDay);
      return Number.isFinite(enteredRate) ? enteredRate : null;
    }
    const stored = line.lineId ? storedLines.get(line.lineId) : undefined;
    if (stored && stored.productId === line.productId) return Number(stored.unitRatePerDay.amount);
    const product = productsById.get(line.productId);
    if (!product) return null;
    // An estimate: the server prices the line (a variant's own rate, less an event planner's discount) and the
    // saved quotation shows the final figure.
    const variant = line.variantId ? product.variants?.find((v) => v.id === line.variantId) : undefined;
    return quotedFor(product, variant);
  };

  /** How a line is charged: what it was priced at when saved, else the chosen product's own setting. */
  const rateTypeFor = (
    line: { lineId: string; productId: string; oneTime?: boolean; oneTimeRateType?: RateType } | undefined,
  ) => {
    if (line?.oneTime) return line.oneTimeRateType ?? "Qty";
    if (!line?.productId) return null;
    const stored = line.lineId ? storedLines.get(line.lineId) : undefined;
    if (stored && stored.productId === line.productId && stored.rateType) return stored.rateType;
    return productsById.get(line.productId)?.rateType ?? null;
  };

  const priceLine = (line: FormInput["lines"][number] | undefined) => {
    const rate = rateFor(line);
    if (rate === null || !line) return null;
    const count = Number(line.quantity);
    const days = Number(line.rentalDays);
    if (!Number.isInteger(count) || !Number.isInteger(days) || count < 1 || days < 1) return null;
    return rate * count * days;
  };

  /** A side typed: both sides known gives the area, which goes into the line. */
  const changeSide = (
    id: string,
    index: number,
    current: { length: string; width: string },
    which: "length" | "width",
    value: string,
  ) => {
    const next = { ...current, [which]: value };
    setSides((previous) => ({ ...previous, [id]: next }));
    const area = areaOf(next.length, next.width);
    if (area !== null) setValue(`lines.${index}.quantity`, String(area), { shouldValidate: true, shouldDirty: true });
  };

  /** An area typed: the sides show the whole-number fit nearest a square, or empty when there is none. */
  const followArea = (id: string, value: string) => {
    const fit = /^\d+$/.test(value) ? bestFit(Number(value)) : null;
    setSides((previous) => ({ ...previous, [id]: { length: fit ? String(fit[0]) : "", width: fit ? String(fit[1]) : "" } }));
  };

  const watchedDelivery = Number(useWatch({ control, name: "deliveryCharge" })) || 0;
  const watchedTransportation = Number(useWatch({ control, name: "transportationCharge" })) || 0;
  const watchedInstallation = Number(useWatch({ control, name: "installationCharge" })) || 0;
  const watchedDiscount = Number(useWatch({ control, name: "discountAmount" })) || 0;
  const watchedDiscountType = useWatch({ control, name: "discountType" });
  const itemsEstimate = watchedLines.reduce((running, line) => running + (priceLine(line) ?? 0), 0);
  // A percentage comes off the items after the bundle discounts, as the backend works it out; the bundle discounts
  // are only known for a quotation that already exists.
  const bundleDiscounts = (existing?.bundleDiscounts ?? []).reduce((sum, d) => sum + Number(d.amount.amount), 0);
  const discountEstimate =
    watchedDiscountType === "PERCENT"
      ? Math.round(Math.max(itemsEstimate - bundleDiscounts, 0) * Math.min(watchedDiscount, 100)) / 100
      : watchedDiscount;
  // GST is charged on the items after discounts; delivery, transportation and installation are added after it and carry none.
  const taxable = Math.max(itemsEstimate - bundleDiscounts - discountEstimate, 0);
  const gst = gstOn(taxable, company.data?.gstRate, company.data?.state, selectedCustomer?.state);
  const estimate = taxable + (gst?.total ?? 0) + watchedDelivery + watchedTransportation + watchedInstallation;

  // The Inventory column: each line's stock on the event date, asked for once typing has paused. A one-time line has no
  // stock and is always available; a line with no product yet, or a product with variants and none chosen, waits.
  const stockLines = fields.flatMap((field, index) => {
    const line = watchedLines[index];
    const count = Number(line?.quantity);
    const days = Number(line?.rentalDays);
    if (!line?.productId || line.oneTime || !Number.isInteger(count) || count < 1 || !Number.isInteger(days) || days < 1) return [];
    if (productsById.get(line.productId)?.hasVariants && !line.variantId) return [];
    return [{ key: field.id, productId: line.productId, variantId: line.variantId || undefined, quantity: count, rentalDays: days }];
  });
  const stock = useDateStock({
    eventDate: watchedEventDate || undefined,
    excludeQuotationId: existing?.id,
    lines: stockLines,
  });
  const lineStocks: LineStock[] = fields.map((field, index) => ({
    oneTime: Boolean(watchedLines[index]?.oneTime),
    checkable: stockLines.some((candidate) => candidate.key === field.id),
    result: stock.results.get(field.id),
    needsDate: !watchedEventDate,
    pending: stock.pending,
    failed: stock.failed,
  }));

  // Match the Admin Products search fields so staff can find products by SKU,
  // generic name, category, sub-category or storefront facets.
  // Left to the React Compiler to memoize: the hint follows the chosen customer, which is not a stable dependency.
  const productOptions: SearchSelectOption[] = (products.data ?? []).map((product) => ({
      value: product.id,
      label: product.name,
      hint: `${formatMoney(quotedMoney(product.retailRate, product.wholesaleRate, plannerPercent))} ${ratePerDayLabel(product.rateType)}`,
      // The small picture where there is one: a list of fifty full-size photos would be slow to open.
      image: pictureOf(product.media),
      keywords: [
        product.sku,
        product.skuOwner,
        product.genericName,
        product.categoryName ?? "",
        product.subCategoryName ?? "",
        ...(product.colours ?? []),
        ...(product.materials ?? []),
        ...(product.fabrics ?? []),
        ...(product.moods ?? []),
        ...(product.themes ?? []),
      ].join(" "),
  }));
  /**
   * Products chosen in the picker become lines, each priced afresh as the dropdown does. A line still empty (nothing
   * chosen on it yet) makes way for them, so picking into a new quotation does not leave a blank first row.
   */
  const addChosen = (chosen: ChosenProduct[]) => {
    const kept = getValues("lines").filter((line) => line.productId || line.oneTime);
    const added = chosen.map(({ productId, variantId, quantity }) => {
      const product = productsById.get(productId);
      const variant = variantId ? product?.variants?.find((candidate) => candidate.id === variantId) : undefined;
      return {
        ...emptyLine(),
        productId,
        variantId: variantId ?? "",
        quantity: String(quantity),
        unitRatePerDay: product ? String(quotedFor(product, variant)) : "0",
      };
    });
    replace([...kept, ...added]);
  };

  // A new line is prefilled with the rate it will be priced at, so choosing a different customer (a planner, or back to a
  // plain customer) re-prefills the lines nobody has typed a rate on. Lines already saved keep their saved rate.
  useEffect(() => {
    getValues("lines").forEach((line, index) => {
      if (line.oneTime || line.rateOverride || line.lineId || !line.productId) return;
      const product = productsById.get(line.productId);
      if (!product) return;
      const variant = line.variantId ? product.variants?.find((candidate) => candidate.id === line.variantId) : undefined;
      const source = variant ?? product;
      const retail = Number(source.retailRate.amount);
      const rate = plannerPercent ? plannerRate(retail, Number(source.wholesaleRate.amount), plannerPercent) : retail;
      setValue(`lines.${index}.unitRatePerDay`, String(rate));
    });
  }, [plannerPercent, productsById, getValues, setValue]);


  const mutation = useMutation({
    mutationFn: ({ values, customerId }: { values: FormOutput; customerId: string }) => {
      if (existing) {
        return updateQuotation(existing.id, {
          customerId,
          eventDate: existing.eventDate ?? values.eventDate,
          securityDeposit: values.securityDeposit,
          deliveryCharge: values.deliveryCharge,
          transportationCharge: values.transportationCharge,
          installationCharge: values.installationCharge,
          ...discountRequest(values),
          lines: values.lines.map((line) => ({
            lineId: line.lineId || undefined,
            productId: line.oneTime ? "" : line.productId,
            variantId: line.oneTime ? undefined : line.variantId || undefined,
            quantity: line.quantity,
            rentalDays: line.rentalDays,
            // A one-time line has no catalogue rate, so its rate and name always go.
            unitRatePerDay: line.oneTime || line.rateOverride ? line.unitRatePerDay : undefined,
            oneTimeName: line.oneTime ? line.oneTimeName : undefined,
            oneTimeRateType: line.oneTime ? line.oneTimeRateType : undefined,
          })),
        });
      }
      const customer = customers.data?.find((candidate) => candidate.id === customerId);
      return createQuotation({
        customerId,
        // The controller takes a name and email too; the mock copies them from
        // the customer record, and these are the same values.
        customerName: customer?.fullName ?? "",
        customerEmail: customer?.email,
        eventDate: values.eventDate,
        securityDeposit: values.securityDeposit,
        deliveryCharge: values.deliveryCharge,
        transportationCharge: values.transportationCharge,
        installationCharge: values.installationCharge,
        ...discountRequest(values),
        validUntil: values.validUntil,
        lines: values.lines.map(({ productId, variantId, quantity, rentalDays, unitRatePerDay, rateOverride, oneTime, oneTimeName, oneTimeRateType }) => ({
          productId: oneTime ? "" : productId,
          variantId: oneTime ? undefined : variantId || undefined,
          quantity,
          rentalDays,
          unitRatePerDay: oneTime || rateOverride ? unitRatePerDay : undefined,
          oneTimeName: oneTime ? oneTimeName : undefined,
          oneTimeRateType: oneTime ? oneTimeRateType : undefined,
        })),
      });
    },
    onSuccess: (quotation) => {
      // The response is the whole priced record, so the lookup screen can be
      // handed it rather than re-fetching what was just returned.
      queryClient.setQueryData(quotationKeys.byId(quotation.id), quotation);
      // A changed rate or quantity changes this quotation's totals wherever they are shown: the list, the plan panel
      // and the dashboard's figures, not only the detail that was just handed the new record.
      queryClient.invalidateQueries({ queryKey: quotationKeys.list });
      queryClient.invalidateQueries({ queryKey: quotationKeys.plan(quotation.id) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      toast.success(
        existing ? `${quotation.quotationNumber} updated` : `${quotation.quotationNumber} raised`,
        { description: `${quotation.customerName} — ${formatMoney(quotation.totalAmount)}` },
      );
      router.push(`/quotations?id=${quotation.id}`);
    },
    onError: (error) => {
      // A 422 here is a business rule — no customer, an empty line list, a
      // count below 1, a converted quotation — and its detail is written for
      // the user, so it is shown verbatim.
      setFormError(
        error instanceof ApiError
          ? error.message
          : existing
            ? "Could not save the quotation."
            : "Could not raise the quotation.",
      );
    },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    // A product with variants is rented as one of its variants.
    let missingVariant = false;
    values.lines.forEach((line, index) => {
      if (productsById.get(line.productId)?.hasVariants && !line.variantId) {
        setError(`lines.${index}.variantId`, { message: "Choose a variant" });
        missingVariant = true;
      }
    });
    if (missingVariant) return;
    if (keepsExistingCustomer && existing?.customerId) {
      mutation.mutate({ values, customerId: existing.customerId });
      return;
    }
    if (!customers.data) {
      setError("customerName", { message: "Customers are still loading; try again" });
      return;
    }
    if (nameMatches.length === 0) {
      setError("customerName", {
        message: `No customer named '${values.customerName}'. Add them under Customers first.`,
      });
      return;
    }
    if (!selectedCustomer) {
      setError("customerId", { message: "Choose which customer this is" });
      return;
    }
    mutation.mutate({ values, customerId: selectedCustomer.id });
  });

  const linesError = errors.lines?.root?.message ?? errors.lines?.message;
  const loadError = products.error ?? customers.error;

  /** Leaves at once when nothing has changed; otherwise asks before throwing the changes away. */
  const leaveGuard = (leave: () => void) => (isDirty ? setLeaving(() => leave) : leave());
  const parentHref = existing ? `/quotations?id=${existing.id}` : "/quotations";

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <BackButton fallback={parentHref} guard={mutation.isPending ? () => undefined : leaveGuard} />
      {leaving ? (
        <ConfirmDialog
          title="Discard your changes?"
          description={
            existing
              ? `Your changes to ${existing.quotationNumber} have not been saved.`
              : "This quotation has not been created yet. What you entered will be lost."
          }
          confirmLabel="Discard changes"
          fallbackError="Could not leave this page."
          action={() => Promise.resolve()}
          onDone={() => {
            const leave = leaving;
            setLeaving(null);
            leave();
          }}
          onClose={() => setLeaving(null)}
        />
      ) : null}
      <PageHeader
        title={existing ? `Edit ${existing.quotationNumber}` : "New quotation"}
        description={
          existing
            ? "Saved rates stay in place unless you change them."
            : "Catalogue pricing applies unless you change a line's rate."
        }
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => leaveGuard(() => router.push(parentHref))}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
              {existing ? "Save changes" : "Create quotation"}
            </Button>
          </>
        }
      />

      {formError ? <Alert tone="error" title={formError} /> : null}

      {loadError ? (
        <Alert
          tone="error"
          title={loadError instanceof Error ? loadError.message : "The form data could not be loaded"}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              products.refetch();
              customers.refetch();
            }}
          >
            Try again
          </Button>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Customer</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label="Customer name"
            required
            error={errors.customerName?.message}
            className="sm:col-span-2"
          >
            {(props) => (
              <>
                <Input
                  {...props}
                  {...register("customerName")}
                  list="quotation-customer-names"
                  autoComplete="off"
                  placeholder="Amit Shah"
                  maxLength={200}
                  disabled={mutation.isPending}
                  autoFocus={!existing}
                />
                <datalist id="quotation-customer-names">
                  {[...new Set((customers.data ?? []).map((customer) => customer.fullName))].map(
                    (name) => (
                      <option key={name} value={name} />
                    ),
                  )}
                </datalist>
              </>
            )}
          </Field>

          <Field
            label="Event date"
            hint={existing ? "Set by the customer's request and cannot be changed here." : undefined}
            error={errors.eventDate?.message}
          >
            {(props) => (
              <Input
                {...props}
                {...register("eventDate")}
                type="date"
                disabled={mutation.isPending}
                readOnly={Boolean(existing)}
                className={existing ? "bg-muted cursor-not-allowed" : undefined}
              />
            )}
          </Field>

          {!existing ? (
            <Field
              label="Valid until"
              hint="Default is 15 days. After this date the quotation expires."
              error={errors.validUntil?.message}
            >
              {(props) => (
                <Input
                  {...props}
                  {...register("validUntil")}
                  type="date"
                  disabled={mutation.isPending}
                />
              )}
            </Field>
          ) : null}

          {!keepsExistingCustomer && nameMatches.length > 1 ? (
            <Field
              label={`${nameMatches.length} customers have this name`}
              required
              error={errors.customerId?.message}
              className="sm:col-span-2"
            >
              {(props) => (
                <Select {...props} {...register("customerId")} disabled={mutation.isPending}>
                  <option value="">Choose which one</option>
                  {nameMatches.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.fullName} · {customer.email}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : null}

          {selectedCustomer ? (
            <p className="text-xs text-muted-foreground sm:col-span-3">
              {selectedCustomer.email} ·{" "}
              {selectedCustomer.accountType === "EVENT_PLANNER" ? "Event planner" : "Customer"}
              {selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ""} ·{" "}
              <span className="font-mono">{selectedCustomer.id}</span>
              {plannerPercent ? (
                <span className="ml-1 font-medium text-foreground"> · quoted at the wholesale rate ({plannerPercent}% planner discount)</span>
              ) : null}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>Lines</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPicking(true)}
              disabled={mutation.isPending || products.isPending}
            >
              <ListPlus />
              Choose products
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append(emptyLine())}
              disabled={mutation.isPending}
            >
              <Plus />
              Add line
            </Button>
          </div>
        </CardHeader>

        {picking ? (
          <ProductPickerPanel
            products={products.data ?? []}
            loading={products.isPending}
            onAdd={addChosen}
            shownRate={(retail, wholesale) => quotedMoney(retail, wholesale, plannerPercent)}
            onClose={() => setPicking(false)}
            onQuotation={new Set(watchedLines.map((line) => line.productId).filter(Boolean))}
          />
        ) : null}

        <TableWrapper>
          <Table>
            <THead>
              <tr>
                <TH className="w-12">Sr</TH>
                <TH>Product</TH>
                <TH className="w-44 text-right">Qty</TH>
                <TH className="w-28 text-right">Days</TH>
                <TH className="w-32 text-right">Rate/day</TH>
                <TH className="w-36 text-right">Line total</TH>
                <TH className="w-56">Inventory</TH>
                <TH className="w-9" aria-label="Remove" />
              </tr>
            </THead>
            <TBody>
              {fields.map((field, index) => {
                const line = watchedLines[index];
                const rate = rateFor(line);
                const rateType = rateTypeFor(line);
                const priced = priceLine(line);
                // An area product is entered as length x width or as the area: each fills in the other.
                const areaLine = rateType === "SqFt";
                const fit = areaLine && line ? bestFit(Number(line.quantity)) : null;
                const boxes = sides[field.id] ?? { length: fit ? String(fit[0]) : "", width: fit ? String(fit[1]) : "" };
                const rowErrors = errors.lines?.[index];
                const stored = line?.lineId ? storedLines.get(line.lineId) : undefined;

                return (
                  <TR key={field.id}>
                    <TD className="tabular pt-4 align-top text-muted-foreground">{index + 1}</TD>
                    <TD className="align-top">
                      {line?.oneTime ? (
                        <div className="min-w-52 space-y-1.5">
                          <Input
                            {...register(`lines.${index}.oneTimeName`)}
                            placeholder="One-time product name"
                            aria-label={`One-time product name for line ${index + 1}`}
                            aria-invalid={Boolean(rowErrors?.oneTimeName)}
                            disabled={mutation.isPending}
                            maxLength={200}
                          />
                          {rowErrors?.oneTimeName ? (
                            <p className="text-xs text-destructive">{rowErrors.oneTimeName.message}</p>
                          ) : null}
                          <div className="flex items-center gap-2">
                            <Select
                              {...register(`lines.${index}.oneTimeRateType`)}
                              aria-label={`How one-time product ${index + 1} is charged`}
                              disabled={mutation.isPending}
                              className="h-8 w-auto text-xs"
                            >
                              {RATE_TYPES.map((type) => (
                                <option key={type} value={type}>
                                  Charged {RATE_TYPE_LABEL[type]}
                                </option>
                              ))}
                            </Select>
                            <button
                              type="button"
                              disabled={mutation.isPending}
                              onClick={() => {
                                setValue(`lines.${index}.oneTime`, false);
                                setValue(`lines.${index}.oneTimeName`, "");
                                setValue(`lines.${index}.lineId`, "");
                                setValue(`lines.${index}.unitRatePerDay`, "");
                                setValue(`lines.${index}.rateOverride`, false);
                              }}
                              className="text-xs text-primary hover:underline"
                            >
                              Choose from catalogue
                            </button>
                          </div>
                        </div>
                      ) : (
                      <Controller
                        control={control}
                        name={`lines.${index}.productId`}
                        render={({ field: productField }) => (
                          <SearchSelect
                            value={productField.value}
                            // Something that is not in the catalogue is typed in by name and rate instead.
                            action={{
                              label: "Add one-time product",
                              onSelect: (typed) => {
                                setValue(`lines.${index}.oneTime`, true);
                                setValue(`lines.${index}.oneTimeName`, typed);
                                setValue(`lines.${index}.productId`, "");
                                setValue(`lines.${index}.variantId`, "");
                                setValue(`lines.${index}.lineId`, "");
                                setValue(`lines.${index}.unitRatePerDay`, "");
                                setValue(`lines.${index}.rateOverride`, false);
                              },
                            }}
                            // A different product is a different line: it is priced afresh rather than
                            // inheriting this line's stored rate.
                            onChange={(productId) => {
                              productField.onChange(productId);
                              setValue(`lines.${index}.lineId`, "");
                              setValue(`lines.${index}.variantId`, "");
                              setValue(
                                `lines.${index}.unitRatePerDay`,
                                productsById.get(productId)
                                  ? String(quotedFor(productsById.get(productId)!))
                                  : "",
                                { shouldValidate: true },
                              );
                              setValue(`lines.${index}.rateOverride`, false);
                            }}
                            // A line can name a product that has since been deactivated, which the catalogue no
                            // longer lists; keeping it as an option stops the box silently resetting the line.
                            options={
                              stored && !productsById.has(stored.productId)
                                ? [...productOptions, { value: stored.productId, label: stored.productName }]
                                : productOptions
                            }
                            placeholder={products.isPending ? "Loading catalogue" : "Choose a product — type to search"}
                            aria-label={`Product for line ${index + 1}`}
                            aria-invalid={Boolean(rowErrors?.productId)}
                            disabled={products.isPending || mutation.isPending}
                            className="min-w-52"
                          />
                        )}
                      />
                      )}
                      {rowErrors?.productId ? (
                        <p className="mt-1 text-xs text-destructive">
                          {rowErrors.productId.message}
                        </p>
                      ) : null}
                      {rateType && !line?.oneTime ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Charged {RATE_TYPE_LABEL[rateType]}
                        </p>
                      ) : null}
                      {line?.productId && productsById.get(line.productId)?.hasVariants ? (
                        <>
                          <Select
                            {...register(`lines.${index}.variantId`, {
                              onChange: (event) => {
                                setValue(`lines.${index}.lineId`, "");
                                setValue(`lines.${index}.unitRatePerDay`, String(quotedFor(
                                  productsById.get(line.productId)!,
                                  productsById.get(line.productId)?.variants?.find((variant) => variant.id === event.target.value),
                                )), { shouldValidate: true });
                                setValue(`lines.${index}.rateOverride`, false);
                              },
                            })}
                            aria-label={`Variant for line ${index + 1}`}
                            aria-invalid={Boolean(rowErrors?.variantId)}
                            disabled={mutation.isPending}
                            className="mt-1.5 min-w-52"
                          >
                            <option value="">Choose a variant</option>
                            {/* An inactive variant cannot be priced, so it is not offered; one already on the line stays so it still shows. */}
                            {(productsById.get(line.productId)?.variants ?? [])
                              .filter((variant) => variant.active !== false || variant.id === line.variantId)
                              .map((variant) => (
                              <option key={variant.id} value={variant.id}>
                                {variant.name} — {formatMoney(quotedMoney(variant.retailRate, variant.wholesaleRate, plannerPercent))} {ratePerDayLabel(productsById.get(line.productId)?.rateType)}
                              </option>
                            ))}
                          </Select>
                          {rowErrors?.variantId ? (
                            <p className="mt-1 text-xs text-destructive">
                              {rowErrors.variantId.message}
                            </p>
                          ) : null}
                        </>
                      ) : null}
                    </TD>

                    <TD className="align-top">
                      <div className="ml-auto flex w-44 flex-col items-end gap-1.5">
                        {areaLine ? (
                          // Two sides for the floor; the area below follows them, and they follow a typed area.
                          <div className="flex w-full items-center gap-1.5">
                            <Input
                              value={boxes.length}
                              onChange={(event) => changeSide(field.id, index, boxes, "length", event.target.value)}
                              aria-label={`Length in feet for line ${index + 1}`}
                              placeholder="Length"
                              inputMode="decimal"
                              disabled={mutation.isPending}
                              className="tabular min-w-0 text-right"
                            />
                            <span aria-hidden="true" className="text-muted-foreground">×</span>
                            <Input
                              value={boxes.width}
                              onChange={(event) => changeSide(field.id, index, boxes, "width", event.target.value)}
                              aria-label={`Width in feet for line ${index + 1}`}
                              placeholder="Width"
                              inputMode="decimal"
                              disabled={mutation.isPending}
                              className="tabular min-w-0 text-right"
                            />
                          </div>
                        ) : null}
                        <div className={cn("relative", areaLine ? "w-full" : "w-24")}>
                          <Input
                            {...register(`lines.${index}.quantity`, {
                              onChange: (event) => {
                                if (areaLine) followArea(field.id, event.target.value);
                              },
                            })}
                            aria-label={areaLine ? `Area for line ${index + 1}` : `Quantity for line ${index + 1}`}
                            aria-invalid={Boolean(rowErrors?.quantity)}
                            inputMode="numeric"
                            disabled={mutation.isPending}
                            className={cn("tabular w-full text-right", rateType && "pr-10")}
                          />
                          {rateType ? (
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground opacity-50"
                            >
                              {unitLabel(rateType)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {rowErrors?.quantity ? (
                        <p className="mt-1 text-xs text-destructive">{rowErrors.quantity.message}</p>
                      ) : null}
                    </TD>

                    <TD className="align-top">
                      <Input
                        {...register(`lines.${index}.rentalDays`)}
                        aria-label={`Rental days for line ${index + 1}`}
                        aria-invalid={Boolean(rowErrors?.rentalDays)}
                        inputMode="numeric"
                        disabled={mutation.isPending}
                        className="tabular ml-auto w-20 text-right"
                      />
                      {rowErrors?.rentalDays ? (
                        <p className="mt-1 text-xs text-destructive">
                          {rowErrors.rentalDays.message}
                        </p>
                      ) : null}
                    </TD>

                    <TD className="align-top">
                      <Input
                        {...register(`lines.${index}.unitRatePerDay`, {
                          onChange: () => setValue(`lines.${index}.rateOverride`, true),
                        })}
                        aria-label={`Rate per day for line ${index + 1}`}
                        aria-invalid={Boolean(rowErrors?.unitRatePerDay)}
                        inputMode="decimal"
                        placeholder="0.00"
                        disabled={mutation.isPending || !(line?.productId || line?.oneTime)}
                        className="tabular ml-auto w-28 text-right"
                      />
                      {rowErrors?.unitRatePerDay ? (
                        <p className="mt-1 text-xs text-destructive">{rowErrors.unitRatePerDay.message}</p>
                      ) : null}
                      {rate !== null && rateType ? (
                        <span className="block text-xs text-muted-foreground">{ratePerDayLabel(rateType)}</span>
                      ) : null}
                    </TD>

                    <TD className="tabular text-right align-top">
                      {priced !== null ? formatMoney({ amount: priced, currency: "INR" }) : "—"}
                    </TD>

                    <TD className="pt-3.5 align-top">
                      <InventoryChip stock={lineStocks[index]} />
                    </TD>

                    <TD className="align-top">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        // The last line is not removable: a quotation with none
                        // is refused, so the form never offers that state.
                        disabled={fields.length === 1 || mutation.isPending}
                        onClick={() => remove(index)}
                        aria-label={`Remove line ${index + 1}`}
                        title={
                          fields.length === 1 ? "A quotation needs at least one line" : "Remove"
                        }
                      >
                        <Trash2 />
                      </Button>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </TableWrapper>

        <StockSummary stocks={lineStocks} dateLabel={watchedEventDate ? formatEventDate(watchedEventDate) : undefined} />

        {linesError ? (
          <CardContent className="border-t border-border">
            <Alert tone="error" title={linesError} />
          </CardContent>
        ) : null}

        <CardContent className="flex flex-wrap items-start gap-4 border-t border-border">
          <Field
            label="Security deposit"
            required
            error={errors.securityDeposit?.message}
            hint="INR. 0 if none."
            className="min-w-40 flex-1"
          >
            {(props) => (
              <Input
                {...props}
                {...register("securityDeposit")}
                inputMode="decimal"
                placeholder="5000.00"
                disabled={mutation.isPending}
                className="tabular text-right"
              />
            )}
          </Field>
          <Field
            label="Delivery charge"
            error={errors.deliveryCharge?.message}
            hint="INR. Blank if none."
            className="min-w-40 flex-1"
          >
            {(props) => (
              <Input
                {...props}
                {...register("deliveryCharge")}
                inputMode="decimal"
                placeholder="0.00"
                disabled={mutation.isPending}
                className="tabular text-right"
              />
            )}
          </Field>
          <Field
            label="Transportation charge"
            error={errors.transportationCharge?.message}
            hint="INR. Blank if none."
            className="min-w-40 flex-1"
          >
            {(props) => (
              <Input
                {...props}
                {...register("transportationCharge")}
                inputMode="decimal"
                placeholder="0.00"
                disabled={mutation.isPending}
                className="tabular text-right"
              />
            )}
          </Field>
          <Field
            label="Installation charge"
            error={errors.installationCharge?.message}
            hint="INR. Blank if none."
            className="min-w-40 flex-1"
          >
            {(props) => (
              <Input
                {...props}
                {...register("installationCharge")}
                inputMode="decimal"
                placeholder="0.00"
                disabled={mutation.isPending}
                className="tabular text-right"
              />
            )}
          </Field>
          <Field
            label="Discount"
            error={errors.discountAmount?.message}
            hint={
              watchedDiscountType === "PERCENT"
                ? "% off items after bundle discounts. Blank if none."
                : "Flat amount off, INR. Blank if none."
            }
            className="min-w-56 flex-[1.4]"
          >
            {(props) => (
              <div className="flex gap-2">
                <Input
                  {...props}
                  {...register("discountAmount")}
                  inputMode="decimal"
                  placeholder={watchedDiscountType === "PERCENT" ? "10" : "0.00"}
                  disabled={mutation.isPending}
                  className="tabular text-right"
                />
                <input type="hidden" {...register("discountType")} />
                <div role="group" aria-label="Discount type" className="inline-flex shrink-0 overflow-hidden rounded-md border border-input">
                  {(["FLAT", "PERCENT"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={watchedDiscountType === type}
                      aria-label={type === "FLAT" ? "Flat amount in rupees" : "Percentage"}
                      disabled={mutation.isPending}
                      onClick={() => setValue("discountType", type, { shouldDirty: true, shouldValidate: true })}
                      className={cn(
                        "w-9 text-sm font-medium transition-colors",
                        watchedDiscountType === type
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {type === "FLAT" ? "₹" : "%"}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Field>
          <div className="mt-6 min-w-56 shrink-0 space-y-0.5 rounded-lg border border-border bg-muted/40 px-4 py-2 text-xs">
            <EstimateRow label="Taxable amount" amount={taxable} />
            {gst ? (
              gst.intraState ? (
                <>
                  <EstimateRow label={`CGST (${(company.data?.gstRate ?? 0) / 2}%)`} amount={gst.cgst} />
                  <EstimateRow label={`SGST (${(company.data?.gstRate ?? 0) / 2}%)`} amount={gst.sgst} />
                </>
              ) : (
                <EstimateRow label={`IGST (${company.data?.gstRate ?? 0}%)`} amount={gst.igst} />
              )
            ) : (
              <p className="text-muted-foreground">
                {company.data?.gstRate == null
                  ? "GST not set in company settings"
                  : !company.data.state?.trim()
                    ? "Set your state in company settings for GST"
                    : selectedCustomer
                      ? "Set this customer's state for GST"
                      : "Choose a customer for GST"}
              </p>
            )}
            {watchedDelivery + watchedTransportation + watchedInstallation > 0 ? (
              <EstimateRow label="Delivery & installation (no GST)" amount={watchedDelivery + watchedTransportation + watchedInstallation} />
            ) : null}
            <div className="flex items-baseline justify-between gap-6 border-t border-border pt-1">
              <span className="text-muted-foreground">Estimated total</span>
              <span className="tabular text-lg font-semibold">{formatMoney({ amount: estimate, currency: "INR" })}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
