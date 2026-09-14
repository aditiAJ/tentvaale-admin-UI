import { apiFetch } from "@/services/api-client";
import { IS_MOCK } from "@/services/data-source";
import { mockLogin } from "@/mock-data/store";
import type { LoginRequest, TokenResponse } from "@/features/auth/types";

export function login(request: LoginRequest): Promise<TokenResponse> {
  if (IS_MOCK) return mockLogin(request.username, request.password);
  return apiFetch<TokenResponse>("/admin/auth/login", { method: "POST", body: request });
}
