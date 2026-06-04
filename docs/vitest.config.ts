import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@hatchery/client": path.resolve(__dirname, "../client/src"),
      "@hatchery/common": path.resolve(__dirname, "../common/src"),
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
