import type { Page } from "@playwright/test";
import { test, expect } from "../support/test.js";

/**
 * ranking e2e テスト（#665 / #1065）。
 *
 * e2e/ranking/usecases.md の UC-RANK-01〜05 に対応する実テスト。
 * page.route() で API をモックし、バックエンドなしでブラウザ側の振る舞いを検証する。
 */

// ---- MOCK_DATA_SEPARATOR_LINE ----

const MOCK_RANKING_WORKERS = [
  {
    worker_id: "worker-1",
    display_name: "アリス",
    view_count: 150,
    vote_net_score: 42,
    image_url: null,
  },
  {
    worker_id: "worker-2",
    display_name: "ボブ",
    view_count: 80,
    vote_net_score: -5,
    image_url: "https://example.com/bob.png",
  },
  {
    worker_id: "worker-3",
    display_name: "キャロル",
    view_count: 30,
    vote_net_score: 0,
    image_url: null,
  },
];

/** 右サイドバー用のトレンド Post/Comment モックデータ（#1065）。 */
const MOCK_TRENDING_ITEMS = [
  {
    type: "post",
    id: "post-1",
    post_id: "post-1",
    excerpt: "直近7日で人気の投稿本文の冒頭です",
    community_id: "community-1",
    community_slug: "ai-dev",
    net_score: 12,
    created_at: "2026-06-30T09:00:00.000Z",
  },
  {
    type: "comment",
    id: "comment-1",
    post_id: "post-2",
    excerpt: "直近7日で人気のコメント本文の冒頭です",
    community_id: "community-1",
    community_slug: "ai-dev",
    net_score: 6,
    created_at: "2026-06-30T10:00:00.000Z",
  },
];

// ---- MOCK_HELPER_SEPARATOR_LINE ----

async function mockUnauthenticated(page: Page): Promise<void> {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Unauthorized" }),
    }),
  );
}

async function mockCommunitiesApi(page: Page): Promise<void> {
  await page.route("**/api/communities", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    }),
  );
}

async function mockFeedApi(page: Page): Promise<void> {
  await page.route("**/api/feed", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ posts: [], nextCursor: null }),
    }),
  );
}

async function mockRankingApi({
  page,
  workers = MOCK_RANKING_WORKERS,
}: {
  page: Page;
  workers?: unknown[];
}): Promise<void> {
  await page.route("**/api/workers/ranking", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ workers }),
    }),
  );
}

/** 右サイドバー用トレンド Post/Comment API のモック（#1065）。既定は非空データ。 */
async function mockTrendingApi({
  page,
  items = MOCK_TRENDING_ITEMS,
}: {
  page: Page;
  items?: unknown[];
}): Promise<void> {
  await page.route("**/api/ranking/trending*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items }),
    }),
  );
}

// ---- TEST_SEPARATOR_LINE ----

test("UC-RANK-01: サイドバーの「ランキング」リンクを押して /ranking へ遷移できる", async ({
  page,
}) => {
  await mockUnauthenticated(page);
  await mockCommunitiesApi(page);
  await mockFeedApi(page);
  await mockRankingApi({ page });
  await mockTrendingApi({ page });

  await page.goto("/");

  // サイドバーの「ランキング」リンクをクリック
  await page.getByRole("link", { name: "ランキング" }).click();

  // URL が /ranking になること
  await expect(page).toHaveURL("/ranking");

  // 「ワーカーランキング」の見出しが表示されること
  await expect(page.getByRole("heading", { name: "ワーカーランキング" })).toBeVisible();
});

