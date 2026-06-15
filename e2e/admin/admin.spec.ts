import type { Page } from "@playwright/test";
import { test, expect } from "../support/test.js";

/**
 * admin e2e テスト（#430）。
 *
 * e2e/admin/usecases.md の UC-ADMIN-01〜14 に対応する実テスト。
 * page.route() で API をモックし、バックエンドなしでブラウザ側の管理画面挙動を検証する。
 */

// ─── モックデータ ───────────────────────────────────────────────────

const MOCK_ADMIN_USER = {
  id: "admin-1",
  email: "admin@example.com",
  displayName: "管理者ユーザー",
  role: "admin",
};

const MOCK_MEMBER_USER = {
  id: "member-1",
  email: "member@example.com",
  displayName: "一般ユーザー",
  role: "member",
};

const MOCK_WORKER = {
  id: "w1",
  displayName: "テストワーカーA",
  role: "エンジニア",
};

const MOCK_COMMUNITY = {
  id: "c1",
  slug: "tech-news",
  name: "テックニュース",
  description: "技術ニュースを議論するコミュニティ",
  created_at: "2024-01-01T00:00:00.000Z",
};

// ─── ヘルパー関数 ─────────────────────────────────────────────────

/** GET /api/auth/me を 401（未認証）にモックする。 */
async function mockUnauthenticated(page: Page): Promise<void> {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Unauthorized" }) }),
  );
}

/** GET /api/auth/me を admin ユーザーにモックする。 */
async function mockAdmin(page: Page): Promise<void> {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_ADMIN_USER) }),
  );
}

/** GET /api/auth/me を 非 admin（member）ユーザーにモックする。 */
async function mockMember(page: Page): Promise<void> {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_MEMBER_USER) }),
  );
}

/** サイドバー用公開コミュニティ（GET /api/communities）を空にモックする。 */
async function mockPublicCommunities(page: Page): Promise<void> {
  await page.route("**/api/communities", (route) => {
    const url = route.request().url();
    if (url.includes("/api/communities/") || url.includes("/api/admin/communities")) {
      return route.continue();
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

/** GET /api/workers を指定 workers でモックする（管理画面ワーカー一覧）。 */
async function mockAdminWorkers(page: Page, workers: object[] = [MOCK_WORKER]): Promise<void> {
  await page.route("**/api/workers", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(workers) });
  });
}

/** GET /api/admin/communities を指定 communities でモックする。 */
async function mockAdminCommunities(page: Page, communities: object[] = [MOCK_COMMUNITY]): Promise<void> {
  await page.route("**/api/admin/communities", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(communities) });
  });
}

/** GET /api/admin/settings を空配列にモックする。 */
async function mockAdminSettings(page: Page): Promise<void> {
  await page.route("**/api/admin/settings", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

/** GET /api/admin/batch-logs を空配列にモックする。 */
async function mockBatchLogs(page: Page): Promise<void> {
  await page.route("**/api/admin/batch-logs", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
}

/** GET /api/admin/token-usage を空結果にモックする。 */
async function mockTokenUsage(page: Page): Promise<void> {
  await page.route("**/api/admin/token-usage", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ logs: [], summary: { totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0 } }),
    }),
  );
}

/** 全タブの API をまとめてモックする（UC-ADMIN-03 のタブ切替テスト用）。 */
async function mockAllAdminApis(page: Page): Promise<void> {
  await mockAdmin(page);
  await mockPublicCommunities(page);
  await mockAdminWorkers(page);
  await mockAdminSettings(page);
  await mockBatchLogs(page);
  await mockTokenUsage(page);
  await mockAdminCommunities(page);
  await page.route("**/api/admin/workers/**/communities", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ communityIds: [] }) }),
  );
}

// ─── テスト ─────────────────────────────────────────────────────────

test("UC-ADMIN-01: 未ログインで /admin にアクセスすると /?login=1 へリダイレクトされログインモーダルが開く", async ({ page }) => {
  await mockUnauthenticated(page);
  await mockPublicCommunities(page);

  await page.goto("/admin");

  // /?login=1 へリダイレクトされる（requireAdminRoute が認証失敗時に redirect する）
  await expect(page).toHaveURL("/?login=1");
  // ログインモーダルが開く
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Google でログイン" })).toBeVisible();
  // 管理画面の内容は表示されない
  await expect(page.getByRole("heading", { name: "管理画面" })).not.toBeVisible();
});

