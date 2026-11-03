"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { LOGO_DATA_URI, LOGO_MASK } from "@/lib/logo-data";

/**
 * A picture that shows the Tentvaale logo, breathing, in its box until it has downloaded, then fades in whole instead of
 * being drawn from the top down. Used wherever a catalogue picture is shown. Drop-in for `<img>`: same props.
 *
 * It is a fragment, so the parent decides the box: the parent must be `relative` (the placeholder fills it) and clip with
 * `overflow-hidden`. A failed picture keeps the placeholder off; the caller's `onError` swaps in its own fallback.
 */
export function FadeImg({ className, onLoad, src, alt = "", ...props }: React.ComponentProps<"img">) {
  // The address that finished loading, so a new address (a carousel turning over) shows the placeholder again.
  const [loadedSrc, setLoadedSrc] = useState<unknown>(null);
  const loaded = loadedSrc === src;
  return (
    <>
      {loaded ? null : (
        // The tent logo breathes in the box with a band of light across it, so the wait looks like Tentvaale and the
        // half-downloaded picture (which would paint from the top down) is never shown.
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="logo-loader-mark relative block aspect-[480/377] w-[38%] max-w-16">
            {/* eslint-disable-next-line @next/next/no-img-element -- the mark, inlined */}
            <img src={LOGO_DATA_URI} alt="" className="size-full object-contain opacity-40" />
            <span className="logo-loader-sheen absolute inset-0" style={LOGO_MASK} />
          </span>
        </span>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- a storage address, which next/image has nothing to optimise */}
      <img
        {...props}
        src={src}
        alt={alt}
        // A picture already in the browser's cache can be complete before React attaches onLoad.
        ref={(element) => {
          if (element?.complete && element.naturalWidth > 0) setLoadedSrc(src);
        }}
        onLoad={(event) => {
          // Decoded before it is shown, so it appears whole rather than being painted in as it is processed.
          const image = event.currentTarget;
          void (image.decode ? image.decode().catch(() => undefined) : Promise.resolve()).then(() => setLoadedSrc(src));
          onLoad?.(event);
        }}
        className={cn(className, "transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0")}
      />
    </>
  );
}
