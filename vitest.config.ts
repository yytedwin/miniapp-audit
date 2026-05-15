import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "."),
    },
  },
  test: {
    globals: true,
    watch: false,
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    include: ["src/**/*.test.ts", "app/**/*.test.ts"],
    server: {
      deps: {
        fallbackCJS: true,
      },
    },
  },
});
