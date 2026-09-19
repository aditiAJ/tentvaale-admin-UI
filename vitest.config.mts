import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * The mock store is the system under test, and it reads localStorage and mints
 * tokens through the browser's own crypto/atob, so jsdom rather than node.
 *
 * The `@/` alias is declared here rather than pulled in through
 * vite-tsconfig-paths: it is one line and one fewer dependency, and it is the
 * only path mapping tsconfig.json defines.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    restoreMocks: true,
  },
});