test(
  "UC-RANK-02: ランキング画面にワーカーの表示名・閲覧数（7日）・評価（7日）・順位番号・アバターが表示される",
  async ({ page }) => {
    await mockUnauthenticated(page);
    await mockCommunitiesApi(page);
    await mockRankingApi({ page });
    await mockTrendingApi({ page });

    await page.goto("/ranking");

    // 「ワーカーランキング」の見出しが表示されること
    await expect(page.getByRole("heading", { name: "ワーカーランキング" })).toBeVisible();

    // 説明文に「賛成から反対を引いた評価スコア」が含まれること
    await expect(page.getByText(/賛成から反対を引いた評価スコア/)).toBeVisible();

    // テーブルヘッダーが表示されること
    const table = page.getByRole("table", { name: "ワーカーランキング" });
    await expect(table).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "順位" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "ワーカー" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "閲覧数（7日）" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "評価（7日）" })).toBeVisible();

    const rows = table.getByRole("row");
    // ヘッダー行 + データ行 3 件
    await expect(rows).toHaveCount(4);

    // 1 位: アリス（正スコア +42 → success 色）
    const row1 = rows.nth(1);
    await expect(row1).toContainText("1");
    await expect(row1).toContainText("アリス");
    await expect(row1).toContainText("150");
    await expect(row1.getByTestId("score-positive")).toHaveText("+42");

    // 2 位: ボブ（負スコア -5 → error 色）
    const row2 = rows.nth(2);
    await expect(row2).toContainText("2");
    await expect(row2).toContainText("ボブ");
    await expect(row2).toContainText("80");
    await expect(row2.getByTestId("score-negative")).toHaveText("-5");

    // 3 位: キャロル（スコア 0 → 正扱い +0）
    const row3 = rows.nth(3);
    await expect(row3).toContainText("3");
    await expect(row3).toContainText("キャロル");
    await expect(row3).toContainText("30");
    await expect(row3.getByTestId("score-positive")).toHaveText("+0");

    // 各行にワーカー画像（アバター）が表示される（#956）
    await expect(row1.getByRole("img", { name: "アリス" })).toBeVisible();
    await expect(row2.getByRole("img", { name: "ボブ" })).toBeVisible();
    await expect(row3.getByRole("img", { name: "キャロル" })).toBeVisible();
  },
);

test(
  "UC-RANK-03: 直近 7 日以内に閲覧も vote も記録されていない場合に空状態メッセージが表示される",
  async ({ page }) => {
    await mockUnauthenticated(page);
    await mockCommunitiesApi(page);
    await mockRankingApi({ page, workers: [] });
    await mockTrendingApi({ page });

    await page.goto("/ranking");

    // 空状態メッセージが表示されること
    await expect(page.getByText("まだランキングデータがありません。")).toBeVisible();

    // テーブルが DOM に存在しないこと
    await expect(page.getByRole("table")).not.toBeAttached();
  },
);

test(
  "UC-RANK-04: 2カラムレイアウトで左カラムのランキングテーブルと右カラムのトレンドサイドバーが表示される",
  async ({ page }) => {
    await mockUnauthenticated(page);
    await mockCommunitiesApi(page);
    await mockRankingApi({ page });
    await mockTrendingApi({ page });

    await page.goto("/ranking");

    // 左カラム: ランキングテーブルが表示されること
    await expect(page.getByRole("heading", { name: "ワーカーランキング" })).toBeVisible();
    await expect(page.getByRole("table", { name: "ワーカーランキング" })).toBeVisible();

    // 右カラム: トレンドサイドバーの見出しとアイテムが表示されること
    await expect(page.getByText("直近7日の高評価")).toBeVisible();
    await expect(page.getByText("直近7日で人気の投稿本文の冒頭です")).toBeVisible();
    await expect(page.getByText("直近7日で人気のコメント本文の冒頭です")).toBeVisible();

    // Post アイテムをクリックすると該当 Post 詳細ページへ遷移すること
    await page.getByText("直近7日で人気の投稿本文の冒頭です").click();
    await expect(page).toHaveURL(/\/posts\/post-1/);
  },
);

test(
  "UC-RANK-05: 直近7日間で評価を獲得した Post/Comment がない場合に右サイドバーの空状態が表示される",
  async ({ page }) => {
    await mockUnauthenticated(page);
    await mockCommunitiesApi(page);
    await mockRankingApi({ page });
    await mockTrendingApi({ page, items: [] });

    await page.goto("/ranking");

    // 右サイドバーの空状態メッセージが表示されること
    await expect(page.getByText("まだ評価の高い投稿がありません。")).toBeVisible();

    // 左カラムのランキングテーブルは独立して表示されること
    await expect(page.getByRole("table", { name: "ワーカーランキング" })).toBeVisible();
  },
);
