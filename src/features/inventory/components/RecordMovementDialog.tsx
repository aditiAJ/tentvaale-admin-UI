"use client";

import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { inventoryKeys, recordStockMovement } from "@/features/inventory/api";
import { MOVEMENT_DIRECTIONS, DIRECTION_MEANING } from "@/features/inventory/types";
import type { RecordStockMovementRequest } from "@/features/inventory/types";
import { getOrder, orderKeys } from "@/features/orders/api";
import type { OrderView } from "@/features/orders/types";
import {
  listProducts,
  listWarehouses,
  masterDataKeys,
} from "@/features/master-data/api";
import { ApiError } from "@/services/api-client";
import { positiveIntegerField, UUID_PATTERN } from "@/lib/forms";
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
  warehouseId: z
    .string()
    .trim()
    .refine((value) => value === "" || UUID_PATTERN.test(value), "Must be a valid UUID")
    .transform((value) => (value === "" ? undefined : value)),
  remarks: z
    .string()
    .trim()
    .max(2000, "Maximum 2000 characters")
    .transform((value) => (value === "" ? undefined : value)),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1, "Choose a product"),
        quantity: positiveIntegerField("Quantity"),
      }),
    )
    .min(1, "A movement needs at least one line"),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Records a dispatch or a return against one order.
 *
 * The order is fetched first and its lines become the starting rows, because
 * the overwhelmingly common movement is "all of it went out" or "all of it came
 * back" and retyping an order is how quantities get mistyped. That is a
 * convenience and nothing more: the backend does not check a movement against
 * its order, so the rows stay fully editable and a product the order never
 * contained can still be added.
 */
export function RecordMovementDialog({
  orderId,
  onClose,
}: {
  orderId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const order = useQuery({
    queryKey: orderKeys.byId(orderId),
    queryFn: ({ signal }) => getOrder(orderId, signal),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: recordStockMovement,
    onSuccess: (movement) => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.movementsByOrder(orderId) });
      // Availability is derived from movements, so it is stale the moment one
      // is recorded.
      queryClient.invalidateQueries({ queryKey: inventoryKeys.availability });
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

  const orderFailed =
    order.isError &&
    (order.error instanceof ApiError && order.error.status === 404
      ? "No order with that id."
      : order.error instanceof Error
        ? order.error.message
        : "The order could not be loaded.");

  return (
    <Dialog
      open
      onClose={onClose}
      title="Record movement"
      description="One dispatch or return, against this whole order."
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            form={FORM_ID}
            type="submit"
            disabled={!order.data || mutation.isPending}
          >
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            Record movement
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {formError ? <Alert tone="error" title={formError} /> : null}
        {orderFailed ? <Alert tone="error" title={orderFailed} /> : null}

        {order.isPending ? <Skeleton className="h-64" /> : null}

        {order.data ? (
          <MovementFields
            order={order.data}
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
 * Split out so the form's defaults can be computed from the order, which is not
 * known on the first render. Mounting it only once the order has arrived means
 * useForm sees the right defaults immediately, instead of an effect resetting
 * the form underneath whatever the user had already started typing.
 */
function MovementFields({
  order,
  disabled,
  onSubmit,
}: {
  order: OrderView;
  disabled: boolean;
  onSubmit: (values: RecordStockMovementRequest) => void;
}) {
  const products = useQuery({
    queryKey: masterDataKeys.products,
    queryFn: ({ signal }) => listProducts(signal),
  });

  // Warehouses are mock-only — there is no entity, table or endpoint behind
  // them — so this is allowed to fail and the field falls back to the opaque
  // UUID the backend actually stores. No retry, because a missing endpoint
  // will not start existing on the second attempt.
  const warehouses = useQuery({
    queryKey: masterDataKeys.warehouses,
    queryFn: ({ signal }) => listWarehouses(signal),
    retry: false,
  });

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      direction: "OUTWARD",
      movedOn: today(),
      warehouseId: "",
      remarks: "",
      lines: order.lines.map((line) => ({
        productId: line.productId,
        quantity: String(line.quantity),
      })),
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  const linesError = errors.lines?.root?.message ?? errors.lines?.message;

  return (
    <form
      id={FORM_ID}
      className="space-y-4"
      noValidate
      onSubmit={handleSubmit((values) =>
        onSubmit({
          orderId: order.id,
          direction: values.direction,
          movedOn: values.movedOn,
          warehouseId: values.warehouseId,
          remarks: values.remarks,
          lines: values.lines,
        }),
      )}
    >
      <p className="text-sm">
        <span className="text-muted-foreground">Order </span>
        <strong>{order.orderNumber}</strong>
        <span className="text-muted-foreground"> — {order.customerName}</span>
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Direction" required error={errors.direction?.message}>
          {(props) => (
            <Select {...props} {...register("direction")} disabled={disabled}>
              {MOVEMENT_DIRECTIONS.map((direction) => (
                <option key={direction} value={direction} title={DIRECTION_MEANING[direction]}>
                  {direction === "OUTWARD" ? "Outward — dispatch" : "Inward — return"}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Moved on" error={errors.movedOn?.message}>
          {(props) => <Input {...props} {...register("movedOn")} type="date" disabled={disabled} />}
        </Field>

        <Field
          label="Warehouse"
          error={errors.warehouseId?.message}
          hint={warehouses.data?.length ? undefined : "Optional. Stored as an opaque id."}
        >
          {(props) =>
            warehouses.data?.length ? (
              <Select {...props} {...register("warehouseId")} disabled={disabled}>
                <option value="">Not recorded</option>
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
                disabled={disabled}
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
            onClick={() => append({ productId: "", quantity: "1" })}
          >
            <Plus />
            Add line
          </Button>
        </div>

        {fields.map((field, index) => {
          const rowErrors = errors.lines?.[index];

          return (
            <div key={field.id} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <Select
                  {...register(`lines.${index}.productId`)}
                  aria-label={`Product for line ${index + 1}`}
                  aria-invalid={Boolean(rowErrors?.productId)}
                  disabled={products.isPending || disabled}
                >
                  <option value="">
                    {products.isPending ? "Loading catalogue" : "Choose a product"}
                  </option>
                  {(products.data ?? []).map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                  {/* An order can contain a product that has since been
                      deactivated, and the catalogue list returns active
                      products only. Keeping the current value as an option
                      stops the select silently resetting a prefilled line to
                      "Choose a product". */}
                  {(products.data ?? []).some((product) => product.id === field.productId)
                    ? null
                    : order.lines
                        .filter((line) => line.productId === field.productId)
                        .map((line) => (
                          <option key={line.productId} value={line.productId}>
                            {line.productName}
                          </option>
                        ))}
                </Select>
                {rowErrors?.productId ? (
                  <p className="mt-1 text-xs text-destructive">{rowErrors.productId.message}</p>
                ) : null}
              </div>

              <div className="w-24 shrink-0">
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