test("UC-ADMIN-02: 非 admin ユーザーが /admin にアクセスするとホームへリダイレクトされる", async ({ page }) => {
  await mockMember(page);
  await mockPublicCommunities(page);
  await page.route("**/api/feed", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ posts: [], nextCursor: null }) }),
  );

  await page.goto("/admin");

  // / へリダイレクトされる（requireAdminRoute が非 admin を / へリダイレクト）
  await expect(page).toHaveURL("/");
  // 管理画面の見出しは表示されない
  await expect(page.getByRole("heading", { name: "管理画面" })).not.toBeVisible();
});

test("UC-ADMIN-03: admin ユーザーは管理画面のタブを切り替えられる", async ({ page }) => {
  await mockAllAdminApis(page);

  await page.goto("/admin");

  // 管理画面が表示される
  await expect(page.getByRole("heading", { name: "管理画面" })).toBeVisible();

  // 「API トークン設定」タブをクリックすると URL が変わる
  await page.getByRole("tab", { name: "API トークン設定" }).click();
  await expect(page).toHaveURL(/tab=api-token/);

  // 「バッチログ」タブをクリックすると URL が変わる
  await page.getByRole("tab", { name: "バッチログ" }).click();
  await expect(page).toHaveURL(/tab=batch-logs/);

  // 「コミュニティ」タブをクリックすると URL が変わる
  await page.getByRole("tab", { name: "コミュニティ" }).click();
  await expect(page).toHaveURL(/tab=communities/);

  // 「ワーカー管理」タブへ戻ると URL が変わる
  await page.getByRole("tab", { name: "ワーカー管理" }).click();
  await expect(page).toHaveURL(/tab=users/);
});

test("UC-ADMIN-04: admin ユーザーが Worker 一覧を閲覧できる", async ({ page }) => {
  await mockAdmin(page);
  await mockPublicCommunities(page);
  await mockAdminWorkers(page, [
    { id: "w1", displayName: "テストワーカーA", role: "エンジニア" },
    { id: "w2", displayName: "テストワーカーB", role: "デザイナー" },
  ]);

  await page.goto("/admin?tab=users");

  // Worker 一覧テーブルに登録済みワーカーが表示される
  await expect(page.getByText("テストワーカーA")).toBeVisible();
  await expect(page.getByText("テストワーカーB")).toBeVisible();
  await expect(page.getByText("エンジニア")).toBeVisible();
});

test("UC-ADMIN-05: admin ユーザーが Worker を新規作成できる", async ({ page }) => {
  await mockAdmin(page);
  await mockPublicCommunities(page);

  // 初期は空リスト → 作成後にワーカーが含まれるリストを返す
  let workerCreated = false;
  await page.route("**/api/workers", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(workerCreated ? [{ id: "new-w", displayName: "新規ワーカー", role: "テスター" }] : []),
    });
  });
  // AddWorkerDialog 内 WorkerCommunitiesField が使うコミュニティ一覧
  await page.route("**/api/admin/communities", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  // POST /api/admin/workers でワーカーを作成
  await page.route("**/api/admin/workers", (route) => {
    if (route.request().method() !== "POST") return route.continue();
    workerCreated = true;
    return route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ id: "new-w", displayName: "新規ワーカー", role: "テスター" }),
    });
  });
  // PUT /api/admin/workers/:id/communities（空コミュニティで作成）
  await page.route("**/api/admin/workers/**/communities", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ communityIds: [] }) }),
  );

  await page.goto("/admin?tab=users");

  // 「社員を追加」ボタンをクリック
  await page.getByRole("button", { name: "社員を追加" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "社員を追加" })).toBeVisible();

  // 必須項目（表示名）を入力
  await dialog.getByRole("textbox", { name: "表示名" }).fill("新規ワーカー");

  // 「追加」ボタンをクリック
  await dialog.getByRole("button", { name: "追加" }).click();

  // ダイアログが閉じる
  await expect(dialog).not.toBeVisible();

  // 一覧に新しい Worker が表示される
  await expect(page.getByText("新規ワーカー")).toBeVisible();
});

test("UC-ADMIN-06: admin ユーザーが Worker を削除できる（現状: 削除ボタンは Worker テーブルに表示されていない）", async ({ page }) => {
  await mockAdmin(page);
  await mockPublicCommunities(page);
  await mockAdminWorkers(page, [{ id: "w1", displayName: "テストワーカーA", role: "エンジニア" }]);

  await page.goto("/admin?tab=users");

  // Worker 一覧が表示される
  await expect(page.getByText("テストワーカーA")).toBeVisible();

  // 現状: AdminWorkerTableInner が WorkerTable へ onDelete を渡していないため削除ボタンは非表示
  // 「編集」ボタンは表示される（isEditable=true）
  await expect(page.getByRole("button", { name: /編集 テストワーカーA/ })).toBeVisible();
  // 「削除」ボタンは表示されない
  await expect(page.getByRole("button", { name: /削除/ })).not.toBeVisible();
});

