// Kept identical in the Admin and Storefront UIs (src/lib/navigation.ts); `npm test` checks the two copies match.
// Plain TypeScript with no imports, so Node's test runner can load it as it is.

/**
 * `value` when it is a path on this site, otherwise null. Used for every place a link or redirect target comes from
 * outside the code (a `?next=` in the address, a fallback passed in): following anything else would be an open
 * redirect.
 *
 * Refused: absolute URLs, protocol-relative `//host`, `/\host` (browsers read `\` as `/`), and any space or control
 * character, because browsers silently drop tabs and newlines inside a URL (`/<tab>/host` becomes `//host`) and trim
 * spaces at its ends.
 */
export function safeInternalPath(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  if (value[0] !== "/" || value[1] === "/" || value[1] === "\\") return null;
  if (/[\u0000- \u007f]/.test(value)) return null;
  // Belt and braces: resolved against a placeholder origin, a path must stay on it.
  try {
    const base = "http://same-origin.invalid";
    if (new URL(value, base).origin !== base) return null;
  } catch {
    return null;
  }
  return value;
}

/** The parts of the browser's Navigation API this module reads. Absent in browsers that do not have the API. */
export interface NavigationLike {
  currentEntry?: { index: number } | null;
}

/**
 * Whether the page before this one in the tab is one of ours, so that going back stays inside the app.
 *
 * The Navigation API only lists same-origin entries that follow one another, so an index above 0 means the previous
 * entry is ours. A visit that arrived from another site, a new tab, or a shared link sits at index 0. Without the API
 * the answer is "no", and the caller uses its fallback link: it never guesses from `history.length`, which also counts
 * other sites' pages.
 */
export function canGoBackInApp(navigation: NavigationLike | null | undefined): boolean {
  const index = navigation?.currentEntry?.index;
  return typeof index === "number" && index > 0;
}

/** What a click handler needs to know about the click. Matches React's and the DOM's mouse events. */
export interface ClickLike {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
}

/** A plain left click, with no key that asks the browser to open the link in a new tab or window, or to download it. */
export function isPlainClick(event: ClickLike): boolean {
  return (
    event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && !event.defaultPrevented
  );
}
