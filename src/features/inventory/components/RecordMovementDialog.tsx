"use client";

import { useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  inventoryKeys,
  listStockMovementsByOrder,
  recordStockMovement,
} from "@/features/inventory/api";
import { MOVEMENT_DIRECTIONS, DIRECTION_MEANING } from "@/features/inventory/types";
import type { MovementDirection, RecordStockMovementRequest } from "@/features/inventory/types";
import {
  allowedDirections,
  orderFulfilment,
  type OrderFulfilment,
} from "@/features/inventory/fulfilment";
import { getOrder, orderKeys } from "@/features/orders/api";
import type { OrderView } from "@/features/orders/types";
import {
  listProducts,
  listWarehouseProducts,
  listWarehouses,
  masterDataKeys,
} from "@/features/master-data/api";
import { ApiError } from "@/services/api-client";
import { positiveIntegerField } from "@/lib/forms";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

const FORM_ID = "record-movement";

const schema = z.object({
  direction: z.enum(MOVEMENT_DIRECTIONS),
  movedOn: z.string().transform((value) => (value === "" ? undefined : value)),
  warehouseId: z.string().trim().min(1, "Choose a warehouse"),
  remarks: z
    .string()
    .trim()
    .max(2000, "Maximum 2000 characters")
    .transform((value) => (value === "" ? undefined : value)),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1, "Choose a product"),
        variantId: z.string(),
        quantity: positiveIntegerField("Quantity"),
      }),
    )
    .min(1, "A movement needs at least one line"),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;
type LineInput = FormInput["lines"][number];

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Records a dispatch or a return against one order.
 *
 * Only the directions the order's status allows are offered — outward while it
 * is confirmed (or dispatched with some still to send), inward while it is
 * dispatched — and the rows start as what is left to send, or what is still
 * out from the chosen warehouse, since "all of it" is the common case. The
 * store re-checks everything: lines on the order, variants, stock on the shelf.
 */
export function RecordMovementDialog({
  orderId,
  initialDirection,
  onClose,
}: {
  orderId: string;
  initialDirection?: MovementDirection;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const order = useQuery({
    queryKey: orderKeys.byId(orderId),
    queryFn: ({ signal }) => getOrder(orderId, signal),
    retry: false,
  });

  const movements = useQuery({
    queryKey: inventoryKeys.movementsByOrder(orderId),
    queryFn: ({ signal }) => listStockMovementsByOrder(orderId, signal),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: recordStockMovement,
    onSuccess: (movement) => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.movementsByOrder(orderId) });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.availability });
      // The movement moved the order along, and changed warehouse counts and
      // with them every variant's stock.
      queryClient.invalidateQueries({ queryKey: orderKeys.byId(orderId) });
      queryClient.invalidateQueries({ queryKey: masterDataKeys.warehouses });
      queryClient.invalidateQueries({ queryKey: masterDataKeys.products });
      toast.success(`${movement.movementNumber} recorded`, {
        description:
          movement.direction === "OUTWARD" ? "Dispatched to the customer" : "Returned to the warehouse",
      });
      onClose();
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : "Could not record the movement.");
    },
  });

  const loadError = order.error ?? movements.error;
  const loadFailed =
    loadError &&
    (loadError instanceof ApiError && loadError.status === 404
      ? "No order with that id."
      : loadError instanceof Error
        ? loadError.message
        : "The order could not be loaded.");

  const fulfilment = useMemo(
    () => (order.data && movements.data ? orderFulfilment(order.data, movements.data) : null),
    [order.data, movements.data],
  );
  const directions = order.data && fulfilment ? allowedDirections(order.data, fulfilment) : [];
  const canRecord = Boolean(fulfilment) && directions.length > 0;

  return (
    <Dialog
      open
      onClose={onClose}
      title="Record movement"
      description="One dispatch or return, against this whole order."
      className="max-w-3xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button form={FORM_ID} type="submit" disabled={!canRecord || mutation.isPending}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            Record movement
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {formError ? <Alert tone="error" title={formError} /> : null}
        {loadFailed ? <Alert tone="error" title={loadFailed} /> : null}

        {order.isPending || movements.isPending ? <Skeleton className="h-64" /> : null}

        {order.data && fulfilment && directions.length === 0 ? (
          <Alert
            tone="warning"
            title={`${order.data.orderNumber} is ${order.data.status.toLowerCase()}; nothing can be dispatched or returned against it.`}
          />
        ) : null}

        {order.data && fulfilment && directions.length > 0 ? (
          <MovementFields
            order={order.data}
            fulfilment={fulfilment}
            directions={directions}
            initialDirection={initialDirection}
            disabled={mutation.isPending}
            onSubmit={(values) => {
              setFormError(null);
              mutation.mutate(values);
            }}
          />
        ) : null}
      </div>
    </Dialog>
  );
}

/**
 * Split out so the form's defaults can be computed from the order and its
 * movements, which are not known on the first render. Mounting it only once
 * they have arrived means useForm sees the right defaults immediately.
 */
