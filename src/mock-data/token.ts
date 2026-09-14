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

/** Roles map to permissions here only because there is no server to ask. */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    "MASTER_DATA_READ", "MASTER_DATA_WRITE",
    "QUOTATION_READ", "QUOTATION_WRITE",
    "ORDER_READ", "ORDER_WRITE",
    "INVENTORY_READ", "INVENTORY_WRITE",
    "CREDIT_NOTE_READ", "CREDIT_NOTE_WRITE",
    "DEPOSIT_READ", "DEPOSIT_WRITE",
    "REPORTING_READ", "NOTIFICATION_READ",
    "CONFIG_WRITE", "USER_READ", "USER_WRITE",
  ],
  SALES: [
    "MASTER_DATA_READ",
    "QUOTATION_READ", "QUOTATION_WRITE",
    "ORDER_READ", "ORDER_WRITE",
    "INVENTORY_READ",
    "CREDIT_NOTE_READ",
    "DEPOSIT_READ",
    "REPORTING_READ", "NOTIFICATION_READ",
  ],
  WAREHOUSE: ["MASTER_DATA_READ", "ORDER_READ", "INVENTORY_READ", "INVENTORY_WRITE"],
  ACCOUNTS: [
    "MASTER_DATA_READ",
    "QUOTATION_READ", "ORDER_READ",
    "CREDIT_NOTE_READ", "CREDIT_NOTE_WRITE",
    "DEPOSIT_READ", "DEPOSIT_WRITE",
    "REPORTING_READ", "NOTIFICATION_READ",
  ],
};

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
  /** Matches the backend's 12-hour admin token lifetime. */
  ttlSeconds?: number;
}

export function mintMockToken({
  userId,
  companyId,
  username,
  role,
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
      auth: [PRINCIPAL_ADMIN, ...ROLE_PERMISSIONS[role]],
      iat: now,
      exp: now + ttlSeconds,
    }),
  );
  return `${header}.${payload}.mock-signature-not-verified`;
}
