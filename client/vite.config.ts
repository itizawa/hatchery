import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

/** OGP 用の本番ドメイン既定値（#256 / ADR-0008）。デプロイ時は VITE_OGP_URL で上書きする。 */
const DEFAULT_OGP_URL = "https://hatchery.pages.dev";

/**
 * index.html の `%VITE_OGP_URL%` を VITE_OGP_URL（未設定なら既定値）で置換するプラグイン（#256）。
 * Vite 標準の `%VITE_*%` HTML 置換は env 未設定時にトークンを残すため、共通 OGP（og:url / og:image）が
 * 必ず有効な URL になるよう既定値でフォールバックする。
 */
function ogpUrlHtmlPlugin(): Plugin {
  return {
    name: "hatchery-ogp-url",
    transformIndexHtml(html) {
      const ogpUrl = process.env.VITE_OGP_URL?.trim() || DEFAULT_OGP_URL;
      return html.replaceAll("%VITE_OGP_URL%", ogpUrl);
    },
  };
}

/** Cloudflare Web Analytics ビーコンの差し込み先プレースホルダ（index.html の `<head>`）。 */
const CF_BEACON_PLACEHOLDER = "%VITE_CF_BEACON_TOKEN_SCRIPT%";

/**
 * index.html の `%VITE_CF_BEACON_TOKEN_SCRIPT%` を Cloudflare Web Analytics のビーコン script に
 * 置換するプラグイン（ADR-0026 / #439）。
 *
 * - `VITE_CF_BEACON_TOKEN` が設定されている場合のみ、token を埋め込んだ beacon script を出力する。
 * - 未設定（空・空白のみ）の場合はプレースホルダを空文字に置換し、壊れた空 token のタグを残さない。
 * - token は `JSON.stringify` でエスケープして `data-cf-beacon` の JSON に埋め込み、不正トークンでも
 *   HTML/JSON が壊れないようにする。
 *
 * 注: トークンはコードにハードコードせず、デプロイ時に env で注入する（OGP の #256 と同方式）。
 */
export function cfBeaconHtmlPlugin(): Plugin {
  return {
    name: "hatchery-cf-beacon",
    transformIndexHtml(html) {
      const token = process.env.VITE_CF_BEACON_TOKEN?.trim();
      if (!token) {
        return html.replaceAll(CF_BEACON_PLACEHOLDER, "");
      }
      const beacon = JSON.stringify({ token });
      const script = `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='${beacon}'></script>`;
      return html.replaceAll(CF_BEACON_PLACEHOLDER, script);
    },
  };
}

/**
 * Vite（dev / build）と Vitest（test）の単一設定（ADR-0003）。
 * - SPA エントリは index.html → src/main.tsx。
 * - build.outDir を dist/web に分離し、tsc -b の宣言出力（dist/）と衝突させない。
 * - test は jsdom 環境 + RTL セットアップ。
 */
export default defineConfig({
  plugins: [react(), ogpUrlHtmlPlugin(), cfBeaconHtmlPlugin()],
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
    include: ["src/**/*.test.{ts,tsx}", "functions/**/*.test.ts", "vite.config.test.ts"],
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
