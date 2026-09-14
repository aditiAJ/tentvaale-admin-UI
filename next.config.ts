import type { NextConfig } from "next";

/**
 * The backend (Spring Boot, :8080) configures `.cors(Customizer.withDefaults())`
 * but publishes no CorsConfigurationSource bean, so it sends no
 * Access-Control-Allow-Origin header and a browser on :3000 cannot call it
 * directly. Rather than ask for a backend change, every call the browser makes
 * is same-origin against this app's own /api/* path and Next proxies it on the
 * server side, where CORS does not apply.
 *
 * The upside beyond unblocking: the JWT never needs a cross-origin credential
 * mode, and swapping environments is one env var rather than a rebuild.
 */
const apiOrigin = process.env.API_ORIGIN ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
};

export default nextConfig;
