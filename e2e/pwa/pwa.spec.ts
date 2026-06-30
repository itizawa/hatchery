import { expect, test } from "@playwright/test";

/**
 * e2e/pwa/usecases.md の UC-PWA-01〜06 に対応する実テスト（#898）。
 *
 * UC-PWA-01〜04: manifest リンク / theme-color / manifest JSON / PNG アイコンの静的アセット検査。
 * UC-PWA-05: Vite dev サーバーでは devOptions.enabled: false により SW 無効 → test.skip。
 * UC-PWA-06: beforeinstallprompt はブラウザ固有 UI、Playwright では自動制御不可 → test.skip。
 */

/** ゲスト状態で最小限の API モックを設定する。`<head>` 内静的コンテンツを検査するために使用。 */
async function setupGuestMocks(page: import("@playwright/test").Page) {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Unauthorized" }) }),
  );
  await page.route("**/api/communities", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) }),
  );
}

/* ── UC-PWA-01 ────────────────────────────────────────────────────────────────── */

test("UC-PWA-01: manifest リンクが HTML の <head> に存在し manifest.webmanifest を参照している", async ({
  page,
}) => {
  await setupGuestMocks(page);
  await page.goto("/");

  const manifestHref = await page.evaluate(() => {
    const link = document.querySelector('link[rel="manifest"]');
    return link?.getAttribute("href") ?? null;
  });

  expect(manifestHref).not.toBeNull();
  expect(manifestHref).toMatch(/manifest\.webmanifest/);
});

/* ── UC-PWA-02 ────────────────────────────────────────────────────────────────── */

test('UC-PWA-02: <meta name="theme-color" content="#1164A3"> が HTML の <head> に存在する', async ({
  page,
}) => {
  await setupGuestMocks(page);
  await page.goto("/");

  const themeColor = await page.evaluate(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    return meta?.getAttribute("content") ?? null;
  });

  expect(themeColor).toBe("#1164A3");
});

/* ── UC-PWA-03 ────────────────────────────────────────────────────────────────── */

test(
  "UC-PWA-03: /manifest.webmanifest が正しい name / display / start_url / theme_color / icons を返す",
  async ({ page }) => {
    const response = await page.request.get("/manifest.webmanifest");

    expect(response.status()).toBe(200);

    const manifest = (await response.json()) as {
      name?: string;
      display?: string;
      start_url?: string;
      theme_color?: string;
      icons?: Array<{ src: string; sizes: string; purpose?: string }>;
    };

    expect(manifest.name).toBe("Hatchery");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.theme_color).toBe("#1164A3");

    const icons = manifest.icons ?? [];
    expect(icons.some((icon) => icon.sizes === "192x192")).toBe(true);
    expect(icons.some((icon) => icon.sizes === "512x512")).toBe(true);
    expect(icons.some((icon) => icon.purpose?.includes("maskable"))).toBe(true);
  },
);

/* ── UC-PWA-04 ────────────────────────────────────────────────────────────────── */

test("UC-PWA-04: /pwa-192x192.png と /pwa-512x512.png が HTTP 200 で PNG 画像を返す", async ({
  page,
}) => {
  const response192 = await page.request.get("/pwa-192x192.png");
  expect(response192.status()).toBe(200);
  expect(response192.headers()["content-type"]).toContain("image/png");

  const response512 = await page.request.get("/pwa-512x512.png");
  expect(response512.status()).toBe(200);
  expect(response512.headers()["content-type"]).toContain("image/png");
});

/* ── UC-PWA-05 ────────────────────────────────────────────────────────────────── */

// Vite dev サーバーは vite-plugin-pwa の devOptions.enabled: false により SW を登録しない。
// このテストはプロダクションビルド（pnpm build && vite preview または本番 URL）に対してのみ有効。
// E2E_BASE_URL に本番/プレビュー URL を指定した環境で実行する。
test(
  "UC-PWA-05: Service Worker が activated 状態になりオフラインでもアプリシェルが表示される",
  async () => {
    test.skip(true, "Vite dev サーバーでは devOptions.enabled: false により SW 無効。E2E_BASE_URL に本番 URL を指定した環境でのみ実行可能");
  },
);

/* ── UC-PWA-06 ────────────────────────────────────────────────────────────────── */

// beforeinstallprompt はブラウザ固有の UI イベントであり、Playwright では自動制御不可。
// 手動 QA または特定のブラウザフラグを有効にした環境でのみ検証可能。
test(
  "UC-PWA-06: インストールプロンプトが表示されスタンドアロンモードで起動できる",
  async () => {
    test.skip(true, "beforeinstallprompt はブラウザ固有の UI イベントであり Playwright では自動制御不可。手動 QA でのみ検証可能");
  },
);
