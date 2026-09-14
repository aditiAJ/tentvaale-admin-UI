/**
 * Where the app gets its data.
 *
 * The real API layer is complete and still in the tree — every feature's
 * `api/` module keeps its typed fetch wrappers against the Spring endpoints.
 * This flag only decides which implementation those wrappers call, so turning
 * the real backend on later is an env var and a restart, not a rewrite.
 *
 * Defaults to "mock" so the app runs standalone, the way the storefront does.
 * Set NEXT_PUBLIC_DATA_SOURCE=api once a backend is reachable.
 */
export const DATA_SOURCE = process.env.NEXT_PUBLIC_DATA_SOURCE === "api" ? "api" : "mock";

export const IS_MOCK = DATA_SOURCE === "mock";
