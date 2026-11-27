import type { Permission, Role } from "@/services/permissions";

/** Mirrors com.tentvaale.identity.api.AdminUserView. */
export interface AdminUserView {
  id: string;
  companyId: string;
  username: string;
  email: string;
  role: Role;
  active: boolean;
  /** Everything the user may do: their ticked boxes (everything for an Administrator) and what everyone has. */
  permissions: Permission[];
}

export interface CreateAdminUserRequest {
  username: string;
  email: string;
  password: string;
  role: Role;
  /** The ticked boxes. Left out, the role's defaults are used. */
  permissions?: Permission[];
}

/** One tick box of the access form. */
export interface AccessBox {
  permission: Permission;
  label: string;
  description: string;
  /** Marked with a warning: it ends records, moves money back or changes company settings. */
  sensitive: boolean;
  /** The boxes ticking this one also ticks. */
  requires: Permission[];
}

/** A row of the access form. `group` follows the left menu. */
export interface AccessModule {
  group: string;
  title: string;
  boxes: AccessBox[];
}

/** What the server says the access form offers (GET /admin/users/access-options). */
export interface AccessOptions {
  modules: AccessModule[];
  /** What each job title starts with. */
  roleDefaults: Record<Role, Permission[]>;
}
