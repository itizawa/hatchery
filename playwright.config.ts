import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright e2e テスト設定（Issue #393）。
 *
 * - testDir './e2e' 配下の全サブディレクトリ（auth / home-feed / community /
 *   post-thread / admin ...）の *.spec.ts をデフォルトパターンで自動収集する。
 * - 現時点の spec はすべて test.todo() のスケルトンであり実行対象のテストが無いため、
 *   CI（pnpm turbo run lint test build）には e2e を組み込んでいない。
 *   CI パイプラインへの e2e 実行の組み込み（ブラウザインストール・サーバ起動を含む）は
 *   別 Issue で対応する。ローカルでは `pnpm e2e` で実行できる。
 * - 対象アプリは client（Vite dev server, デフォルト http://localhost:5173）+
 *   server API。実テスト実装時は E2E_BASE_URL で接続先を切り替えられる。
 */
export default defineConfig({
  testDir: "./e2e",
  // e2e は本物の API / DB に触るため、テスト間の干渉を避けて直列実行を既定とする。
  fullyParallel: false,
  // CI で誤って実行された場合に test.only の置き忘れを失敗として検出する。
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
