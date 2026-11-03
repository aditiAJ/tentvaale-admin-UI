import { LOGO_DATA_URI, LOGO_MASK } from "@/lib/logo-data";
import { cn } from "@/lib/utils";

/**
 * The page-level loading state: the Tentvaale tent breathes, a band of warm light sweeps across it (clipped to the logo's
 * own shape, so it glints on the tent and the armchair and nowhere else), and a soft glow pulses behind. The motion is
 * plain CSS (see `.logo-loader` in globals.css) and stops for people who ask for less motion, leaving the still logo.
 */
export function LogoLoader({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cn("logo-loader flex min-h-dvh flex-col items-center justify-center gap-5", className)}>
      <div className="logo-loader-mark relative size-28">
        <span aria-hidden="true" className="logo-loader-glow absolute -inset-6 rounded-full" />
        {/* eslint-disable-next-line @next/next/no-img-element -- the mark, inlined so it is whole from the first paint */}
        <img src={LOGO_DATA_URI} alt="" className="relative size-full object-contain" />
        <span aria-hidden="true" className="logo-loader-sheen absolute inset-0" style={LOGO_MASK} />
      </div>
      <span aria-hidden="true" className="logo-loader-bar" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
