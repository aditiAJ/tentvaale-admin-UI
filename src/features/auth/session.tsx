"use client";

import { createContext, use, useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  clearAuthToken,
  getAuthToken,
  getServerAuthToken,
  setAuthToken,
  subscribeToAuthToken,
} from "@/services/auth-token";
import { UNAUTHORIZED_EVENT } from "@/services/api-client";
import { readSession, type AdminSession } from "@/services/jwt";
import type { Permission } from "@/services/permissions";

interface SessionContextValue {
  session: AdminSession | null;
  /** False until the browser has hydrated and the stored token is readable.
   *  Without it every guarded page would flash its redirect on first paint,
   *  because the server render can never see localStorage. */
  loading: boolean;
  signIn: (token: string) => void;
  signOut: () => void;
  can: (permission: Permission) => boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

// A subscription that never fires: the answer to "has this hydrated?" changes
// exactly once, when React swaps the server snapshot for the client one.
const neverChanges = () => () => {};
const onClient = () => true;
const onServer = () => false;

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const hydrated = useSyncExternalStore(neverChanges, onClient, onServer);
  const token = useSyncExternalStore(subscribeToAuthToken, getAuthToken, getServerAuthToken);

  // readSession rejects anything unusable: malformed, expired, or a storefront
  // token that carries no PRINCIPAL_ADMIN authority.
  const session = useMemo(() => readSession(token), [token]);

  // A token that exists but does not parse into a session is dead weight —
  // usually one that expired while the tab was closed. Dropping it keeps it off
  // the next request, which would only be answered with a 401 anyway. This
  // writes to the token store rather than to component state, so it does not
  // cascade a render the way a setState here would.
  useEffect(() => {
    if (token && !session) clearAuthToken();
  }, [token, session]);

  const signIn = useCallback((newToken: string) => setAuthToken(newToken), []);

  const signOut = useCallback(() => {
    clearAuthToken();
    router.replace("/login");
  }, [router]);

  // A 401 from any request means the token died mid-session (it expired, or the
  // account was deactivated). api-client has already cleared it, which updates
  // the store and empties the session on its own; this only handles the part
  // services/ cannot do, which is navigate.
  useEffect(() => {
    const onUnauthorized = () => router.replace("/login");
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [router]);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      loading: !hydrated,
      signIn,
      signOut,
      can: (permission) => session?.permissions.includes(permission) ?? false,
    }),
    [session, hydrated, signIn, signOut],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionContextValue {
  const context = use(SessionContext);
  if (!context) {
    throw new Error("useSession must be used inside <SessionProvider>");
  }
  return context;
}

/** Convenience for the common case of gating one control. */
export function useCan(permission: Permission): boolean {
  return useSession().can(permission);
}
