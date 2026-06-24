import type { Page } from "@playwright/test";
import { expect, test } from "../support/test.js";

/**
 * legal e2e テスト（Issue #739）。
 *
 * e2e/legal/usecases.md の UC-LEGAL-01〜04 に対応する実テスト。
 * page.route() で API をモックし、バックエンドなしでブラウザ側の法的ページを検証する。
 */

/** /api/auth/me を未認証（401）にモックする。 */
async function mockUnauthenticated(page: Page): Promise<void> {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Unauthorized" }),
    }),
  );
}

/** /api/communities をモックして空リストを返す（サイドバー縮退防止）。 */
async function mockCommunities(page: Page): Promise<void> {
  await page.route("**/api/communities", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    }),
  );
}

test("UC-LEGAL-01: 利用規約ページ（/terms）が未ログインでも閲覧できる", async ({ page }) => {
  await mockUnauthenticated(page);
  await mockCommunities(page);

  await page.goto("/terms");

  // ログイン画面へリダイレクトされない
  await expect(page).toHaveURL("/terms");

  // 「利用規約」見出しが表示される
  await expect(page.getByRole("heading", { name: "利用規約" })).toBeVisible();
});

test("UC-LEGAL-02: プライバシーポリシーページ（/privacy）が未ログインでも閲覧できる", async ({
  page,
}) => {
  await mockUnauthenticated(page);
  await mockCommunities(page);

  await page.goto("/privacy");

  // ログイン画面へリダイレクトされない
  await expect(page).toHaveURL("/privacy");

  // 「プライバシーポリシー」見出しが表示される
  await expect(page.getByRole("heading", { name: "プライバシーポリシー" })).toBeVisible();
});

test("UC-LEGAL-03: サイドバーから利用規約・プライバシーポリシーへ遷移できる", async ({ page }) => {
  await mockUnauthenticated(page);
  await mockCommunities(page);

  // /terms を起点にサイドバーの「プライバシーポリシー」リンクをクリック
  await page.goto("/terms");
  await page.getByRole("link", { name: "プライバシーポリシー" }).click();
  await expect(page).toHaveURL("/privacy");
  await expect(page.getByRole("heading", { name: "プライバシーポリシー" })).toBeVisible();

  // /privacy から「利用規約」リンクをクリックして戻る
  await page.getByRole("link", { name: "利用規約" }).click();
  await expect(page).toHaveURL("/terms");
  await expect(page.getByRole("heading", { name: "利用規約" })).toBeVisible();
});

test("UC-LEGAL-04: リーガルページの本文が暫定（ドラフト）である旨が明示される", async ({
  page,
}) => {
  await mockUnauthenticated(page);
  await mockCommunities(page);

  // /terms に暫定ドラフト注記がある
  await page.goto("/terms");
  await expect(page.getByText(/暫定（ドラフト）/)).toBeVisible();

  // /privacy にも同様の暫定ドラフト注記がある
  await page.goto("/privacy");
  await expect(page.getByText(/暫定（ドラフト）/)).toBeVisible();
});
