"use client";

import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createWarehouse, masterDataKeys, updateWarehouse } from "@/features/master-data/api";
import type { WarehouseLocationRequest, WarehouseView } from "@/features/master-data/types";
import { ApiError } from "@/services/api-client";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { ActiveToggle } from "@/features/master-data/components/ActiveToggle";
import { PlaceSearch } from "@/components/ui/place-search";
import { StateSelect, initialState } from "@/components/ui/state-select";
import { MAPS_KEY, cityOf, detailsOf, type Place } from "@/lib/maps";
import { matchState } from "@/lib/indian-states";

const FORM_ID = "warehouse-form";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150, "Maximum 150 characters"),
  // Required, like the two beside it: every field a warehouse carries is, and a
  // depot with no address is one a truck cannot be sent to. `.trim()` runs before
  // `.min(1)` so a field holding only spaces is refused exactly like an empty one
  // rather than being stored as whitespace.
  address: z.string().trim().min(1, "Address is required").max(250, "Maximum 250 characters"),
  city: z.string().trim().min(1, "City is required").max(100, "Maximum 100 characters"),
  // Optional. Only ever set from the list (or by a map pick), so it is a canonical name or empty; an old saved value
  // nobody can read is shown with a note and left alone unless it is changed or cleared.
  state: z.string().trim(),
  // Optional: left blank, a new warehouse gets the next WHnnn and an edit keeps its code.
  code: z
    .string()
    .trim()
    .max(10, "Maximum 10 characters")
    .regex(/^[A-Za-z0-9]*$/, "Letters and digits only, no spaces or dashes"),
  contactPerson: z.string().trim().max(150, "Maximum 150 characters"),
  contactNumber: z.string().trim().max(30, "Maximum 30 characters"),
  description: z.string().trim().max(500, "Maximum 500 characters"),
  active: z.boolean(),
});

type FormValues = z.output<typeof schema>;

/**
 * One dialog for both adding and editing, keyed on whether `existing` is given.
 *
 * Two dialogs would be two copies of the same four lines of validation, and the
 * pair would drift the first time a field was added to one of them. It is
 * mounted only while open, so opening it is what loads the record's values —
 * the same reason ProductDialog is mounted on demand.
 */
