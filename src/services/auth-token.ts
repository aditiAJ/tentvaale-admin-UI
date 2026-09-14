// JWT storage for the back-office admin identity. Entirely separate from the
// storefront customer token: the backend signs the two with different keys and
// different issuers (JwtTokenService), and an admin token is the only thing
// that satisfies the PRINCIPAL_ADMIN authority on /api/admin/**.
//
// Lives in services/ rather than features/auth/ because api-client.ts needs it
// to attach the Authorization header, and services must not depend on features.
//
// Exposed as a subscribable store rather than as plain get/set helpers, so the
// session can be read with useSyncExternalStore. localStorage is genuinely an
// external store: it changes from other tabs and from api-client's 401 handler,
// neither of which React can see. Mirroring it into component state instead
// would mean an effect that writes state on mount, which is both a cascading
// render and a source of drift.

const TOKEN_KEY = "tentvaale.admin.token";

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
  notify();
}

export function clearAuthToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  notify();
}

/**
 * Subscribes to token changes, including those made in another tab.
 *
 * Signing out in one tab should not leave a second tab showing a back office it
 * can no longer talk to, and the native `storage` event is the only way to hear
 * about that — it fires in every tab except the one that made the change, which
 * is why local mutations notify explicitly above.
 */
export function subscribeToAuthToken(listener: () => void): () => void {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key === TOKEN_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Server snapshot: there is no localStorage during SSR, so nobody is signed in. */
export function getServerAuthToken(): null {
  return null;
}
