import { API_BASE_PATH } from "@/services/env";
import { clearAuthToken, getAuthToken } from "@/services/auth-token";

/**
 * The Spring backend returns domain payloads bare — there is no
 * ApiResponse<T>/SaveResult envelope like the legacy .NET admin had (and which
 * the storefront's own api-client still unwraps). Success is the HTTP status;
 * the body IS the data. Errors come back shaped by GlobalExceptionHandler.
 */
interface ProblemBody {
  timestamp?: string;
  status?: number;
  error?: string;
  detail?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** A 422 is the backend's BusinessRuleViolationException: the request was
   *  well-formed but the domain refused it. Worth surfacing verbatim to the
   *  user, unlike a 500, because the detail is written for them. */
  get isBusinessRule(): boolean {
    return this.status === 422;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }
}

/**
 * Fired when a request comes back 401. The token is cleared here, but this
 * module cannot navigate — it has no router — so the session provider listens
 * for this and sends the user to /login. Using an event rather than a callback
 * keeps services/ free of any dependency on features/ or on Next's router.
 */
export const UNAUTHORIZED_EVENT = "tentvaale:unauthorized";

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

export async function apiFetch<T>(
  path: string,
  { method = "GET", body, signal }: RequestOptions = {},
): Promise<T> {
  const token = getAuthToken();

  const res = await fetch(`${API_BASE_PATH}/${path.replace(/^\//, "")}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  if (res.status === 401) {
    clearAuthToken();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }
    throw new ApiError("Your session has expired. Please sign in again.", 401);
  }

  // 204 on reset-password and any other write that returns nothing. Calling
  // res.json() on an empty body throws, so short-circuit before parsing.
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    if (res.ok) return undefined as T;
    throw new ApiError(res.statusText || "Request failed", res.status);
  }

  const raw = await res.text();

  if (!res.ok) {
    // Spring's entry point and its 403 handler answer with an empty body, so a
    // parsed `detail` is available for domain errors but not for these.
    let detail: string | undefined;
    try {
      detail = (JSON.parse(raw) as ProblemBody).detail;
    } catch {
      detail = undefined;
    }
    throw new ApiError(detail ?? defaultMessage(res.status, res.statusText), res.status);
  }

  if (raw === "") return undefined as T;

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new ApiError(`Malformed response from ${path}`, res.status);
  }
}

function defaultMessage(status: number, statusText: string): string {
  if (status === 403) return "You do not have permission to do that.";
  if (status === 404) return "Not found.";
  if (status >= 500) return "The server could not complete the request.";
  return statusText || "Request failed";
}
