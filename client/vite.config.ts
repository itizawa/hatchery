import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Vite（dev / build）と Vitest（test）の単一設定（ADR-0003）。
 * - SPA エントリは index.html → src/main.tsx。
 * - build.outDir を dist/web に分離し、tsc -b の宣言出力（dist/）と衝突させない。
 * - test は jsdom 環境 + RTL セットアップ。
 */
export default defineConfig({
  plugins: [react()],
  server: {
    // dev では SPA(5173) から API(3000) へプロキシする。
    // /api プレフィックスに統一したことでルータ追加時も proxy を触らなくて済む（#168）。
    proxy: {
      "/api": "http://localhost:3000",
      "/health": "http://localhost:3000",
    },
  },
  build: {
    outDir: "dist/web",
    emptyOutDir: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "functions/**/*.test.ts"],
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/test/**", "src/**/*.stories.{ts,tsx}"],
      thresholds: {
        statements: 50,
        branches: 50,
        functions: 50,
        lines: 50,
      },
    },
  },
});
