"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Package, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  addProductToWarehouse,
  listProducts,
  listWarehouseProducts,
  masterDataKeys,
} from "@/features/master-data/api";
import type { WarehouseView } from "@/features/master-data/types";
import { useCan } from "@/features/auth";
import { ApiError } from "@/services/api-client";
import { positiveIntegerField } from "@/lib/forms";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const FORM_ID = "warehouse-product-form";

const schema = z.object({
  productId: z.string().min(1, "Choose a product"),
  // "" for a product without variants. Whether one is needed depends on the
  // chosen product, which the schema cannot see, so that is checked on submit.
  variantId: z.string(),
  quantity: positiveIntegerField("Quantity"),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

/**
 * What one warehouse holds, and the one way to change it: adding stock.
 *
 * The add form replaces the table's footer actions inside the same dialog
 * rather than opening a second dialog on top, because Dialog closes on Escape
 * at the document level and two stacked ones would both close at once. After
 * a successful add the form closes and the table shows the new count, so the
 * result of "add 5 to 20" is visible as 25 straight away.
 */
export function WarehouseProductsDialog({
  warehouse,
  onClose,
}: {
  warehouse: WarehouseView;
  onClose: () => void;
}) {
  const canWrite = useCan("MASTER_DATA_WRITE");
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const holdings = useQuery({
    queryKey: masterDataKeys.warehouseProducts(warehouse.id),
    queryFn: ({ signal }) => listWarehouseProducts(warehouse.id, signal),
  });

  const products = useQuery({
    queryKey: masterDataKeys.products,
    queryFn: ({ signal }) => listProducts(signal),
    enabled: adding,
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
      addProductToWarehouse(warehouse.id, {
        productId: values.productId,
        variantId: values.variantId || undefined,
        quantity: values.quantity,
      }),
    onSuccess: (entry, values) => {
      queryClient.invalidateQueries({ queryKey: masterDataKeys.warehouseProducts(warehouse.id) });
      // A variant's stock total is shown with the product.
      queryClient.invalidateQueries({ queryKey: masterDataKeys.products });
      const label = entry.variantName
        ? `${entry.productName} (${entry.variantName})`
        : entry.productName;
      toast.success(`${values.quantity} × ${label} added`, {
        description: `${warehouse.name} now holds ${entry.quantity}`,
      });
      reset();
      setAdding(false);
    },
    onError: (error) =>
      setFormError(error instanceof ApiError ? error.message : "Could not add the product."),
  });

  const stopAdding = () => {
    reset();
    setFormError(null);
    setAdding(false);
  };

  // Every product stays selectable, including ones already held here: picking
  // one of those is how more of it is added. The hint says which case it is.
  const selected = useWatch({ control, name: "productId" });
  const selectedVariant = useWatch({ control, name: "variantId" });
  const selectedProduct = products.data?.find((product) => product.id === selected);
  const needsVariant = Boolean(selectedProduct?.hasVariants);
  // Stock is held per variant, so "already holds" means this exact variant.
  const alreadyHeld = holdings.data?.find(
    (entry) =>
      entry.productId === selected && (entry.variantId ?? "") === (needsVariant ? selectedVariant : ""),
  );

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${warehouse.name} products`}
      description={warehouse.city}
      footer={
        adding ? (
          <>
            <Button variant="outline" onClick={stopAdding} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button form={FORM_ID} type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
              Add product
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {canWrite ? (
              <Button onClick={() => setAdding(true)}>
                <Plus />
                Add product
              </Button>
            ) : null}
          </>
        )
      }
    >
      {adding ? (
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

          <Field
            label="Product"
            required
            error={errors.productId?.message}
            hint={
              alreadyHeld && !needsVariant
                ? `Already holds ${alreadyHeld.quantity}. The quantity below is added to it.`
                : undefined
            }
          >
            {(props) => (
              <Select
                {...props}
                {...register("productId", {
                  // Variants belong to one product, so a new product means
                  // choosing its variant afresh.
                  onChange: () => setValue("variantId", ""),
                })}
                disabled={products.isPending}
              >
                <option value="">
                  {products.isPending ? "Loading catalogue" : "Choose a product"}
                </option>
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
                  : alreadyHeld
                    ? `Already holds ${alreadyHeld.quantity}. The quantity below is added to it.`
                    : undefined
              }
            >
              {(props) => (
                <Select
                  {...props}
                  {...register("variantId")}
                  disabled={!selectedProduct.variants.length}
                >
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

          <Field label="Quantity" required error={errors.quantity?.message}>
            {(props) => (
              <Input
                {...props}
                {...register("quantity")}
                inputMode="numeric"
                placeholder="1"
                className="tabular"
              />
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
                  <TH className="text-right">Quantity</TH>
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
              title="Could not load this warehouse's products"
              description={holdings.error instanceof Error ? holdings.error.message : undefined}
              action={
                <Button variant="outline" onClick={() => holdings.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : null}

          {holdings.data && !holdings.data.length ? (
            <EmptyState icon={<Package />} title="No products in this warehouse yet" />
          ) : null}
        </div>
      )}
    </Dialog>
  );
}