function MovementFields({
  order,
  fulfilment,
  directions,
  initialDirection,
  disabled,
  onSubmit,
}: {
  order: OrderView;
  fulfilment: OrderFulfilment;
  directions: MovementDirection[];
  initialDirection?: MovementDirection;
  disabled: boolean;
  onSubmit: (values: RecordStockMovementRequest) => void;
}) {
  const products = useQuery({
    queryKey: masterDataKeys.products,
    queryFn: ({ signal }) => listProducts(signal),
  });

  const warehouses = useQuery({
    queryKey: masterDataKeys.warehouses,
    queryFn: ({ signal }) => listWarehouses(signal),
    retry: false,
  });

  const productById = useMemo(
    () => new Map((products.data ?? []).map((product) => [product.id, product])),
    [products.data],
  );

  // One entry per product on the order, named as the order names it — which
  // also covers a product deactivated since, which the catalogue no longer lists.
  const orderProducts = useMemo(() => {
    const names = new Map<string, string>();
    for (const line of order.lines) {
      if (!names.has(line.productId)) names.set(line.productId, line.productName);
    }
    return [...names.entries()].map(([id, name]) => ({ id, name }));
  }, [order.lines]);

  const suggestedLines = (direction: MovementDirection, warehouseId: string): LineInput[] => {
    if (direction === "OUTWARD") {
      return orderProducts.flatMap(({ id }) => {
        const entry = fulfilment.byProduct.get(id);
        const left = entry ? entry.ordered - entry.dispatched : 0;
        return left > 0 ? [{ productId: id, variantId: "", quantity: String(left) }] : [];
      });
    }
    return fulfilment.outstanding
      .filter((entry) => entry.warehouseId === warehouseId)
      .map((entry) => ({
        productId: entry.productId,
        variantId: entry.variantId ?? "",
        quantity: String(entry.quantity),
      }));
  };

  const firstDirection =
    initialDirection && directions.includes(initialDirection) ? initialDirection : directions[0];
  // A return goes back where the goods left from, so it starts on a warehouse
  // that actually has something out.
  const firstWarehouse =
    firstDirection === "INWARD" ? (fulfilment.outstanding[0]?.warehouseId ?? "") : "";

  const {
    control,
    register,
    handleSubmit,
    getValues,
    setError,
    setValue,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      direction: firstDirection,
      movedOn: today(),
      warehouseId: firstWarehouse,
      remarks: "",
      lines: suggestedLines(firstDirection, firstWarehouse),
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: "lines" });
  const direction = useWatch({ control, name: "direction" });
  const warehouseId = useWatch({ control, name: "warehouseId" });
  const lines = useWatch({ control, name: "lines" });

  const warehouseStock = useQuery({
    queryKey: masterDataKeys.warehouseProducts(warehouseId),
    queryFn: ({ signal }) => listWarehouseProducts(warehouseId, signal),
    enabled: warehouseId !== "" && direction === "OUTWARD",
    retry: false,
  });

  /** What this row could move: on the shelf for a dispatch, still out for a return. */
  const available = (line: LineInput | undefined): number | null => {
    if (!line?.productId || !warehouseId) return null;
    const variantId = line.variantId || null;
    if (productById.get(line.productId)?.hasVariants && !variantId) return null;
    if (direction === "OUTWARD") {
      if (!warehouseStock.data) return null;
      return (
        warehouseStock.data.find(
          (entry) => entry.productId === line.productId && entry.variantId === variantId,
        )?.quantity ?? 0
      );
    }
    return (
      fulfilment.outstanding.find(
        (entry) =>
          entry.warehouseId === warehouseId &&
          entry.productId === line.productId &&
          entry.variantId === variantId,
      )?.quantity ?? 0
    );
  };

  const linesError = errors.lines?.root?.message ?? errors.lines?.message;

  return (
    <form
      id={FORM_ID}
      className="space-y-4"
      noValidate
      onSubmit={handleSubmit((values) => {
        // Which products need a variant is catalogue data the schema does not
        // have, so it is checked here, where it can mark the row.
        let missingVariant = false;
        values.lines.forEach((line, index) => {
          if (productById.get(line.productId)?.hasVariants && !line.variantId) {
            setError(`lines.${index}.variantId`, { message: "Choose a variant" });
            missingVariant = true;
          }
        });
        if (missingVariant) return;

        onSubmit({
          orderId: order.id,
          direction: values.direction,
          movedOn: values.movedOn,
          warehouseId: values.warehouseId,
          remarks: values.remarks,
          lines: values.lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId || null,
            quantity: line.quantity,
          })),
        });
      })}
    >
      <p className="text-sm">
        <span className="text-muted-foreground">Order </span>
        <strong>{order.orderNumber}</strong>
        <span className="text-muted-foreground"> — {order.customerName}</span>
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Direction" required error={errors.direction?.message}>
          {(props) => (
            <Select
              {...props}
              {...register("direction", {
                onChange: (event) =>
                  replace(suggestedLines(event.target.value, getValues("warehouseId"))),
              })}
              disabled={disabled}
            >
              {directions.map((option) => (
                <option key={option} value={option} title={DIRECTION_MEANING[option]}>
                  {option === "OUTWARD" ? "Outward — dispatch" : "Inward — return"}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Moved on" error={errors.movedOn?.message}>
          {(props) => <Input {...props} {...register("movedOn")} type="date" disabled={disabled} />}
        </Field>

        <Field label="Warehouse" required error={errors.warehouseId?.message}>
          {(props) =>
            warehouses.data ? (
              <Select
                {...props}
                {...register("warehouseId", {
                  onChange: (event) => {
                    // A return's rows are what is out from this warehouse, so
                    // they follow it; a dispatch's rows are what the order
                    // still needs, wherever it comes from.
                    if (getValues("direction") === "INWARD") {
                      replace(suggestedLines("INWARD", event.target.value));
                    }
                  },
                })}
                disabled={disabled}
              >
                <option value="">Choose a warehouse</option>
                {warehouses.data.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                {...props}
                {...register("warehouseId")}
                disabled={disabled || warehouses.isPending}
                placeholder="00000000-0000-0000-0000-000000000000"
              />
            )
          }
        </Field>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium">Lines</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => append({ productId: "", variantId: "", quantity: "1" })}
          >
            <Plus />
            Add line
          </Button>
        </div>

        {fields.length > 0 ? (
          <div className="hidden gap-2 text-xs text-muted-foreground sm:flex">
            <span className="flex-1">Product</span>
            <span className="w-40">Variant</span>
            <span className="w-20 text-right">Quantity</span>
            <span className="w-20 text-right">
              {direction === "OUTWARD" ? "On shelf" : "Still out"}
            </span>
            <span className="w-9" />
          </div>
        ) : direction === "INWARD" ? (
          <p className="text-sm text-muted-foreground">
            Nothing on this order is out from the chosen warehouse.
          </p>
        ) : null}

        {fields.map((field, index) => {
          const rowErrors = errors.lines?.[index];
          const line = lines?.[index];
          const product = line?.productId ? productById.get(line.productId) : undefined;
          const count = available(line);

          return (
            <div key={field.id} className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
              <div className="min-w-0 flex-1">
                <Select
                  {...register(`lines.${index}.productId`, {
                    // A variant belongs to one product, so it cannot carry over.
                    onChange: () => setValue(`lines.${index}.variantId`, ""),
                  })}
                  aria-label={`Product for line ${index + 1}`}
                  aria-invalid={Boolean(rowErrors?.productId)}
                  disabled={disabled}
                >
                  <option value="">Choose a product</option>
                  {orderProducts.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </Select>
                {rowErrors?.productId ? (
                  <p className="mt-1 text-xs text-destructive">{rowErrors.productId.message}</p>
                ) : null}
              </div>

              <div className="w-40 shrink-0">
                <Select
                  {...register(`lines.${index}.variantId`)}
                  aria-label={`Variant for line ${index + 1}`}
                  aria-invalid={Boolean(rowErrors?.variantId)}
                  disabled={disabled || !product?.hasVariants}
                >
                  <option value="">{product?.hasVariants ? "Choose a variant" : "—"}</option>
                  {(product?.hasVariants ? product.variants : []).map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.name}
                    </option>
                  ))}
                </Select>
                {rowErrors?.variantId ? (
                  <p className="mt-1 text-xs text-destructive">{rowErrors.variantId.message}</p>
                ) : null}
              </div>

              <div className="w-20 shrink-0">
                <Input
                  {...register(`lines.${index}.quantity`)}
                  aria-label={`Quantity for line ${index + 1}`}
                  aria-invalid={Boolean(rowErrors?.quantity)}
                  inputMode="numeric"
                  disabled={disabled}
                  className="tabular text-right"
                />
                {rowErrors?.quantity ? (
                  <p className="mt-1 text-xs text-destructive">{rowErrors.quantity.message}</p>
                ) : null}
              </div>

              <p
                className={`tabular flex h-9 w-20 shrink-0 items-center justify-end text-sm ${
                  count !== null && Number(line?.quantity) > count
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
                aria-label={`Available for line ${index + 1}`}
              >
                {count ?? "—"}
              </p>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                // A movement with no lines is refused by the backend, so the
                // form never offers the state that would only come back as a
                // 422.
                disabled={fields.length === 1 || disabled}
                onClick={() => remove(index)}
                aria-label={`Remove line ${index + 1}`}
                title={fields.length === 1 ? "A movement needs at least one line" : "Remove"}
              >
                <Trash2 />
              </Button>
            </div>
          );
        })}

        {linesError ? <p className="text-xs text-destructive">{linesError}</p> : null}
      </div>

      <Field label="Remarks" error={errors.remarks?.message}>
        {(props) => (
          <Textarea
            {...props}
            {...register("remarks")}
            disabled={disabled}
            placeholder="Loaded 06:30, two trips"
          />
        )}
      </Field>
    </form>
  );
}
