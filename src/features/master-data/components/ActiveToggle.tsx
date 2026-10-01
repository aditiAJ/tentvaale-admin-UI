import { forwardRef } from "react";

/**
 * "Active" tick box for the edit dialogs of records that are switched off rather than deleted.
 * Spread react-hook-form's `register(...)` onto it.
 */
export const ActiveToggle = forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input"> & { label: string; hint?: string }
>(function ActiveToggle({ label, hint, ...props }, ref) {
  return (
    <label className="flex items-start gap-2.5 text-sm">
      <input ref={ref} type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" {...props} />
      <span>
        <span className="font-medium">{label}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
});
