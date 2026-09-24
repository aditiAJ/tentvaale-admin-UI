"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createQuotation, quotationKeys, updateQuotation } from "@/features/quotations/api";
import type { QuotationView } from "@/features/quotations/types";
import { listCustomers, listProducts, masterDataKeys } from "@/features/master-data/api";
import { dashboardKeys } from "@/features/dashboard/api";
import { ApiError } from "@/services/api-client";
import { formatMoney } from "@/lib/money";
import { amountField, isIsoDate, positiveIntegerField } from "@/lib/forms";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const schema = z.object({
  customerId: z.string().min(1, "Choose a customer"),
  eventDate: z
    .string()
    .refine((value) => value === "" || isIsoDate(value), "Enter a valid date")
    .transform((value) => (value === "" ? undefined : value)),
  // One amount for the whole booking: products no longer carry a deposit of
  // their own, so nothing on the lines can add up to one.
  securityDeposit: amountField("Security deposit"),
  lines: z
    .array(
      z.object({
        // "" for a line added in this form. Set for a line the quotation
        // already has, which keeps the rate it was priced at.
        lineId: z.string(),
        productId: z.string().min(1, "Choose a product"),
        quantity: positiveIntegerField("Quantity"),
        rentalDays: positiveIntegerField("Rental days"),
      }),
    )
    .min(1, "A quotation needs at least one line"),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

const emptyLine = () => ({ lineId: "", productId: "", quantity: "1", rentalDays: "1" });

/**
 * Raises a quotation, or edits one that has not been converted.
 *
 * The line totals shown are an estimate and never sent: the server prices
 * the quotation and stores the result, and that stored figure is what the
 * customer is held to. The estimate follows the same rule the server does —
 * a line the quotation already has is priced at the per-day rate it was
 * priced at originally, not today's catalogue rate; only a new line uses the
 * product's current retail rate. Choosing a different product for an existing
 * line makes it a new line, priced afresh.
 */
export function QuotationForm({ existing }: { existing?: QuotationView }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const products = useQuery({
    queryKey: masterDataKeys.products,
    queryFn: ({ signal }) => listProducts(signal),
  });
  const customers = useQuery({
    queryKey: masterDataKeys.customers,
    queryFn: ({ signal }) => listCustomers(signal),
  });

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
    setValue,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: existing
      ? {
          customerId: existing.customerId ?? "",
          eventDate: existing.eventDate ?? "",
          securityDeposit: String(Number(existing.totalSecurityDeposit.amount)),
          lines: existing.lines.map((line) => ({
            lineId: line.id,
            productId: line.productId,
            quantity: String(line.quantity),
            rentalDays: String(line.rentalDays),
          })),
        }
      : { customerId: "", eventDate: "", securityDeposit: "", lines: [emptyLine()] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  // Watched rather than read on submit, because the running estimate is the
  // only feedback there is while the quotation is being built. useWatch rather
  // than form.watch: watch() hands back a function the React Compiler cannot
  // memoize safely, so using it opts this whole component out of compilation.
  const watchedLines = useWatch({ control, name: "lines" });
  const watchedCustomerId = useWatch({ control, name: "customerId" });

  /** The per-day rate a line is priced at, or null until it has a product. */
  const rateFor = (line: { lineId: string; productId: string } | undefined) => {
    if (!line?.productId) return null;
    const stored = line.lineId ? storedLines.get(line.lineId) : undefined;
    if (stored && stored.productId === line.productId) return Number(stored.unitRatePerDay.amount);
    const product = productsById.get(line.productId);
    return product ? Number(product.retailRate.amount) : null;
  };

  const priceLine = (line: FormInput["lines"][number] | undefined) => {
    const rate = rateFor(line);
    if (rate === null || !line) return null;
    const count = Number(line.quantity);
    const days = Number(line.rentalDays);
    if (!Number.isInteger(count) || !Number.isInteger(days) || count < 1 || days < 1) return null;
    return rate * count * days;
  };

  const estimate = watchedLines.reduce((running, line) => running + (priceLine(line) ?? 0), 0);

  const selectedCustomer = customers.data?.find((customer) => customer.id === watchedCustomerId);

  const mutation = useMutation({
    mutationFn: (values: FormOutput) => {
      if (existing) {
        return updateQuotation(existing.id, {
          customerId: values.customerId,
          eventDate: values.eventDate,
          securityDeposit: values.securityDeposit,
          lines: values.lines.map((line) => ({
            lineId: line.lineId || undefined,
            productId: line.productId,
            quantity: line.quantity,
            rentalDays: line.rentalDays,
          })),
        });
      }
      const customer = customers.data?.find((candidate) => candidate.id === values.customerId);
      return createQuotation({
        customerId: values.customerId,
        // The controller takes a name and email too; the mock copies them from
        // the customer record, and these are the same values.
        customerName: customer?.fullName ?? "",
        customerEmail: customer?.email,
        eventDate: values.eventDate,
        securityDeposit: values.securityDeposit,
        lines: values.lines.map(({ productId, quantity, rentalDays }) => ({
          productId,
          quantity,
          rentalDays,
        })),
      });
    },
    onSuccess: (quotation) => {
      // The response is the whole priced record, so the lookup screen can be
      // handed it rather than re-fetching what was just returned.
      queryClient.setQueryData(quotationKeys.byId(quotation.id), quotation);
      // A new draft moves the only company-wide count of quotations there is.
      if (!existing) queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
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
    mutation.mutate(values);
  });

  const linesError = errors.lines?.root?.message ?? errors.lines?.message;
  const loadError = products.error ?? customers.error;

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <PageHeader
        title={existing ? `Edit ${existing.quotationNumber}` : "New quotation"}
        description={
          existing
            ? "Existing lines keep the rate they were priced at."
            : "Priced from the catalogue at the moment it is saved."
        }
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                router.push(existing ? `/quotations?id=${existing.id}` : "/quotations")
              }
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
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Customer"
            required
            error={errors.customerId?.message}
            className="sm:col-span-2"
          >
            {(props) => (
              <Select
                {...props}
                {...register("customerId")}
                disabled={customers.isPending || mutation.isPending}
                autoFocus={!existing}
              >
                <option value="">
                  {customers.isPending ? "Loading customers" : "Choose a customer"}
                </option>
                {(customers.data ?? []).map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.fullName} · {customer.email}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Event date" error={errors.eventDate?.message}>
            {(props) => (
              <Input
                {...props}
                {...register("eventDate")}
                type="date"
                disabled={mutation.isPending}
              />
            )}
          </Field>

          {selectedCustomer ? (
            <p className="text-xs text-muted-foreground sm:col-span-3">
              {selectedCustomer.accountType === "EVENT_PLANNER" ? "Event planner" : "Customer"}
              {selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ""} ·{" "}
              <span className="font-mono">{selectedCustomer.id}</span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>Lines</CardTitle>
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
        </CardHeader>

        <TableWrapper>
          <Table>
            <THead>
              <tr>
                <TH>Product</TH>
                <TH className="text-right">Qty</TH>
                <TH className="text-right">Days</TH>
                <TH className="text-right">Rate/day</TH>
                <TH className="text-right">Line total</TH>
                <TH className="w-9" aria-label="Remove" />
              </tr>
            </THead>
            <TBody>
              {fields.map((field, index) => {
                const line = watchedLines[index];
                const rate = rateFor(line);
                const priced = priceLine(line);
                const rowErrors = errors.lines?.[index];
                const stored = line?.lineId ? storedLines.get(line.lineId) : undefined;

                return (
                  <TR key={field.id}>
                    <TD className="align-top">
                      <Select
                        {...register(`lines.${index}.productId`, {
                          // A different product is a different line: it is
                          // priced afresh rather than inheriting this line's
                          // stored rate.
                          onChange: () => setValue(`lines.${index}.lineId`, ""),
                        })}
                        aria-label={`Product for line ${index + 1}`}
                        aria-invalid={Boolean(rowErrors?.productId)}
                        disabled={products.isPending || mutation.isPending}
                        className="min-w-52"
                      >
                        <option value="">
                          {products.isPending ? "Loading catalogue" : "Choose a product"}
                        </option>
                        {(products.data ?? []).map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} — {formatMoney(product.retailRate)}/day
                          </option>
                        ))}
                        {/* A line can name a product that has since been
                            deactivated, which the catalogue no longer lists;
                            keeping it as an option stops the select silently
                            resetting the line. */}
                        {stored && !productsById.has(stored.productId) ? (
                          <option value={stored.productId}>{stored.productName}</option>
                        ) : null}
                      </Select>
                      {rowErrors?.productId ? (
                        <p className="mt-1 text-xs text-destructive">
                          {rowErrors.productId.message}
                        </p>
                      ) : null}
                    </TD>

                    <TD className="align-top">
                      <Input
                        {...register(`lines.${index}.quantity`)}
                        aria-label={`Quantity for line ${index + 1}`}
                        aria-invalid={Boolean(rowErrors?.quantity)}
                        inputMode="numeric"
                        disabled={mutation.isPending}
                        className="tabular w-20 text-right"
                      />
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
                        className="tabular w-20 text-right"
                      />
                      {rowErrors?.rentalDays ? (
                        <p className="mt-1 text-xs text-destructive">
                          {rowErrors.rentalDays.message}
                        </p>
                      ) : null}
                    </TD>

                    <TD className="tabular text-right align-top">
                      {rate !== null ? formatMoney({ amount: rate, currency: "INR" }) : "—"}
                    </TD>

                    <TD className="tabular text-right align-top">
                      {priced !== null ? formatMoney({ amount: priced, currency: "INR" }) : "—"}
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

        {linesError ? (
          <CardContent className="border-t border-border">
            <p className="text-xs text-destructive">{linesError}</p>
          </CardContent>
        ) : null}

        <CardContent className="flex flex-wrap items-start justify-end gap-6 border-t border-border">
          <Field
            label="Security deposit"
            required
            error={errors.securityDeposit?.message}
            hint="In INR. Enter 0 if none."
            className="w-56"
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
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Estimated total</p>
            <p className="tabular mt-0.5 text-lg font-semibold">
              {formatMoney({ amount: estimate, currency: "INR" })}
            </p>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
