import path from "node:path";
import { defineConfig } from "vitest/config";

const packagesDir = path.resolve(__dirname, "../../packages");

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "jsdom",
    fileParallelism: false,
    testTimeout: 10_000,
    include: [
      // App-level component tests (apps/web/)
      "**/*.test.tsx",
      // Package component tests (packages/*/src/)
      `${packagesDir}/*/src/**/*.test.tsx`,
    ],
    exclude: ["**/node_modules/**"],
    setupFiles: ["./test-setup-jsdom.ts"],
  },
});
