import { expect, test } from "@playwright/test";

/**
 * e2e/not-found/usecases.md の UC-404-01〜02 に対応する実テスト。
 * TanStack Router の notFoundComponent に指定された NotFoundScene の
 * 表示・ナビゲーション動作を Playwright で検証する。
 */

/* ── ヘルパー ─────────────────────────────────────────────────────────────────── */

/**
 * サイドバー等のシェルコンポーネントが API を呼ぶため、最小限のモックを設定する。
 */
async function setupCommonMocks(page: import("@playwright/test").Page) {
  // コミュニティ一覧（サイドバー用）
  await page.route("**/api/communities", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    }),
  );
}

/* ── テスト ──────────────────────────────────────────────────────────────────── */

test("UC-404-01: 未マッチ URL を開くとカスタム 404 画面が表示される", async ({ page }) => {
  await setupCommonMocks(page);
  await page.goto("/xyz-nope");

  // 日本語の 404 テキストが表示される
  await expect(page.getByText("ページが見つかりません")).toBeVisible();

  // 素の英語 "Not Found" は表示されない
  await expect(page.getByText("Not Found", { exact: true })).not.toBeVisible();

  // ホームへ戻る導線が表示される
  await expect(page.getByRole("link", { name: "ホームへ戻る" })).toBeVisible();
});

test("UC-404-02: 404 画面のホーム導線をクリックするとホームへ遷移できる", async ({ page }) => {
  await setupCommonMocks(page);
  // フィード（ホーム遷移後に呼ばれる）のモック
  await page.route("**/api/feed?*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [], nextCursor: null }),
    }),
  );
  await page.route("**/api/workers", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    }),
  );

  await page.goto("/xyz-nope");

  // 「ホームへ戻る」をクリック
  await page.getByRole("link", { name: "ホームへ戻る" }).click();

  // ホームフィード（/）へ遷移する
  await expect(page).toHaveURL("/");
});