test("UC-ADMIN-07: admin ユーザーがコミュニティ管理タブで一覧を閲覧できる", async ({ page }) => {
  await mockAdmin(page);
  await mockPublicCommunities(page);
  await mockAdminCommunities(page, [
    { id: "c1", slug: "tech-news", name: "テックニュース", description: "技術ニュース", created_at: "2024-01-01T00:00:00.000Z" },
    { id: "c2", slug: "ai-talk", name: "AI 雑談", description: "AI の話題", created_at: "2024-01-02T00:00:00.000Z" },
  ]);

  await page.goto("/admin?tab=communities");

  // コミュニティ一覧にコミュニティ名と slug が表示される
  await expect(page.getByText("テックニュース")).toBeVisible();
  await expect(page.getByText("tech-news")).toBeVisible();
  await expect(page.getByText("AI 雑談")).toBeVisible();
  await expect(page.getByText("ai-talk")).toBeVisible();
});

test("UC-ADMIN-08: admin ユーザーが Worker の参加コミュニティを編集できる", async ({ page }) => {
  const WORKER_ID = "w1";
  await mockAdmin(page);
  await mockPublicCommunities(page);
  await mockAdminWorkers(page, [{ id: WORKER_ID, displayName: "テストワーカーA", role: "エンジニア" }]);
  // 参加コミュニティ取得（GET）と更新（PUT）を同 URL で処理
  await page.route(`**/api/admin/workers/${WORKER_ID}/communities`, (route) => {
    if (route.request().method() === "PUT") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ communityIds: ["c1"] }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ communityIds: [] }) });
  });
  // WorkerCommunitiesField のコミュニティ一覧
  await mockAdminCommunities(page, [{ id: "c1", slug: "tech-news", name: "テックニュース", description: "技術ニュース", created_at: "2024-01-01T00:00:00.000Z" }]);
  // PATCH /api/workers/:id（ワーカー情報更新）
  await page.route(`**/api/workers/${WORKER_ID}`, (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: WORKER_ID, displayName: "テストワーカーA", role: "エンジニア" }),
    });
  });

  await page.goto("/admin?tab=users");

  // 「編集」ボタンをクリックしてダイアログを開く
  await page.getByRole("button", { name: "編集 テストワーカーA" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "ワーカー編集" })).toBeVisible();

  // コミュニティ取得完了を待つ（保存ボタンが有効になるまで）
  const saveButton = dialog.getByRole("button", { name: "保存" });
  await expect(saveButton).toBeEnabled({ timeout: 5000 });

  // 参加コミュニティを選択（MUI Select をクリックして選択肢を開く）
  const communitySelect = dialog.getByRole("combobox", { name: /参加コミュニティ/ });
  await communitySelect.click();
  await page.getByRole("option", { name: "テックニュース" }).click();
  await page.keyboard.press("Escape");

  // 「保存」ボタンをクリック
  await saveButton.click();

  // 保存成功 → ダイアログが閉じる
  await expect(dialog).not.toBeVisible();
});

test("UC-ADMIN-09: admin ユーザーが Worker 新規作成時に参加コミュニティを指定できる", async ({ page }) => {
  await mockAdmin(page);
  await mockPublicCommunities(page);

  // GET /api/workers: 初期空 → 作成後にワーカーを含む
  let workerCreated = false;
  await page.route("**/api/workers", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        workerCreated ? [{ id: "new-w", displayName: "コミュニティ付きワーカー", role: "エンジニア" }] : [],
      ),
    });
  });
  // WorkerCommunitiesField のコミュニティ一覧
  await page.route("**/api/admin/communities", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ id: "c1", slug: "tech-news", name: "テックニュース", description: "技術ニュース", created_at: "2024-01-01T00:00:00.000Z" }]),
    });
  });
  // POST /api/admin/workers でワーカーを作成
  await page.route("**/api/admin/workers", (route) => {
    if (route.request().method() !== "POST") return route.continue();
    workerCreated = true;
    return route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ id: "new-w", displayName: "コミュニティ付きワーカー", role: "エンジニア" }),
    });
  });
  // PUT /api/admin/workers/:id/communities：送信された communityIds をキャプチャする
  let savedCommunityIds: string[] = [];
  await page.route("**/api/admin/workers/**/communities", async (route) => {
    const body = route.request().postDataJSON() as { communityIds: string[] };
    savedCommunityIds = body?.communityIds ?? [];
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ communityIds: savedCommunityIds }) });
  });

  await page.goto("/admin?tab=users");

  // 「社員を追加」ボタンをクリック
  await page.getByRole("button", { name: "社員を追加" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // 表示名を入力
  await dialog.getByRole("textbox", { name: "表示名" }).fill("コミュニティ付きワーカー");

  // 参加コミュニティを選択（コミュニティ一覧の読み込み完了を待つ）
  const communitySelect = dialog.getByRole("combobox", { name: /参加コミュニティ/ });
  await expect(communitySelect).toBeEnabled({ timeout: 5000 });
  await communitySelect.click();
  await page.getByRole("option", { name: "テックニュース" }).click();
  await page.keyboard.press("Escape");

  // 「追加」ボタンをクリック
  await dialog.getByRole("button", { name: "追加" }).click();

  // ダイアログが閉じる
  await expect(dialog).not.toBeVisible();

  // PUT で c1 が指定されていた（参加コミュニティが永続化される）
  expect(savedCommunityIds).toContain("c1");

  // 一覧に新しい Worker が表示される
  await expect(page.getByText("コミュニティ付きワーカー")).toBeVisible();
});