export function WarehouseDialog({
  existing,
  onClose,
}: {
  existing?: WarehouseView;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  // Every location code starts with the warehouse code, so the server fixes it once a layout exists.
  const codeLocked = Boolean(existing && (existing.locationCount ?? 0) > 0);

  // What Google resolved for the picked place; saved with the warehouse, never shown.
  const pickedRef = useRef<WarehouseLocationRequest | undefined>(undefined);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, dirtyFields },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: existing?.name ?? "",
      address: existing?.address ?? "",
      city: existing?.city ?? "",
      state: initialState(existing?.location?.state),
      code: existing?.code ?? "",
      contactPerson: existing?.contactPerson ?? "",
      contactNumber: existing?.contactNumber ?? "",
      description: existing?.description ?? "",
      active: existing?.active ?? true,
    },
  });

  // A picked place fills the address and city; the rest of what Google knew is saved with the warehouse.
  function fillFrom(place: Place) {
    const address = place.formattedAddress ?? place.displayName;
    if (!address) return;
    pickedRef.current = detailsOf(place);
    setValue("address", address.slice(0, 250), { shouldValidate: true, shouldDirty: true });
    // Google's name for the state, in the list's spelling; one that is not a state of India leaves the selector empty to be chosen.
    setValue("state", matchState(pickedRef.current.state)?.name ?? "", { shouldValidate: true, shouldDirty: true });
    const city = cityOf(place);
    if (city) setValue("city", city.slice(0, 100), { shouldValidate: true, shouldDirty: true });
  }

  const mutation = useMutation({
    mutationFn: ({ values, stateChanged }: { values: FormValues; stateChanged: boolean }) => {
      const { state, ...fields } = values;
      // A disabled code input still sits in the form values; do not send an unchanged, locked one.
      const request = { ...fields, code: codeLocked || !values.code ? undefined : values.code };
      // A location is sent only when something about it changed (a picked place, or the state), and it replaces the
      // stored one whole: so it starts from the picked place, else the stored one, with the state as chosen.
      const location: WarehouseLocationRequest | undefined =
        pickedRef.current || stateChanged || (!existing && state)
          ? { ...(pickedRef.current ?? existing?.location), state: state || undefined }
          : undefined;
      return existing ? updateWarehouse(existing.id, { ...request, location }) : createWarehouse({ ...request, location });
    },
    onSuccess: (warehouse) => {
      queryClient.invalidateQueries({ queryKey: masterDataKeys.warehouses });
      toast.success(existing ? `${warehouse.name} updated` : `${warehouse.name} added`, {
        description: warehouse.city,
      });
      onClose();
    },
    onError: (error) =>
      setFormError(error instanceof ApiError ? error.message : "Could not save the warehouse."),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={existing ? "Edit warehouse" : "New warehouse"}
      description="Where stock is held between events."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button form={FORM_ID} type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            {existing ? "Save changes" : "Create warehouse"}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        className="space-y-4"
        noValidate
        onSubmit={handleSubmit((values) => {
          setFormError(null);
          mutation.mutate({ values, stateChanged: Boolean(dirtyFields.state) });
        })}
      >
        {formError ? <Alert tone="error" title={formError} /> : null}

        {MAPS_KEY ? (
          <Field label="Find it on Google Maps" hint="Pick a result to fill the address and city, or type them below.">
            {(props) => <PlaceSearch id={props.id} onPick={fillFrom} />}
          </Field>
        ) : null}

        <Field label="Name" required error={errors.name?.message}>
          {(props) => (
            <Input {...props} {...register("name")} placeholder="Andheri Main Store" autoFocus />
          )}
        </Field>

        {/* A Textarea rather than an Input because a street address here runs to
            a unit, a road and a landmark, and a single line would hide the end
            of it behind the caret. Same primitive the product description and
            movement remarks already use. */}
        <Field label="Address" required error={errors.address?.message}>
          {(props) => (
            <Textarea
              {...props}
              {...register("address")}
              placeholder={"Unit 4, Sundar Industrial Estate\nAndheri Kurla Road, near Marol Naka"}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City" required error={errors.city?.message}>
            {(props) => <Input {...props} {...register("city")} placeholder="Mumbai" />}
          </Field>
          <Field label="State" error={errors.state?.message}>
            {(props) => (
              <Controller
                control={control}
                name="state"
                render={({ field }) => (
                  <StateSelect id={props.id} aria-invalid={props["aria-invalid"]} value={field.value} onChange={field.onChange} clearable />
                )}
              />
            )}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Code"
            error={errors.code?.message}
            hint={
              codeLocked
                ? "Fixed once the warehouse has storage locations."
                : existing
                  ? "Starts every storage location code in this warehouse."
                  : "Leave blank to use the next one (WH001, WH002 …)."
            }
          >
            {(props) => (
              <Input
                {...props}
                {...register("code")}
                placeholder="WH001"
                disabled={codeLocked}
                className="uppercase"
              />
            )}
          </Field>
          <Field label="Contact person" error={errors.contactPerson?.message}>
            {(props) => <Input {...props} {...register("contactPerson")} />}
          </Field>
        </div>
        <Field label="Contact number" error={errors.contactNumber?.message}>
          {(props) => <Input {...props} {...register("contactNumber")} inputMode="tel" />}
        </Field>
        <Field label="Description" error={errors.description?.message}>
          {(props) => <Textarea {...props} {...register("description")} />}
        </Field>

        {existing ? (
          <ActiveToggle
            {...register("active")}
            label="Active"
            hint="An inactive warehouse keeps its stock but takes no new stock."
          />
        ) : null}
      </form>
    </Dialog>
  );
}
