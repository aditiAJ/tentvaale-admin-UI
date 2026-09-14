import { useId } from "react";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  /** Rendered under the control, and replaced by `error` when one is present. */
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  /** Receives the wiring every control needs to be announced correctly. */
  children: (props: {
    id: string;
    "aria-invalid": boolean;
    "aria-describedby": string | undefined;
  }) => React.ReactNode;
}

/**
 * One labelled form control. The describedby/invalid wiring is done here rather
 * than at each call site because it is the part that is easiest to forget and
 * the part a screen-reader user actually depends on.
 */
export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-xs font-medium">
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </label>
      {children({
        id,
        "aria-invalid": Boolean(error),
        "aria-describedby": message ? messageId : undefined,
      })}
      {message ? (
        <p
          id={messageId}
          className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