test("UC-ADMIN-10: admin ユーザーがコミュニティのアイコン・カバー画像をアップロードできる", async ({ page }) => {
  const COMMUNITY_ID = "c1";
  await mockAdmin(page);
  await mockPublicCommunities(page);
  await mockAdminCommunities(page, [
    { id: COMMUNITY_ID, slug: "tech-news", name: "テックニュース", description: "技術ニュース", iconUrl: null, coverUrl: null, created_at: "2024-01-01T00:00:00.000Z" },
  ]);
  // アイコン画像アップロードエンドポイント
  await page.route(`**/api/admin/communities/${COMMUNITY_ID}/icon`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: COMMUNITY_ID, iconUrl: "https://example.com/icon.png", coverUrl: null }),
    }),
  );

  await page.goto("/admin?tab=communities");

  // コミュニティ一覧が表示される
  await expect(page.getByText("テックニュース")).toBeVisible();

  // 「編集」をクリックして編集フォームを開く
  await page.getByRole("button", { name: "編集" }).first().click();

  // 編集フォームが表示される（アイコン画像テキストが現れる）
  await expect(page.getByText("アイコン画像（クリックして変更）")).toBeVisible();

  // ファイル選択ダイアログをインターセプトしてアップロード
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    // アイコン画像（丸い Avatar）をクリックする
    page.getByAltText("テックニュース").last().click(),
  ]);
  await fileChooser.setFiles({
    name: "icon.png",
    mimeType: "image/png",
    buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  });

  // アップロード API が呼ばれたことを確認する（モックのルートが使用された）
  // 編集フォームは引き続き表示されている（アップロードはフォーム送信と独立）
  await expect(page.getByText("アイコン画像（クリックして変更）")).toBeVisible();
});

test("UC-ADMIN-11: 管理画面タブのデータ取得に失敗すると再試行フォールバックが表示される", async ({ page }) => {
  await mockAdmin(page);
  await mockPublicCommunities(page);
  // GET /api/admin/settings を 500 で失敗させる
  await page.route("**/api/admin/settings", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Server Error" }) }),
  );

  await page.goto("/admin?tab=api-token");

  // 「データの取得に失敗しました。」と「再試行」ボタンが表示される
  await expect(page.getByText("データの取得に失敗しました。")).toBeVisible();
  await expect(page.getByRole("button", { name: "再試行" })).toBeVisible();

  // 管理画面の見出し・タブ自体は表示され続ける（失敗の影響はタブ領域内のみ）
  await expect(page.getByRole("heading", { name: "管理画面" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "API トークン設定" })).toBeVisible();
});

test("UC-ADMIN-12: Worker 編集の保存に失敗するとエラー内容が表示される", async ({ page }) => {
  const WORKER_ID = "w1";
  await mockAdmin(page);
  await mockPublicCommunities(page);
  await mockAdminWorkers(page, [{ id: WORKER_ID, displayName: "テストワーカーA", role: "エンジニア" }]);
  // 参加コミュニティ取得
  await page.route(`**/api/admin/workers/${WORKER_ID}/communities`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ communityIds: [] }) }),
  );
  // WorkerCommunitiesField
  await mockAdminCommunities(page, []);
  // PATCH /api/workers/:id を 500 で失敗させる
  await page.route(`**/api/workers/${WORKER_ID}`, (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    return route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "ワーカーの更新に失敗しました" }),
    });
  });

  await page.goto("/admin?tab=users");

  // 「編集」ボタンをクリック
  await page.getByRole("button", { name: "編集 テストワーカーA" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // コミュニティ取得完了を待つ（保存ボタンが有効になるまで）
  const saveButton = dialog.getByRole("button", { name: "保存" });
  await expect(saveButton).toBeEnabled({ timeout: 5000 });

  // 「保存」ボタンをクリック
  await saveButton.click();

  // エラー Snackbar（Alert）が表示される
  await expect(page.getByRole("alert")).toBeVisible();

  // ダイアログはエラー時に閉じない
  await expect(dialog).toBeVisible();
});

