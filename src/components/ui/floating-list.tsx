"use client";

import { useLayoutEffect, useState, type HTMLAttributes, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/** Space kept between a list and the edge of the window. */
const EDGE = 8;
/** Space between the box and its list. */
const GAP = 4;
/** Room below the box under which the list opens upwards instead, if there is more room above. */
const FLIP_BELOW = 200;
/** A list is never squeezed shorter than this, even when neither side has the room. */
const MIN_HEIGHT = 120;

export interface FloatingPlace {
  left: number;
  width: number;
  /** Set when the list opens downwards. */
  top?: number;
  /** Set when the list opens upwards: the distance from the bottom of the window. */
  bottom?: number;
  maxHeight: number;
}

/**
 * Where to draw a list under (or, when the window is short of room below, over) the box it belongs to.
 *
 * It is measured against the window, not the box's parent, and followed while the page, a dialog or a table scrolls
 * and while the window is resized. The list is as wide as the box (and at least `minWidth` when the box is narrow),
 * kept inside the window sideways, and no taller than the room on the side it opened on, up to `maxHeight`.
 * Null while closed.
 */
export function useAnchoredPosition(
  anchor: RefObject<HTMLElement | null>,
  open: boolean,
  { minWidth = 0, maxHeight = 288 }: { minWidth?: number; maxHeight?: number } = {},
): FloatingPlace | null {
  const [place, setPlace] = useState<FloatingPlace | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(Math.max(rect.width, minWidth), window.innerWidth - EDGE * 2);
      const left = Math.max(EDGE, Math.min(rect.left, window.innerWidth - width - EDGE));
      const below = window.innerHeight - rect.bottom - EDGE - GAP;
      const above = rect.top - EDGE - GAP;
      const flip = below < FLIP_BELOW && above > below;
      const next: FloatingPlace = {
        left,
        width,
        maxHeight: Math.max(Math.min(flip ? above : below, maxHeight), MIN_HEIGHT),
        ...(flip ? { bottom: window.innerHeight - rect.top + GAP } : { top: rect.bottom + GAP }),
      };
      // Scrolling inside the list itself also lands here; nothing moved, so nothing is redrawn.
      setPlace((current) =>
        current &&
        current.left === next.left &&
        current.width === next.width &&
        current.top === next.top &&
        current.bottom === next.bottom &&
        current.maxHeight === next.maxHeight
          ? current
          : next,
      );
    };
    measure();
    window.addEventListener("resize", measure);
    // Capturing, so a scroll in any container the box sits in is heard, not only the page's.
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [anchor, open, minWidth, maxHeight]);

  return open ? place : null;
}

/**
 * The frame of a dropdown list: fixed to the window and drawn on the page body, so no table, dialog or scroll area
 * around the box can cut it off, and above them all. It limits its own height to `place.maxHeight`; put the long part
 * of the list in a child with `min-h-0 overflow-y-auto` so it scrolls while anything beside it (a footer row) stays.
 *
 * Pressing inside it never takes focus from the box, so the box's blur does not close the list before a pick lands
 * (this also covers grabbing the list's scrollbar).
 */
export function FloatingList({
  place,
  className,
  children,
  ...props
}: { place: FloatingPlace } & Omit<HTMLAttributes<HTMLDivElement>, "style">) {
  return createPortal(
    <div
      {...props}
      onMouseDown={(event) => {
        event.preventDefault();
        props.onMouseDown?.(event);
      }}
      style={{ position: "fixed", left: place.left, width: place.width, top: place.top, bottom: place.bottom, maxHeight: place.maxHeight }}
      // The one layer for dropdown lists: above dialogs (z-50), whichever of them the box is in.
      className={cn("z-70 flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg", className)}
    >
      {children}
    </div>,
    document.body,
  );
}
