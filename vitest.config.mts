import { defineConfig } from "vitest/config";
import path from "path";

// Mirrors tsconfig.json's "@/*" -> "./*" path alias so test files can import
// the same way application code does (Sprint 6.5 Phase 1).
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
  test: {
    environment: "node",
  },
});
