"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useCan } from "@/features/auth";
import { getHero, settingsKeys, updateHero, type SiteHero } from "@/features/settings/api";
import { HERO_GUIDE, prepareHeroImage } from "@/features/settings/heroImage";
import { uploadMedia } from "@/features/master-data/api/backend";
import { ApiError } from "@/services/api-client";
import { IS_MOCK } from "@/services/data-source";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * The picture across the top of the storefront's landing page: one for the light theme, and an optional one for dark
 * mode. Shows the sizes to use and how the picture will be cropped on a desktop and on a phone, before it is saved.
 */
export function HeroImagePanel() {
  const hero = useQuery({ queryKey: settingsKeys.hero, queryFn: ({ signal }) => getHero(signal), enabled: !IS_MOCK });

  if (IS_MOCK) return <Alert tone="info" title="The landing page picture needs the backend." />;
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">Landing page picture</h2>
        <p className="text-sm text-muted-foreground">The big picture at the top of the storefront&apos;s home page. Leave it empty to keep the standard one.</p>
      </div>
      {hero.isPending ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {hero.isError ? <Alert tone="error" title="Could not load the landing page picture." /> : null}
      {hero.data ? <HeroEditor key={`${hero.data.light}|${hero.data.dark}`} saved={hero.data} /> : null}
    </section>
  );
}

function HeroEditor({ saved }: { saved: SiteHero }) {
  const canWrite = useCan("MASTER_DATA_WRITE");
  const queryClient = useQueryClient();
  const [light, setLight] = useState(saved.light ?? "");
  const [dark, setDark] = useState(saved.dark ?? "");
  const dirty = light !== (saved.light ?? "") || dark !== (saved.dark ?? "");

  const save = useMutation({
    mutationFn: () => updateHero({ light, dark }),
    onSuccess: (next) => {
      queryClient.setQueryData(settingsKeys.hero, next);
      toast.success("Landing page picture saved");
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not save the picture."),
  });

  return (
    <Card className="space-y-5 p-5">
      <div className="rounded-lg bg-muted/50 px-4 py-3 text-xs leading-5 text-muted-foreground">
        <p className="mb-1 text-sm font-medium text-foreground">What to upload</p>
        <ul className="list-disc space-y-0.5 pl-4">
          <li>
            <span className="font-medium text-foreground">
              {HERO_GUIDE.recommended.width} × {HERO_GUIDE.recommended.height} px
            </span>{" "}
            (a wide 12:5 picture). At least {HERO_GUIDE.softBelowWidth} px wide; under {HERO_GUIDE.minWidth} px is refused.
          </li>
          <li>JPEG, PNG or WebP, up to 10 MB. It is made smaller automatically (about 1 MB) so the page opens fast.</li>
          <li>Put what matters in the middle. A phone shows only the centre strip, and a desktop trims the top and bottom a little.</li>
          <li>The lower part is darkened for the headline and buttons, so keep that area simple and leave text out of the picture.</li>
        </ul>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <HeroSlot label="Light mode" hint="The standard picture, shown to everyone unless a dark mode picture is set." value={light} onChange={setLight} disabled={!canWrite} />
        <HeroSlot
          label="Dark mode (optional)"
          hint="Shown to visitors using dark mode, for example a night-time or darker version of the same scene. Without it the light picture is used."
          value={dark}
          onChange={setDark}
          disabled={!canWrite}
        />
      </div>

      {canWrite ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="animate-spin" /> : null} Save picture
          </Button>
          {dirty ? (
            <Button variant="ghost" disabled={save.isPending} onClick={() => (setLight(saved.light ?? ""), setDark(saved.dark ?? ""))}>
              Undo changes
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

/** One picture: a desktop-shaped preview and a phone-shaped one, both cropped the way the storefront crops. */
function HeroSlot({
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
  disabled: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setWarning(null);
    try {
      const prepared = await prepareHeroImage(file);
      const [result] = await uploadMedia([prepared.file]);
      if (!result?.ok || !result.url) throw new Error(result?.error ?? "That picture could not be uploaded.");
      setWarning(prepared.warning);
      onChange(result.url);
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : "That picture could not be uploaded.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  // The storefront darkens the lower two thirds so the headline reads; the preview shows the same.
  const shade = <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/85 via-black/40 to-transparent" />;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="grid grid-cols-[1fr_6.5rem] items-end gap-3">
        <div>
          <div className="relative aspect-[12/5] overflow-hidden rounded-lg border border-dashed border-border bg-muted/30">
            {value ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={value}
                alt={`${label} on a desktop`}
                className="size-full object-cover"
                onLoad={(e) => setSize(`${e.currentTarget.naturalWidth} × ${e.currentTarget.naturalHeight} px`)}
              />
            ) : (
              <div className="flex size-full items-center justify-center">
                <ImagePlus className="size-7 text-muted-foreground" />
              </div>
            )}
            {value ? shade : null}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Desktop{size && value ? ` · uploaded ${size}` : ""}</p>
        </div>
        <div>
          <div className="relative aspect-[9/10] overflow-hidden rounded-lg border border-dashed border-border bg-muted/30">
            {value ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value} alt={`${label} on a phone`} className="size-full object-cover" />
            ) : null}
            {value ? shade : null}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Phone</p>
        </div>
      </div>

      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
      {!disabled ? (
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            {value ? "Replace" : "Upload"}
          </Button>
          {value ? (
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => (onChange(""), setSize(null), setWarning(null))}>
              <X /> Remove
            </Button>
          ) : null}
        </div>
      ) : null}
      <p className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{error ?? hint}</p>
      {warning ? <p className="text-xs text-[var(--warning)]">{warning}</p> : null}
    </div>
  );
}
