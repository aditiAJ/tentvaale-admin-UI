import type { Role } from "@/services/permissions";

/**
 * Mirrors com.tentvaale.identity.api.AdminUserView.
 *
 * The Java record also exposes a derived permissions() helper, deliberately not
 * modelled here: it is not a record component, so it is not part of the JSON
 * contract, and the UI has no reason to trust a second copy of the role mapping
 * when the caller's own permissions already arrive in their token.
 */
export interface AdminUserView {
  id: string;
  companyId: string;
  username: string;
  email: string;
  role: Role;
  active: boolean;
}

export interface CreateAdminUserRequest {
  username: string;
  email: string;
  password: string;
  role: Role;
}
