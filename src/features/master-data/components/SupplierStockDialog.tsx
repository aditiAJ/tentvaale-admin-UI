"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Package, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  listProducts,
  listSupplierStock,
  masterDataKeys,
  setSupplierStock,
} from "@/features/master-data/api";
import type { SupplierView } from "@/features/master-data/types";
import { useCan } from "@/features/auth";
import { ApiError } from "@/services/api-client";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const FORM_ID = "supplier-stock-form";

const schema = z.object({
  productId: z.string().min(1, "Choose a product"),
  // "" for a product without variants; whether one is needed depends on the product, so it is
  // checked on submit.
  variantId: z.string(),
  // Unlike a warehouse top-up, zero is a real answer here: the supplier has none right now.
  quantity: z
    .string()
    .trim()
    .min(1, "Quantity is required")
    .regex(/^\d+$/, "Whole numbers only")
    .transform(Number),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

/**
 * What one supplier can provide. The form sets a count (it does not add to it), so entering 30
 * where the table says 50 leaves 30. Supplier stock is kept apart from owned stock and is never
 * shown on the storefront.
 */
export function SupplierStockDialog({
  supplier,
  onClose,
}: {
  supplier: SupplierView;
  onClose: () => void;
}) {
  const canWrite = useCan("MASTER_DATA_WRITE");
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const holdings = useQuery({
    queryKey: masterDataKeys.supplierStock(supplier.id),
    queryFn: ({ signal }) => listSupplierStock(supplier.id, signal),
  });

  const products = useQuery({
    queryKey: masterDataKeys.products,
    queryFn: ({ signal }) => listProducts(signal),
    enabled: editing,
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    setError,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { productId: "", variantId: "", quantity: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: FormOutput) =>
      setSupplierStock(supplier.id, {
        productId: values.productId,
        variantId: values.variantId || undefined,
        quantity: values.quantity,
      }),
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: masterDataKeys.supplierStock(supplier.id) });
      // A product's stock figures include what suppliers can provide.
      queryClient.invalidateQueries({ queryKey: masterDataKeys.products });
      const label = entry.variantName
        ? `${entry.productName} (${entry.variantName})`
        : entry.productName;
      toast.success(`${supplier.name} can provide ${entry.quantity} × ${label}`);
      reset();
      setEditing(false);
    },
    onError: (error) =>
      setFormError(error instanceof ApiError ? error.message : "Could not save the stock."),
  });

  const stopEditing = () => {
    reset();
    setFormError(null);
    setEditing(false);
  };

  const selected = useWatch({ control, name: "productId" });
  const selectedVariant = useWatch({ control, name: "variantId" });
  const selectedProduct = products.data?.find((product) => product.id === selected);
  const needsVariant = Boolean(selectedProduct?.hasVariants);
  const current = holdings.data?.find(
    (entry) =>
      entry.productId === selected && (entry.variantId ?? "") === (needsVariant ? selectedVariant : ""),
  );

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${supplier.name} stock`}
      description="What this supplier can provide. Never shown to customers."
      footer={
        editing ? (
          <>
            <Button variant="outline" onClick={stopEditing} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button form={FORM_ID} type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
              Save stock
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {canWrite ? (
              <Button onClick={() => setEditing(true)}>
                <Plus />
                Set stock
              </Button>
            ) : null}
          </>
        )
      }
    >
      {editing ? (
        <form
          id={FORM_ID}
          className="space-y-4"
          noValidate
          onSubmit={handleSubmit((values) => {
            if (needsVariant && !values.variantId) {
              setError("variantId", { message: "Choose a variant" });
              return;
            }
            setFormError(null);
            mutation.mutate(values);
          })}
        >
          {formError ? <Alert tone="error" title={formError} /> : null}

          <Field label="Product" required error={errors.productId?.message}>
            {(props) => (
              <Select
                {...props}
                {...register("productId", { onChange: () => setValue("variantId", "") })}
                disabled={products.isPending}
              >
                <option value="">{products.isPending ? "Loading catalogue" : "Choose a product"}</option>
                {(products.data ?? []).map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {needsVariant && selectedProduct ? (
            <Field
              label="Variant"
              required
              error={errors.variantId?.message}
              hint={
                !selectedProduct.variants.length
                  ? "This product has no variants yet. Add them from Products first."
                  : undefined
              }
            >
              {(props) => (
                <Select {...props} {...register("variantId")} disabled={!selectedProduct.variants.length}>
                  <option value="">Choose a variant</option>
                  {selectedProduct.variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : null}

          <Field
            label="Quantity available"
            required
            error={errors.quantity?.message}
            hint={current ? `Currently ${current.quantity}. This replaces it.` : undefined}
          >
            {(props) => (
              <Input {...props} {...register("quantity")} inputMode="numeric" placeholder="0" className="tabular" />
            )}
          </Field>
        </form>
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <TableWrapper>
            <Table>
              <THead>
                <tr>
                  <TH>Product</TH>
                  <TH className="text-right">Available</TH>
                </tr>
              </THead>
              <TBody>
                {holdings.isPending ? <TableSkeleton rows={3} columns={2} /> : null}
                {holdings.data?.map((entry) => (
                  <TR key={`${entry.productId}:${entry.variantId ?? ""}`}>
                    <TD>
                      <span className="font-medium">{entry.productName}</span>
                      {entry.variantName ? (
                        <span className="ml-2 text-muted-foreground">{entry.variantName}</span>
                      ) : null}
                    </TD>
                    <TD className="tabular text-right">{entry.quantity}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrapper>

          {holdings.isError ? (
            <EmptyState
              title="Could not load this supplier's stock"
              description={holdings.error instanceof Error ? holdings.error.message : undefined}
              action={
                <Button variant="outline" onClick={() => holdings.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : null}

          {holdings.data && !holdings.data.length ? (
            <EmptyState icon={<Package />} title="No stock recorded for this supplier yet" />
          ) : null}
        </div>
      )}
    </Dialog>
  );
}
