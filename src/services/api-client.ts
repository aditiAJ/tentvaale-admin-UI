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
  /** Per-field messages for a 400 validation failure, keyed by field name. */
  errors?: Record<string, string>;
}

/**
 * A failed request, carrying the status so callers can tell the cases apart.
 *
 * The status callers care about most is 422, the backend's
 * BusinessRuleViolationException: the request was well-formed but the domain
 * refused it, and its `detail` is written for the user, so the UI surfaces
 * `message` verbatim rather than substituting copy of its own. A 403 or a 500
 * gets generic copy instead — see defaultMessage below.
 */
/** Status carried by an ApiError when the server could not be reached at all (no HTTP response). */
export const NETWORK_ERROR_STATUS = 0;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    /** Set for a validation failure: field name to message. Empty otherwise. */
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
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

  // A FormData body (file upload) sets its own multipart Content-Type; everything else is JSON.
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`${API_BASE_PATH}/${path.replace(/^\//, "")}`, {
      method,
      headers: {
        ...(body !== undefined && !isForm ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      signal,
    });
  } catch (caught) {
    // A cancelled request is the caller's own doing, not a failure to report.
    if (caught instanceof DOMException && caught.name === "AbortError") throw caught;
    throw new ApiError("Cannot reach the server. Check your connection and try again.", NETWORK_ERROR_STATUS);
  }

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
    // The backend answers every failure with a `detail`; a proxy's own error page has none.
    let problem: ProblemBody = {};
    try {
      problem = JSON.parse(raw) as ProblemBody;
    } catch {
      // Not JSON (a proxy's error page, or an empty body): fall back to the status copy.
    }
    throw new ApiError(problem.detail ?? defaultMessage(res.status, res.statusText), res.status, problem.errors);
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
  if (status === 429) return "Too many attempts. Please wait a moment and try again.";
  if (status === 502 || status === 503 || status === 504) return "The server is not reachable right now. Please try again in a moment.";
  if (status >= 500) return "The server could not complete the request.";
  return statusText || "Request failed";
}

/**
 * A GET whose answer is a file (the Excel export), not JSON. Sends the same login token as {@link apiFetch}, so
 * the file is never behind an open link, and returns the bytes with the name the server chose for them.
 */
export async function apiDownload(path: string, signal?: AbortSignal): Promise<{ blob: Blob; filename: string }> {
  const token = getAuthToken();
  let res: Response;
  try {
    res = await fetch(`${API_BASE_PATH}/${path.replace(/^\//, "")}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal,
    });
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === "AbortError") throw caught;
    throw new ApiError("Cannot reach the server. Check your connection and try again.", NETWORK_ERROR_STATUS);
  }
  if (res.status === 401) {
    clearAuthToken();
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    throw new ApiError("Your session has expired. Please sign in again.", 401);
  }
  if (!res.ok) {
    let problem: ProblemBody = {};
    try {
      problem = JSON.parse(await res.text()) as ProblemBody;
    } catch {
      // Not JSON (a proxy's error page): fall back to the status copy.
    }
    throw new ApiError(problem.detail ?? defaultMessage(res.status, res.statusText), res.status, problem.errors);
  }
  const named = /filename="?([^";]+)"?/i.exec(res.headers.get("content-disposition") ?? "");
  return { blob: await res.blob(), filename: named?.[1] ?? "export.xlsx" };
}
