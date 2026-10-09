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
  pan: string | null;
  bankName: string | null;
  bankAccount: string | null;
  bankIfsc: string | null;
  upiId: string | null;
  logoUrl: string | null;
  signatureUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  /** The code every new SKU starts with, e.g. TENT (TENT-PRO-001). */
  skuPrefix?: string | null;
  /** Goods are not dispatched until a payment is recorded against the order. */
  requirePaymentBeforeDispatch?: boolean;
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

export type NumberedDocument = "QUOTATION" | "ORDER" | "CREDIT_NOTE" | "STOCK_MOVEMENT" | "INVOICE" | "RECEIPT";

/** How one kind of document is numbered; `example` is the next number as it will look. */
export interface Numbering {
  documentType: NumberedDocument;
  prefix: string;
  nextValue: number;
  padding: number;
  fyReset: boolean;
  periodKey: string | null;
  example: string;
}

export const listNumbering = (signal?: AbortSignal) => apiFetch<Numbering[]>(`${BASE}/config/numbering`, { signal });

export const updateNumbering = (type: NumberedDocument, input: Pick<Numbering, "prefix" | "nextValue" | "padding" | "fyReset">) =>
  apiFetch<Numbering>(`${BASE}/config/numbering/${type}`, { method: "PUT", body: input });

export const settingsKeys = {
  numbering: ["settings", "numbering"] as const,
  company: ["settings", "company"] as const,
  policies: ["settings", "policies"] as const,
  history: (kind: PolicyKind) => ["settings", "policies", kind, "history"] as const,
};
