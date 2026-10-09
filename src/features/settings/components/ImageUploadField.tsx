"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { uploadMedia } from "@/features/master-data/api/backend";
import { ApiError } from "@/services/api-client";
import { Button } from "@/components/ui/button";

/** One picture (a logo, a signature): choose a file, see it, replace or remove it. The value is the stored address. */
export function ImageUploadField({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const [result] = await uploadMedia([file]);
      if (!result?.ok || !result.url) setError(result?.error ?? "That picture could not be uploaded.");
      else onChange(result.url);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That picture could not be uploaded.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium">{label}</p>
      <div className="flex h-24 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/30">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={label} className="max-h-full max-w-full object-contain" />
        ) : (
          <ImagePlus className="size-6 text-muted-foreground" />
        )}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" disabled={disabled || busy} onClick={() => input.current?.click()}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          {value ? "Replace" : "Upload"}
        </Button>
        {value && !disabled ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")}>
            <X /> Remove
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{error ?? hint}</p>
    </div>
  );
}
