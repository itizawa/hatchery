import type { Page } from "@playwright/test";
import { test, expect } from "../support/test.js";

/**
 * ranking e2e テスト（#665）。
 *
 * e2e/ranking/usecases.md の UC-RANK-01〜03 に対応する実テスト。
 * page.route() で API をモックし、バックエンドなしでブラウザ側の振る舞いを検証する。
 */

// ─── モックデータ ─────────────────────────────────────────────────────

const MOCK_RANKING_WORKERS = [
  {
    worker_id: "worker-1",
    display_name: "アリス",
    view_count: 150,
    vote_net_score: 42,
  },
  {
    worker_id: "worker-2",
    display_name: "ボブ",
    view_count: 80,
    vote_net_score: -5,
  },
  {
    worker_id: "worker-3",
    display_name: "キャロル",
    view_count: 30,
    vote_net_score: 0,
  },
];

// ─── モックヘルパー ─────────────────────────────────────────────────────

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

async function mockRankingApi(
  page: Page,
  workers: unknown[] = MOCK_RANKING_WORKERS,
): Promise<void> {
  await page.route("**/api/workers/ranking", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ workers }),
    }),
  );
}

// ─── テスト ─────────────────────────────────────────────────────────────────

test("サイドバーの「ランキング」リンクを押して /ranking へ遷移できる (UC-RANK-01)", async ({
  page,
}) => {
  await mockUnauthenticated(page);
  await mockCommunitiesApi(page);
  await mockFeedApi(page);
  await mockRankingApi(page);

  await page.goto("/");

  // サイドバーの「ランキング」リンクをクリック
  await page.getByRole("link", { name: "ランキング" }).click();

  // URL が /ranking になること
  await expect(page).toHaveURL("/ranking");

  // 「ワーカーランキング」の見出しが表示されること
  await expect(page.getByRole("heading", { name: "ワーカーランキング" })).toBeVisible();
});

test(
  "ランキング画面にワーカーの表示名・閲覧数（7日）・ Vote スコア（7日）と順位番号が表示される (UC-RANK-02)",
  async ({ page }) => {
    await mockUnauthenticated(page);
    await mockCommunitiesApi(page);
    await mockRankingApi(page);

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
  },
);

test(
  "直近 7 日以内に閲覧も vote も記録されていない場合に空状態メッセージが表示される (UC-RANK-03)",
  async ({ page }) => {
    await mockUnauthenticated(page);
    await mockCommunitiesApi(page);
    await mockRankingApi(page, []);

    await page.goto("/ranking");

    // 空状態メッセージが表示されること
    await expect(page.getByText("まだランキングデータがありません。")).toBeVisible();

    // テーブル行は表示されないこと
    await expect(page.getByRole("table")).not.toBeVisible();
  },
);
