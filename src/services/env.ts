// The browser never receives an API origin. Every request the client makes is
// same-origin against /api/*, which next.config.ts rewrites to the Spring
// backend on the server side. That is why there is no NEXT_PUBLIC_API_BASE_URL
// here, unlike the storefront: exposing one would invite direct cross-origin
// calls that the backend currently has no CORS bean to permit.
export const API_BASE_PATH = "/api";
