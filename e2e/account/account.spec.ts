import { expect, test } from "@playwright/test";

/**
 * e2e/account/usecases.md の UC-ACCOUNT-01〜04 に対応する実テスト（Issue #738）。
 * Playwright の page.route() で API をモックし、実ブラウザ上の
 * プロフィール編集フローを検証する（home-feed/home-feed.spec.ts のパターンに準拠）。
 */

/* ── モックデータ定義 ─────────────────────────────────────────────────────────── */

const MOCK_AUTH_USER = {
  id: "user1",
  displayName: "旧名前",
  email: "test@example.com",
  avatarUrl: null,
  isAdmin: false,
};

/* ── ヘルパー ─────────────────────────────────────────────────────────────────── */

/**
 * ログイン済みユーザーの共通モックを設定する。
 * - GET /api/auth/me → MOCK_AUTH_USER（requireAuth ガードと AccountScene の初期値に使用）
 * - GET /api/communities → []（サイドバー共通コンポーネント用）
 */
async function setupAuthMocks(page: import("@playwright/test").Page) {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_AUTH_USER),
    }),
  );
  await page.route("**/api/communities", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    }),
  );
}

/* ── テスト ──────────────────────────────────────────────────────────────────── */

test("UC-ACCOUNT-01: 表示名・プロフィール画像 URL を変更して保存できる", async ({ page }) => {
  await setupAuthMocks(page);

  // PATCH /api/auth/me は成功レスポンスを返す（GET はデフォルトモックを引き継ぐ）
  const updatedUser = { ...MOCK_AUTH_USER, displayName: "新しい名前" };
  await page.route("**/api/auth/me", async (route) => {
    if (route.request().method() === "PATCH") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(updatedUser),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_AUTH_USER),
    });
  });

  await page.goto("/account");

  // 表示名フィールドを変更する
  const displayNameField = page.getByLabel("表示名");
  await displayNameField.clear();
  await displayNameField.fill("新しい名前");

  // 保存ボタンが有効になっていることを確認
  const saveButton = page.getByRole("button", { name: "保存" });
  await expect(saveButton).toBeEnabled();

  // 保存ボタンをクリック
  await saveButton.click();

  // 成功 Snackbar が表示される
  await expect(page.getByText("保存しました")).toBeVisible();
});

test("UC-ACCOUNT-02: 変更が無いとき保存ボタンが無効化される", async ({ page }) => {
  await setupAuthMocks(page);
  await page.goto("/account");

  const saveButton = page.getByRole("button", { name: "保存" });

  // 初期状態では保存ボタンが無効
  await expect(saveButton).toBeDisabled();

  // 表示名を別の値に変更すると有効になる
  const displayNameField = page.getByLabel("表示名");
  await displayNameField.clear();
  await displayNameField.fill("別の名前");
  await expect(saveButton).toBeEnabled();

  // 初期値に戻すと再び無効になる
  await displayNameField.clear();
  await displayNameField.fill(MOCK_AUTH_USER.displayName);
  await expect(saveButton).toBeDisabled();
});

test("UC-ACCOUNT-03: 不正な URL を入力すると保存できずエラーが表示される", async ({ page }) => {
  await setupAuthMocks(page);
  await page.goto("/account");

  // プロフィール画像 URL に不正な値を入力してフォーカスを外す
  const avatarUrlField = page.getByLabel("プロフィール画像 URL");
  await avatarUrlField.fill("not-a-valid-url");
  await avatarUrlField.blur();

  // バリデーションエラーメッセージが表示される
  await expect(page.getByText("有効な URL を入力してください")).toBeVisible();

  // 保存ボタンが無効のままである（canSubmit = false）
  const saveButton = page.getByRole("button", { name: "保存" });
  await expect(saveButton).toBeDisabled();
});

test("UC-ACCOUNT-04: プロフィール更新に失敗するとエラー内容が表示される", async ({ page }) => {
  await setupAuthMocks(page);

  // PATCH /api/auth/me を 500 エラーで返す
  await page.route("**/api/auth/me", async (route) => {
    if (route.request().method() === "PATCH") {
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Internal Server Error" }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_AUTH_USER),
    });
  });

  await page.goto("/account");

  // 表示名を変更して保存を試みる
  const displayNameField = page.getByLabel("表示名");
  await displayNameField.clear();
  await displayNameField.fill("別の名前");

  const saveButton = page.getByRole("button", { name: "保存" });
  await saveButton.click();

  // エラー Snackbar が表示される（「プロフィールの更新に失敗しました」等）
  await expect(page.getByText(/プロフィールの更新に失敗しました/)).toBeVisible();

  // 成功 Snackbar（「保存しました」）は表示されない
  await expect(page.getByText("保存しました")).not.toBeVisible();
});

// UC-ACCOUNT-05 は未実装スケルトン（usecases.md 参照）。
test(
  "UC-ACCOUNT-05: 初回ログイン直後（?welcome=1）に表示名設定を促す歓迎メッセージが表示される",
  async () => {
    test.fixme();
  },
);
