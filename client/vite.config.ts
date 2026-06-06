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
    // dev では SPA(5173) から API(3000) へプロキシする。サーバ側の app.ts は各ルータを
    // `/api` プレフィックスなしでトップレベルにマウントしているため、ここも実マウントの
    // トップレベルパスを列挙する（漏れると Vite が index.html を返し JSON parse で落ちる）。
    // ルータを追加したら同じトップレベルパスをここにも追加すること。
    proxy: Object.fromEntries(
      ["/auth", "/health", "/messages", "/channels", "/employees", "/admin", "/invitations"].map(
        (path) => [path, "http://localhost:3000"],
      ),
    ),
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
