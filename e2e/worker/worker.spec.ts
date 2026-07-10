import type { Page } from "@playwright/test";
import { expect, test } from "../support/test.js";

/**
 * worker e2e テスト（#1098）。
 *
 * e2e/worker/usecases.md の UC-WORKER-01〜07 に対応する。
 * page.route() で API をモックし、バックエンドなしでブラウザ側の挙動を検証する。
 */

const WORKER_ID = "worker-1";

const MOCK_WORKER = {
  id: WORKER_ID,
  displayName: "ホロ博士",
  role: "研究員",
  personality: "好奇心旺盛で、なんでも実験してみたくなる性格。",
  imageUrl: "https://example.com/avatar.png",
};

const MOCK_COMMUNITY = {
  id: "community-1",
  slug: "test-community",
  name: "テストコミュニティ",
  description: "テスト用のコミュニティです。",
  created_at: "2024-01-01T00:00:00.000Z",
  post_count: 1,
  last_post_at: "2024-01-01T00:00:00.000Z",
  subscriber_count: 0,
};

const MOCK_POST = {
  id: "post-1",
  community_id: MOCK_COMMUNITY.id,
  slot_key: "2024-01-01T00:00",
  seq: 1,
  author: WORKER_ID,
  title: "実験ノート: 新しい観察結果について",
  text: "実験の観察結果をまとめました。",
  score: 3,
  created_at: "2024-01-01T00:00:00.000Z",
  comment_count: 0,
  tags: [],
};

const MOCK_COMMENT = {
  id: "comment-1",
  community_id: MOCK_COMMUNITY.id,
  post_id: MOCK_POST.id,
  slot_key: "2024-01-01T00:00",
  seq: 1,
  author: WORKER_ID,
  text: "ホロ博士のコメント本文です。",
  score: 0,
  created_at: "2024-01-01T00:00:00.000Z",
  parent_comment_id: null,
};

/** フィード投稿（UC-WORKER-01 の遷移元）。author_worker で byline リンクを有効化する。 */
const MOCK_FEED_POST = {
  id: "feed-post-1",
  community_id: MOCK_COMMUNITY.id,
  slot_key: "2024-01-01T00:00",
  seq: 1,
  author: WORKER_ID,
  title: "フィードに表示される投稿",
  text: "フィード本文です。",
  score: 0,
  created_at: "2024-01-01T00:00:00.000Z",
  comment_count: 0,
  tags: [],
  author_worker: {
    id: WORKER_ID,
    display_name: MOCK_WORKER.displayName,
    image_url: null,
  },
};

// ─── モックヘルパー ──────────────────────────────────────────────

async function mockUnauthenticated(page: Page): Promise<void> {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Unauthorized" }),
    }),
  );
}

async function mockGlobalCommunities(page: Page): Promise<void> {
  await page.route("**/api/communities", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    }),
  );
}

async function mockHomeFeed({ page, posts }: { page: Page; posts: unknown[] }): Promise<void> {
  await page.route("**/api/feed?*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ posts, nextCursor: null }),
    }),
  );
}

/**
 * ワーカープロフィールページ（#929 / #690）が依存する4エンドポイントを一括モックする。
 * WorkerScene は4つの独立した QueryBoundary（プロフィール/投稿/コミュニティ/コメント）を
 * 持つため、テスト対象外のセクションもレンダリングが破綻しないよう常に全件モックする。
 */
async function mockWorkerProfile({
  page,
  worker = MOCK_WORKER,
  posts = [MOCK_POST],
  communities = [MOCK_COMMUNITY],
  comments = [MOCK_COMMENT],
}: {
  page: Page;
  worker?: unknown;
  posts?: unknown[];
  communities?: unknown[];
  comments?: unknown[];
}): Promise<void> {
  await page.route(`**/api/workers/${WORKER_ID}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(worker),
    }),
  );
  await page.route(`**/api/workers/${WORKER_ID}/posts`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ posts }),
    }),
  );
  await page.route(`**/api/workers/${WORKER_ID}/communities`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ communities }),
    }),
  );
  await page.route(`**/api/workers/${WORKER_ID}/comments`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ comments, nextCursor: null }),
    }),
  );
}

// ─── テスト ──────────────────────────────────────────────────────

test("UC-WORKER-01: ワーカープロフィールページへの遷移", async ({ page }) => {
  await mockUnauthenticated(page);
  await mockGlobalCommunities(page);
  await mockHomeFeed({ page, posts: [MOCK_FEED_POST] });
  await mockWorkerProfile({ page });

  await page.goto("/");

  // 投稿カード全体もリンクになっているため、byline のワーカーリンク（href=/workers/{id}）を
  // href で特定してクリックする（post タイトルリンクとの strict mode 衝突を避ける）。
  await page.locator(`a[href="/workers/${WORKER_ID}"]`).click();

  await expect(page).toHaveURL(`/workers/${WORKER_ID}`);
  await expect(page.getByTestId("worker-display-name")).toHaveText(MOCK_WORKER.displayName);
});

test("UC-WORKER-02: ワーカープロフィール表示", async ({ page }) => {
  await mockUnauthenticated(page);
  await mockGlobalCommunities(page);
  await mockWorkerProfile({ page });

  await page.goto(`/workers/${WORKER_ID}`);

  await expect(page.getByTestId("worker-display-name")).toHaveText(MOCK_WORKER.displayName);
  await expect(page.getByText(MOCK_WORKER.role)).toBeVisible();
  await expect(page.getByText(MOCK_WORKER.personality)).toBeVisible();
  await expect(page.getByText(MOCK_POST.title)).toBeVisible();
});

test("UC-WORKER-03: 投稿のないワーカーの空状態", async ({ page }) => {
  await mockUnauthenticated(page);
  await mockGlobalCommunities(page);
  await mockWorkerProfile({ page, posts: [] });

  await page.goto(`/workers/${WORKER_ID}`);

  await expect(page.getByTestId("worker-display-name")).toHaveText(MOCK_WORKER.displayName);
  await expect(page.getByTestId("worker-posts-empty")).toBeVisible();
  await expect(page.getByText("まだ投稿がありません。")).toBeVisible();
  await expect(page.getByText(MOCK_POST.title)).toHaveCount(0);
});

test.todo("UC-WORKER-04: 所属コミュニティ一覧表示");

test("UC-WORKER-05: 所属コミュニティがない場合の空状態", async ({ page }) => {
  await mockUnauthenticated(page);
  await mockGlobalCommunities(page);
  await mockWorkerProfile({ page, communities: [] });

  await page.goto(`/workers/${WORKER_ID}`);

  await expect(page.getByTestId("worker-communities-empty")).toBeVisible();
  await expect(page.getByText("まだ所属コミュニティがありません。")).toBeVisible();
});

test.todo("UC-WORKER-06: コメント一覧表示");

test("UC-WORKER-07: コメントがない場合の空状態", async ({ page }) => {
  await mockUnauthenticated(page);
  await mockGlobalCommunities(page);
  await mockWorkerProfile({ page, comments: [] });

  await page.goto(`/workers/${WORKER_ID}`);

  await expect(page.getByTestId("worker-comments-empty")).toBeVisible();
  await expect(page.getByText("まだコメントがありません。")).toBeVisible();
});
