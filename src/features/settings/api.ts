import { apiFetch } from "@/services/api-client";

const BASE = "/admin";

/** The caller's own company, as the backend serves it. Every field is sent back on save. */
export interface CompanyProfile {
  id: number;
  name: string;
  gstin: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  primaryPhone: string | null;
  secondaryPhone: string | null;
  publicEmail: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  youtubeUrl: string | null;
  /** The one GST rate (percent) charged on a quotation's items; null until set. */
  gstRate: number | null;
}

export const getCompany = (signal?: AbortSignal) =>
  apiFetch<CompanyProfile>(`${BASE}/master-data/company`, { signal });

export const updateCompany = (profile: CompanyProfile) =>
  apiFetch<CompanyProfile>(`${BASE}/master-data/company`, { method: "PUT", body: profile });

export type PolicyKind = "CANCELLATION" | "DAMAGE" | "DELIVERY" | "TERMS";

export interface Policy {
  kind: PolicyKind;
  /** 0 = never published. */
  version: number;
  title: string;
  body: string;
  publishedAt?: string | null;
}

export const listPolicies = (signal?: AbortSignal) => apiFetch<Policy[]>(`${BASE}/config/policies`, { signal });

export const policyHistory = (kind: PolicyKind, signal?: AbortSignal) =>
  apiFetch<Policy[]>(`${BASE}/config/policies/${kind}/history`, { signal });

/** Publishes a new version; earlier ones stay, so quotations already sent keep their text. */
export const publishPolicy = (kind: PolicyKind, input: { title: string; body: string }) =>
  apiFetch<Policy>(`${BASE}/config/policies/${kind}`, { method: "PUT", body: input });

export const settingsKeys = {
  company: ["settings", "company"] as const,
  policies: ["settings", "policies"] as const,
  history: (kind: PolicyKind) => ["settings", "policies", kind, "history"] as const,
};
