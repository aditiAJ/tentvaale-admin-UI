/**
 * The rules of the access form. The server applies the same "also ticks" rules when it saves; here they keep the
 * screen showing what will really be saved.
 */
import type { AccessModule, AdminUserView } from "./types";
import type { Permission, Role } from "@/services/permissions";

/** The order job titles are listed in, wherever they appear: the Admin first. */
export const ROLE_ORDER: readonly Role[] = ["ADMIN", "SALES", "OPERATIONS", "ACCOUNTS", "WAREHOUSE"];

/** People who can sign in first, then by job title as above, then by name. */
export function sortUsers<T extends Pick<AdminUserView, "active" | "role" | "username">>(users: readonly T[]): T[] {
  return [...users].sort(
    (a, b) =>
      Number(b.active) - Number(a.active)
      || ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)
      || a.username.localeCompare(b.username),
  );
}

/** How a person's ticks differ from where their job title starts. */
export function changesFromDefault(selected: ReadonlySet<Permission>, defaults: readonly Permission[]) {
  const usual = new Set(defaults);
  return {
    added: [...selected].filter((p) => !usual.has(p)).length,
    removed: defaults.filter((p) => !selected.has(p)).length,
  };
}

type Requires = ReadonlyMap<Permission, readonly Permission[]>;

export function requiresOf(modules: readonly AccessModule[]): Requires {
  return new Map(modules.flatMap((m) => m.boxes.map((b) => [b.permission, b.requires] as const)));
}

/** Ticks the boxes, and everything they require, however many steps away. */
export function tick(selected: ReadonlySet<Permission>, boxes: readonly Permission[], requires: Requires): Set<Permission> {
  const next = new Set(selected);
  const pending = [...boxes];
  while (pending.length > 0) {
    const box = pending.pop() as Permission;
    if (!next.has(box)) {
      next.add(box);
      pending.push(...(requires.get(box) ?? []));
    }
  }
  // A box that was already ticked may still miss something it requires (data saved before a new rule).
  for (const box of boxes) for (const needed of requires.get(box) ?? []) next.add(needed);
  return next;
}

/** Unticks the boxes, and every box that cannot stay without them: unticking a module's View empties the module. */
export function untick(selected: ReadonlySet<Permission>, boxes: readonly Permission[], requires: Requires): Set<Permission> {
  const next = new Set(selected);
  for (const box of boxes) next.delete(box);
  let removed = true;
  while (removed) {
    removed = false;
    for (const box of next) {
      if ((requires.get(box) ?? []).some((needed) => !next.has(needed))) {
        next.delete(box);
        removed = true;
      }
    }
  }
  return next;
}

/** Whether a user's ticks differ from where their job title starts. Only tick boxes are compared. */
export function differsFromDefault(permissions: readonly Permission[], defaults: readonly Permission[], boxes: ReadonlySet<Permission>): boolean {
  const ticked = new Set(permissions.filter((p) => boxes.has(p)));
  return ticked.size !== defaults.length || defaults.some((p) => !ticked.has(p));
}