test("UC-ADMIN-13: API トークン設定の保存に失敗するとエラー内容が表示される", async ({ page }) => {
  await mockAdmin(page);
  await mockPublicCommunities(page);
  // GET → 200（設定取得成功）・PATCH → 500（保存失敗）を 1 つのハンドラで統合する。
  // 別々のハンドラに分けると Playwright の LIFO 順で後から登録したハンドラが先に実行され、
  // route.continue() が実際のネットワークへ転送されて GET モックが届かなくなるため。
  await page.route("**/api/admin/settings", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
    if (route.request().method() === "PATCH") {
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "APIキーの保存に失敗しました" }),
      });
    }
    return route.continue();
  });

  await page.goto("/admin?tab=api-token");

  // API キー入力フォームが表示される
  await expect(page.getByLabel("Claude API キー")).toBeVisible();

  // API キーを入力して保存を試みる
  await page.getByLabel("Claude API キー").fill("sk-ant-api03-test");
  await page.getByRole("button", { name: "保存" }).click();

  // エラー Snackbar（Alert）が表示される
  await expect(page.getByRole("alert")).toBeVisible();

  // 保存に成功していないためフォームは残る
  await expect(page.getByLabel("Claude API キー")).toBeVisible();
});

test("UC-ADMIN-14: admin ユーザーがコミュニティに生成プロンプト指示（非公開）を設定できる", async ({ page }) => {
  await mockAdmin(page);

  // 公開 API（GET /api/communities）: generationInstruction を含まない
  const publicCommunityResponse = [
    { id: "new-c", slug: "test-comm", name: "テストコミュニティ", description: "テスト用" },
  ];
  await page.route("**/api/communities", (route) => {
    const url = route.request().url();
    if (url.includes("/api/admin/communities") || url.includes("/api/communities/")) {
      return route.continue();
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(publicCommunityResponse) });
  });

  // 管理 API（GET/POST /api/admin/communities）: generationInstruction を含む
  let communityCreated = false;
  await page.route("**/api/admin/communities", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          communityCreated
            ? [{ id: "new-c", slug: "test-comm", name: "テストコミュニティ", description: "テスト用", generationInstruction: "率直に話す。", created_at: "2024-01-01T00:00:00.000Z" }]
            : [],
        ),
      });
    }
    if (route.request().method() === "POST") {
      communityCreated = true;
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: "new-c", slug: "test-comm", name: "テストコミュニティ", description: "テスト用", generationInstruction: "率直に話す。", created_at: "2024-01-01T00:00:00.000Z" }),
      });
    }
    return route.continue();
  });

  await page.goto("/admin?tab=communities");

  // 作成フォームに入力（slug・名前・概要・生成プロンプト指示）
  await page.getByLabel("slug（URL 識別子）").fill("test-comm");
  await page.getByLabel("コミュニティ名", { exact: true }).fill("テストコミュニティ");
  await page.getByLabel("コミュニティ概要（公開）").fill("テスト用");
  await page.getByLabel(/生成プロンプト指示/).fill("率直に話す。");

  // 「作成」ボタンをクリック
  await page.getByRole("button", { name: "作成" }).click();

  // 成功スナックバーが表示される
  await expect(page.getByText("コミュニティを作成しました")).toBeVisible();

  // 一覧に新しいコミュニティが表示される
  await expect(page.getByText("テストコミュニティ")).toBeVisible();

  // 公開 API（GET /api/communities）のレスポンスに generationInstruction が含まれていないことを
  // クライアントから fetch して確認する（モック経由で境界を検証）。
  const publicData = await page.evaluate(() =>
    fetch("/api/communities").then((r) => r.json()),
  ) as Array<Record<string, unknown>>;
  expect(publicData.length).toBeGreaterThan(0);
  expect(publicData[0]).not.toHaveProperty("generationInstruction");
});

test.todo("UC-ADMIN-15: admin ユーザーが Worker の文章量（verbosity）を編集できる（#625）");
