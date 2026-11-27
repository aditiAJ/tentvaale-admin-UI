import { PRINCIPAL_ADMIN, type Permission, type Role } from "@/services/permissions";

/**
 * Mints a token the app's own session reader will accept.
 *
 * It is a real JWT in shape — header.payload.signature, base64url, the same
 * claim names JwtTokenService issues — but the signature is a placeholder and
 * nothing verifies it. That is fine precisely because nothing in this app ever
 * verified a signature: `readSession` only decodes claims, because the backend
 * is what actually enforces authorisation. Minting here rather than faking a
 * session object means the whole real auth path — storage, cross-tab sync,
 * expiry, permission gating — keeps running unchanged under the mock.
 */

function base64url(value: string): string {
  // btoa needs latin1, so UTF-8 is escaped first — usernames and company names
  // can carry non-ASCII.
  const bytes = new TextEncoder().encode(value);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

interface MintArgs {
  userId: string;
  companyId: string;
  username: string;
  role: Role;
  /** Everything the user may do, as the server would put it in the token. */
  permissions: Permission[];
  /** Matches the backend's 12-hour admin token lifetime. */
  ttlSeconds?: number;
}

export function mintMockToken({
  userId,
  companyId,
  username,
  role,
  permissions,
  ttlSeconds = 12 * 60 * 60,
}: MintArgs): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: "tentvaale-admin-mock",
      sub: userId,
      cid: companyId,
      name: username,
      role,
      auth: [PRINCIPAL_ADMIN, ...permissions],
      iat: now,
      exp: now + ttlSeconds,
    }),
  );
  return `${header}.${payload}.mock-signature-not-verified`;
}
