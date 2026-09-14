import { PRINCIPAL_ADMIN, type Permission, type Role } from "@/services/permissions";

/**
 * Claims issued by JwtTokenService#issueAdminToken. Short names are the
 * backend's own: `cid` company id, `name` display name, `auth` the resolved
 * authority list (PRINCIPAL_ADMIN plus one entry per granted Permission).
 */
export interface AdminClaims {
  sub: string;
  cid: string;
  name: string;
  role: Role;
  auth: string[];
  exp: number;
  iat: number;
  iss: string;
}

export interface AdminSession {
  userId: string;
  companyId: string;
  username: string;
  role: Role;
  permissions: Permission[];
  expiresAt: Date;
}

/**
 * Reads the payload of a JWT WITHOUT verifying its signature.
 *
 * That is safe for what it is used for and only for that: deciding which nav
 * items to render and which buttons to disable. It is not an authorisation
 * check. Every endpoint re-checks the real token server-side via @PreAuthorize,
 * so a tampered local token buys a forged menu and a wall of 403s, nothing more.
 */
function decodePayload(token: string): unknown {
  const payload = token.split(".")[1];
  if (!payload) return null;

  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");

  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

function isAdminClaims(value: unknown): value is AdminClaims {
  if (typeof value !== "object" || value === null) return false;
  const claims = value as Record<string, unknown>;
  return (
    typeof claims.sub === "string" &&
    typeof claims.exp === "number" &&
    Array.isArray(claims.auth)
  );
}

/**
 * Turns a stored token into a session, or null if it is unreadable, expired, or
 * not an admin token. A storefront token decodes fine but carries no
 * PRINCIPAL_ADMIN authority and no company claim, so it is rejected here rather
 * than being allowed to render a back office that every request would 403 on.
 */
export function readSession(token: string | null): AdminSession | null {
  if (!token) return null;

  const claims = decodePayload(token);
  if (!isAdminClaims(claims)) return null;
  if (!claims.auth.includes(PRINCIPAL_ADMIN)) return null;
  if (claims.exp * 1000 <= Date.now()) return null;

  return {
    userId: claims.sub,
    companyId: claims.cid,
    username: claims.name,
    role: claims.role,
    permissions: claims.auth.filter((a): a is Permission => a !== PRINCIPAL_ADMIN),
    expiresAt: new Date(claims.exp * 1000),
  };
}
