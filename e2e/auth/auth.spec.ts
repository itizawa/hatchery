import type { Page } from "@playwright/test";
import { test, expect } from "../support/test.js";

/**
 * auth e2e テスト（#426）。
 *
 * e2e/auth/usecases.md の UC-AUTH-01〜07 に対応する実テスト。
 * page.route() で API をモックし、バックエンドなしでブラウザ側の認証導線を検証する。
 */

/** テスト用モックユーザー（認証済み状態をシミュレート）。 */
const MOCK_USER = {
  id: "test-user-1",
  email: "test@example.com",
  displayName: "テスト太郎",
  role: "member",
};

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

/** /api/auth/me を認証済み（200 + MOCK_USER）にモックする。 */
async function mockAuthenticated(page: Page): Promise<void> {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_USER),
    }),
  );
}

/**
 * コンテンツ取得 API（communities / feed）を空レスポンスにモックする。
 * サイドバー・フィードの取得失敗が auth 検証に干渉しないようにする。
 */
async function mockContentApis(page: Page): Promise<void> {
  await page.route("**/api/communities", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    }),
  );
  // "**/api/feed" のみ（末尾 ** なし）で /api/feedback 等への誤マッチを防ぐ。
  // クエリパラメータ付き URL（/api/feed?sort=popular 等）は Playwright が自動でマッチする。
  await page.route("**/api/feed", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ posts: [], nextCursor: null }),
    }),
  );
}

test("UC-AUTH-01: ヘッダーのログイン導線からログインモーダルが開く（#454）", async ({ page }) => {
  await mockUnauthenticated(page);
  await mockContentApis(page);

  await page.goto("/");

  // 初期状態: ログインモーダルは閉じている
  await expect(page.getByRole("dialog")).not.toBeVisible();

  // ヘッダーの「ログイン」リンクをクリック
  await page.getByRole("link", { name: "ログイン" }).click();

  // ページ遷移せずログインモーダルが開く
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "ログイン" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Google でログイン" })).toBeVisible();
  // ID/パスワードフォームは表示されない（#455: Google 認証のみ）
  await expect(dialog.getByRole("textbox")).not.toBeVisible();
  // 背景の閲覧コンテキストが保持される（URLに login=1 が付くだけでパスは変わらない）
  await expect(page).toHaveURL(/\/\?login=1/);
});

test("UC-AUTH-02: Google でログインすると Google OAuth へリダイレクトされる（#455）", async ({
  page,
}) => {
  await mockUnauthenticated(page);
  await mockContentApis(page);
  // Google OAuth エンドポイントへのナビゲーションをインターセプト
  await page.route("**/api/auth/google", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<html>mock google</html>" }),
  );

  await page.goto("/?login=1");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // 「Google でログイン」ボタンをクリックすると /api/auth/google へ遷移
  await dialog.getByRole("button", { name: "Google でログイン" }).click();
  await page.waitForURL("**/api/auth/google");
  expect(page.url()).toContain("/api/auth/google");
});

test("UC-AUTH-03: Google OAuth 完了後にホームへリダイレクトされる", async ({ page }) => {
  // OAuth コールバック後はログイン済み状態になる
  await mockAuthenticated(page);
  await mockContentApis(page);
  // コールバックエンドポイントはサーバーが / へリダイレクトする
  await page.route(/\/api\/auth\/google\/callback/, (route) =>
    route.fulfill({ status: 302, headers: { location: "/" }, body: "" }),
  );

  // OAuth コールバック URL へアクセス（ダミーパラメータ）
  await page.goto("/api/auth/google/callback?code=dummy&state=dummy");

  // ホーム（/）へリダイレクトされる
  await expect(page).toHaveURL("/");
  // ログインモーダルは閉じていること
  await expect(page.getByRole("dialog")).not.toBeVisible();
  // ヘッダーにログイン済みユーザーのメニューが表示される
  await expect(page.getByRole("button", { name: "ユーザーメニュー" })).toBeVisible();
});

test("UC-AUTH-04: ログアウトすると未ログイン状態に戻る", async ({ page }) => {
  // 認証状態を動的に切り替えるクロージャ
  let authState: "authenticated" | "unauthenticated" = "authenticated";
  await page.route("**/api/auth/me", (route) => {
    if (authState === "authenticated") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_USER),
      });
    }
    return route.fulfill({ status: 401, body: "" });
  });
  await page.route("**/api/auth/logout", async (route) => {
    if (route.request().method() !== "POST") {
      return route.continue();
    }
    authState = "unauthenticated";
    return route.fulfill({ status: 200, body: "" });
  });
  await mockContentApis(page);

  await page.goto("/");

  // ログイン済み: ユーザーメニューボタンが見える
  const userMenuButton = page.getByRole("button", { name: "ユーザーメニュー" });
  await expect(userMenuButton).toBeVisible();

  // アカウントメニューを開いてログアウトを実行
  await userMenuButton.click();
  await page.getByRole("menuitem", { name: "ログアウト" }).click();

  // 未ログイン状態に戻る: ヘッダーに「ログイン」リンクが表示される
  await expect(page.getByRole("link", { name: "ログイン" })).toBeVisible();
  // ログインモーダルは自動では開かない
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test(
  "UC-AUTH-05: 未ログインで認証必須ページ（/account）にアクセスするとホーム上にログインモーダルが開く（#454）",
  async ({ page }) => {
    await mockUnauthenticated(page);
    await mockContentApis(page);

    await page.goto("/account");

    // ホーム（/?login=1）へリダイレクトされる
    await expect(page).toHaveURL("/?login=1");
    // ログインモーダルが開く
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Google でログイン" })).toBeVisible();
  },
);

test(
  "UC-AUTH-06: 未ログインで管理画面（/admin）にアクセスするとホーム上にログインモーダルが開く（#454）",
  async ({ page }) => {
    await mockUnauthenticated(page);
    await mockContentApis(page);

    await page.goto("/admin");

    // ホーム（/?login=1）へリダイレクトされる
    await expect(page).toHaveURL("/?login=1");
    // ログインモーダルが開く
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Google でログイン" })).toBeVisible();
  },
);

test(
  "UC-AUTH-07: 旧 /login URL はホーム上のログインモーダルへ誘導される（#454 後方互換）",
  async ({ page }) => {
    await mockUnauthenticated(page);
    await mockContentApis(page);

    await page.goto("/login");

    // /?login=1 へリダイレクトされる
    await expect(page).toHaveURL("/?login=1");
    // ホーム上にログインモーダルが開く
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Google でログイン" })).toBeVisible();
  },
);
