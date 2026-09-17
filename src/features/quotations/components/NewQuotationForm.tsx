"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createQuotation, quotationKeys } from "@/features/quotations/api";
import { listProducts, masterDataKeys } from "@/features/master-data/api";
import { dashboardKeys } from "@/features/dashboard/api";
import type { ProductView } from "@/features/master-data/types";
import { ApiError } from "@/services/api-client";
import { formatMoney } from "@/lib/money";
import { positiveIntegerField } from "@/lib/forms";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const schema = z.object({
  customerName: z
    .string()
    .trim()
    .min(1, "Customer name is required")
    .max(200, "Maximum 200 characters"),
  customerEmail: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || z.email().safeParse(value).success,
      "Enter a valid email address",
    )
    .transform((value) => (value === "" ? undefined : value)),
  eventDate: z.string().transform((value) => (value === "" ? undefined : value)),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1, "Choose a product"),
        quantity: positiveIntegerField("Quantity"),
        rentalDays: positiveIntegerField("Rental days"),
      }),
    )
    .min(1, "A quotation needs at least one line"),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

const emptyLine = () => ({ productId: "", quantity: "1", rentalDays: "1" });

const EMPTY: FormInput = {
  customerName: "",
  customerEmail: "",
  eventDate: "",
  lines: [emptyLine()],
};

/**
 * What a line is worth, or null while it is still incomplete.
 *
 * This repeats QuotationItem#priced deliberately — rate x quantity x days for
 * the hire, deposit x quantity for the deposit, which is held against the goods
 * and so is not multiplied by days. It is shown as an estimate and never sent:
 * the server prices the quotation from its own catalogue read, and that stored
 * figure is the one the customer is held to.
 */
function priceLine(product: ProductView | undefined, quantity: string, rentalDays: string) {
  const count = Number(quantity);
  const days = Number(rentalDays);
  if (!product) return null;
  if (!Number.isInteger(count) || !Number.isInteger(days) || count < 1 || days < 1) return null;

  return {
    total: Number(product.rentalRate.amount) * count * days,
    deposit: Number(product.securityDeposit.amount) * count,
  };
}

export function NewQuotationForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const products = useQuery({
    queryKey: masterDataKeys.products,
    queryFn: ({ signal }) => listProducts(signal),
  });

  const productsById = useMemo(
    () => new Map((products.data ?? []).map((product) => [product.id, product])),
    [products.data],
  );

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  // Watched rather than read on submit, because the running estimate is the
  // only feedback there is while the quotation is being built. useWatch rather
  // than form.watch: watch() hands back a function the React Compiler cannot
  // memoize safely, so using it opts this whole component out of compilation.
  const watchedLines = useWatch({ control, name: "lines" });

  const estimate = watchedLines.reduce(
    (running, line) => {
      const priced = priceLine(productsById.get(line.productId), line.quantity, line.rentalDays);
      if (!priced) return running;
      return { total: running.total + priced.total, deposit: running.deposit + priced.deposit };
    },
    { total: 0, deposit: 0 },
  );

  const mutation = useMutation({
    mutationFn: createQuotation,
    onSuccess: (quotation) => {
      // The response is the whole priced record, so the lookup screen can be
      // handed it rather than re-fetching what was just returned.
      queryClient.setQueryData(quotationKeys.byId(quotation.id), quotation);
      // A new draft moves the only company-wide count of quotations there is.
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      toast.success(`${quotation.quotationNumber} raised`, {
        description: `${quotation.customerName} — ${formatMoney(quotation.totalAmount)}`,
      });
      router.push(`/quotations?id=${quotation.id}`);
    },
    onError: (error) => {
      // A 422 here is a business rule — an empty line list, a count below 1, or
      // a product id from another company — and its detail is written for the
      // user, so it is shown verbatim.
      setFormError(error instanceof ApiError ? error.message : "Could not raise the quotation.");
    },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    mutation.mutate({
      customerName: values.customerName,
      customerEmail: values.customerEmail,
      eventDate: values.eventDate,
      lines: values.lines,
    });
  });

  const linesError = errors.lines?.root?.message ?? errors.lines?.message;

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <PageHeader
        title="New quotation"
        description="Priced from the catalogue at the moment it is saved."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/quotations")}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
              Create quotation
            </Button>
          </>
        }
      />

      {formError ? <Alert tone="error" title={formError} /> : null}

      {products.isError ? (
        <Alert
          tone="error"
          title={
            products.error instanceof Error
              ? products.error.message
              : "The product catalogue could not be loaded"
          }
        >
          <Button type="button" variant="outline" size="sm" onClick={() => products.refetch()}>
            Try again
          </Button>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Customer</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Name" required error={errors.customerName?.message}>
            {(props) => (
              <Input {...props} {...register("customerName")} placeholder="Amit Shah" autoFocus />
            )}
          </Field>

          <Field label="Email" error={errors.customerEmail?.message}>
            {(props) => (
              <Input
                {...props}
                {...register("customerEmail")}
                type="email"
                autoComplete="off"
                placeholder="amit.shah@example.com"
              />
            )}
          </Field>

          <Field label="Event date" error={errors.eventDate?.message}>
            {(props) => <Input {...props} {...register("eventDate")} type="date" />}
          </Field>
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
                <TH className="text-right">Line total</TH>
                <TH className="w-9" aria-label="Remove" />
              </tr>
            </THead>
            <TBody>
              {fields.map((field, index) => {
                const line = watchedLines[index];
                const priced = line
                  ? priceLine(productsById.get(line.productId), line.quantity, line.rentalDays)
                  : null;
                const rowErrors = errors.lines?.[index];

                return (
                  <TR key={field.id}>
                    <TD className="align-top">
                      <Select
                        {...register(`lines.${index}.productId`)}
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
                            {product.name} — {formatMoney(product.rentalRate)}/day
                          </option>
                        ))}
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

                    <TD className="tabular text-right">
                      {priced ? formatMoney({ amount: priced.total, currency: "INR" }) : "—"}
                    </TD>

                    <TD>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        // The last line is not removable: the backend refuses a
                        // quotation with none, so the form never offers the
                        // state that would only come back as a 422.
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

        <CardContent className="flex flex-wrap justify-end gap-6 border-t border-border">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Estimated security deposit</p>
            <p className="tabular mt-0.5 text-sm font-semibold">
              {formatMoney({ amount: estimate.deposit, currency: "INR" })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Estimated total</p>
            <p className="tabular mt-0.5 text-lg font-semibold">
              {formatMoney({ amount: estimate.total, currency: "INR" })}
            </p>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
