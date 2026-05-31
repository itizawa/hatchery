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
    proxy: {
      "/auth": "http://localhost:3000",
      "/api": "http://localhost:3000",
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
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
  },
});
