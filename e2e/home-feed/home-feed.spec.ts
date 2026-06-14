import type { Page } from "@playwright/test";
import { test, expect } from "../support/test.js";

/**
 * home-feed e2e テスト（#427）。
 *
 * e2e/home-feed/usecases.md の UC-HOME-01〜12（UC-HOME-10 除く）に対応する実テスト。
 * page.route() で API をモックし、バックエンドなしでブラウザ側の振る舞いを検証する。
 */

// ─── モックデータ ─────────────────────────────────────────────────────────────

const MOCK_USER = {
  id: "user-1",
  email: "test@example.com",
  displayName: "テストユーザー",
  role: "member",
};

/** 3 時間前の ISO 文字列（UC-HOME-11 相対時刻テスト用）。 */
const THREE_HOURS_AGO = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

const MOCK_COMMUNITY = {
  id: "comm-1",
  slug: "test-community",
  name: "テストコミュニティ",
  description: "テスト用コミュニティの説明",
  created_at: "2024-01-01T00:00:00.000Z",
};

const MOCK_POST_1 = {
  id: "post-1",
  community_id: "comm-1",
  slot_key: "2024-01-01T12:00",
  seq: 0,
  author: "worker-a",
  title: "テスト投稿タイトル1",
  text: "テスト投稿本文1",
  score: 5,
  created_at: THREE_HOURS_AGO,
  author_worker: { id: "worker-a", display_name: "ワーカー甲", image_url: null },
  comment_count: 3,
};

const MOCK_POST_2 = {
  id: "post-2",
  community_id: "comm-1",
  slot_key: "2024-01-01T12:00",
  seq: 1,
  author: "worker-b",
  title: "テスト投稿タイトル2",
  text: "テスト投稿本文2",
  score: 2,
  created_at: THREE_HOURS_AGO,
  author_worker: {
    id: "worker-b",
    display_name: "ワーカー乙",
    image_url: "https://example.com/avatar.png",
  },
  comment_count: 0,
};

// ─── モックヘルパー ────────────────────────────────────────────────────────────

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

/** /api/communities をモックする（サイドバーの干渉を防ぐ）。 */
async function mockCommunitiesApi(page: Page, communities: unknown[] = []): Promise<void> {
  await page.route("**/api/communities", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(communities),
    }),
  );
}

/** /api/feed を固定レスポンスにモックする。 */
async function mockFeedApi(
  page: Page,
  response: { posts: unknown[]; nextCursor: string | null },
): Promise<void> {
  await page.route("**/api/feed", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    }),
  );
}

// ─── テスト ───────────────────────────────────────────────────────────────────

test("UC-HOME-01: 未ログインでもホームフィードに全コミュニティの投稿が新着順で表示される", async ({
  page,
}) => {
  await mockUnauthenticated(page);
  await mockCommunitiesApi(page);
  await mockFeedApi(page, { posts: [MOCK_POST_1, MOCK_POST_2], nextCursor: null });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "ホームフィード" })).toBeVisible();
  await expect(page.getByRole("heading", { name: MOCK_POST_1.title, level: 3 })).toBeVisible();
  await expect(page.getByRole("heading", { name: MOCK_POST_2.title, level: 3 })).toBeVisible();
  // ログインリンクが表示される（未認証）
  await expect(page.getByRole("link", { name: "ログイン" })).toBeVisible();
});

test("UC-HOME-02: 投稿カードからスレッドページへ遷移できる", async ({ page }) => {
  await mockUnauthenticated(page);
  await mockCommunitiesApi(page);
  await mockFeedApi(page, { posts: [MOCK_POST_1], nextCursor: null });

  // スレッドページ取得をモック（遷移後のページが壊れないよう）
  await page.route(`**/api/posts/${MOCK_POST_1.id}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ post: MOCK_POST_1, comments: [] }),
    }),
  );

  await page.goto("/");

  // 投稿カード全体が RouterLink で包まれている — タイトル見出しをクリックして遷移
  await page.getByRole("heading", { name: MOCK_POST_1.title, level: 3 }).click();

  await expect(page).toHaveURL(`/posts/${MOCK_POST_1.id}`);
});

test(
  "UC-HOME-03: 下までスクロールすると次のページが自動で読み込まれる（無限スクロール）",
  async ({ page }) => {
    await mockUnauthenticated(page);
    await mockCommunitiesApi(page);

    // ページ 1 の投稿。nextCursor を返してページ 2 があることを示す。
    // スクロール前にセンチネルがビューポートに入らないよう十分な件数を用意する。
    const page1Posts = [
      { ...MOCK_POST_1, id: "post-p1-1", title: "ページ1投稿1", seq: 0 },
      { ...MOCK_POST_1, id: "post-p1-2", title: "ページ1投稿2", seq: 1 },
      { ...MOCK_POST_1, id: "post-p1-3", title: "ページ1投稿3", seq: 2 },
      { ...MOCK_POST_1, id: "post-p1-4", title: "ページ1投稿4", seq: 3 },
      { ...MOCK_POST_1, id: "post-p1-5", title: "ページ1投稿5", seq: 4 },
      { ...MOCK_POST_1, id: "post-p1-6", title: "ページ1投稿6", seq: 5 },
      { ...MOCK_POST_1, id: "post-p1-7", title: "ページ1投稿7", seq: 6 },
      { ...MOCK_POST_1, id: "post-p1-8", title: "ページ1投稿8", seq: 7 },
    ];
    // ページ 2 の投稿。nextCursor=null でこれ以上ページがないことを示す。
    const page2Posts = [
      { ...MOCK_POST_2, id: "post-p2-1", title: "ページ2投稿1", seq: 0 },
      { ...MOCK_POST_2, id: "post-p2-2", title: "ページ2投稿2", seq: 1 },
    ];

    let feedCallCount = 0;
    await page.route("**/api/feed", (route) => {
      feedCallCount++;
      if (feedCallCount === 1) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ posts: page1Posts, nextCursor: "cursor-page-2" }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ posts: page2Posts, nextCursor: null }),
      });
    });

    await page.goto("/");

    // ページ 1 の投稿が表示されることを確認
    await expect(page.getByRole("heading", { name: "ページ1投稿1", level: 3 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "ページ1投稿3", level: 3 })).toBeVisible();

    // ページ 2 がまだ DOM に存在しないことを確認
    await expect(
      page.getByRole("heading", { name: "ページ2投稿1", level: 3 }),
    ).not.toBeAttached();

    // main 要素を一番下にスクロールして IntersectionObserver のセンチネルを表示させる
    await page.locator("main").evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });

    // ページ 2 の投稿が追加表示されることを確認
    await expect(page.getByRole("heading", { name: "ページ2投稿1", level: 3 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "ページ2投稿2", level: 3 })).toBeVisible();
  },
);

test("UC-HOME-04: ログイン済みユーザーは投稿に upvote できる", async ({ page }) => {
  await mockAuthenticated(page);
  await mockCommunitiesApi(page);

  const initialScore = MOCK_POST_1.score; // 5
  const updatedPost = { ...MOCK_POST_1, score: initialScore + 1 }; // 6

  // feed の 2 回目のレスポンス（vote 後の再フェッチ）で更新スコアを返す
  let feedCallCount = 0;
  await page.route("**/api/feed", (route) => {
    feedCallCount++;
    const post = feedCallCount === 1 ? MOCK_POST_1 : updatedPost;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ posts: [post], nextCursor: null }),
    });
  });

  // vote API のモック
  await page.route(`**/api/posts/${MOCK_POST_1.id}/vote`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(updatedPost),
    }),
  );

  await page.goto("/");

  // 初期スコアの確認
  await expect(page.getByText(String(initialScore))).toBeVisible();

  // up vote ボタンをクリック
  await page.getByRole("button", { name: "up vote" }).first().click();

  // vote 後のスコア更新を確認（feed 再フェッチで反映）
  await expect(page.getByText(String(initialScore + 1))).toBeVisible();
});

test("UC-HOME-05: 投稿が 0 件のとき空状態の案内が表示される", async ({ page }) => {
  await mockUnauthenticated(page);
  await mockCommunitiesApi(page);
  await mockFeedApi(page, { posts: [], nextCursor: null });

  await page.goto("/");

  await expect(page.getByText("まだ投稿がありません。")).toBeVisible();
  await expect(page.getByRole("button", { name: "コミュニティを探す" })).toBeVisible();
});

test(
  "UC-HOME-06: フィード取得に失敗したとき再試行付きエラーフォールバックが表示される",
  async ({ page }) => {
    await mockUnauthenticated(page);
    await mockCommunitiesApi(page);

    let feedCallCount = 0;
    await page.route("**/api/feed", (route) => {
      feedCallCount++;
      // 1 回目: 500 エラーでエラーバウンダリを発火させる
      if (feedCallCount === 1) {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Internal Server Error" }),
        });
      }
      // 2 回目以降（再試行）: 成功させる
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ posts: [MOCK_POST_1], nextCursor: null }),
      });
    });

    await page.goto("/");

    // エラーフォールバックが表示される
    await expect(page.getByText("データの取得に失敗しました。")).toBeVisible();
    const retryButton = page.getByRole("button", { name: "再試行" });
    await expect(retryButton).toBeVisible();

    // 再試行ボタンクリックで再フェッチされ、投稿が表示される
    await retryButton.click();
    await expect(
      page.getByRole("heading", { name: MOCK_POST_1.title, level: 3 }),
    ).toBeVisible();
  },
);

test("UC-HOME-07: 投稿カードの発言者がアバター画像＋表示名で表示される（#479）", async ({
  page,
}) => {
  await mockUnauthenticated(page);
  await mockCommunitiesApi(page);

  // 画像なし（フォールバックアバター）のワーカーと画像ありのワーカーを混在させる
  const postWithImage = { ...MOCK_POST_2 }; // image_url: "https://..."
  const postWithoutImage = { ...MOCK_POST_1 }; // image_url: null → 頭文字フォールバック

  await mockFeedApi(page, { posts: [postWithImage, postWithoutImage], nextCursor: null });

  await page.goto("/");

  // 画像ありワーカー: 表示名が見える
  await expect(page.getByText(MOCK_POST_2.author_worker.display_name)).toBeVisible();
  // 画像なしワーカー: 表示名が見える（生の author 文字列ではなく worker の display_name）
  await expect(page.getByText(MOCK_POST_1.author_worker.display_name)).toBeVisible();
  // 生の author 文字列（worker ID）は表示されない
  await expect(page.getByText(MOCK_POST_1.author, { exact: true })).not.toBeVisible();
});

test(
  "UC-HOME-08: 未ログインユーザーが vote を押すとログイン誘導が表示される（#481）",
  async ({ page }) => {
    await mockUnauthenticated(page);
    await mockCommunitiesApi(page);
    await mockFeedApi(page, { posts: [MOCK_POST_1], nextCursor: null });

    await page.goto("/");

    // 未ログイン状態で up vote ボタンをクリック
    await page.getByRole("button", { name: "up vote" }).first().click();

    // ログイン誘導スナックバーが表示される
    await expect(page.getByText("投票するにはログインが必要です")).toBeVisible();
    // スコアは変化しない（API は呼ばれない）
    await expect(page.getByText(String(MOCK_POST_1.score))).toBeVisible();
  },
);

test("UC-HOME-09: 投稿カードにコメント数（💬 N）が表示される（#500）", async ({ page }) => {
  await mockUnauthenticated(page);
  await mockCommunitiesApi(page);

  const postWithComments = { ...MOCK_POST_1, comment_count: 5 };
  const postNoComments = { ...MOCK_POST_2, comment_count: 0 };
  await mockFeedApi(page, { posts: [postWithComments, postNoComments], nextCursor: null });

  await page.goto("/");

  // コメント数がアクセシブルラベル付きで表示される
  await expect(page.getByLabel("コメント 5 件")).toBeVisible();
  await expect(page.getByLabel("コメント 0 件")).toBeVisible();
});

test("UC-HOME-11: 投稿カードに投稿時刻（相対時間）が表示される（#502）", async ({ page }) => {
  await mockUnauthenticated(page);
  await mockCommunitiesApi(page);
  await mockFeedApi(page, { posts: [MOCK_POST_1], nextCursor: null });

  await page.goto("/");

  // PostedTime は <time> 要素でレンダリングされる
  const timeEl = page.locator("time").first();
  await expect(timeEl).toBeVisible();
  // dateTime 属性が ISO 形式の絶対時刻を持つ
  const dateTime = await timeEl.getAttribute("datetime");
  expect(dateTime).toBeTruthy();
  expect(new Date(dateTime!).getTime()).not.toBeNaN();
  // 表示テキストが相対時間（"前" を含む）であること
  const text = await timeEl.textContent();
  expect(text).toMatch(/前/);
});

test(
  "UC-HOME-12: ホームの各投稿に所属コミュニティ名（c/slug）が表示される（#503）",
  async ({ page }) => {
    await mockUnauthenticated(page);
    await mockCommunitiesApi(page, [MOCK_COMMUNITY]);
    await mockFeedApi(page, { posts: [MOCK_POST_1], nextCursor: null });

    // コミュニティページの API をモック（遷移後のページが壊れないよう）
    await page.route(`**/api/communities/${MOCK_COMMUNITY.slug}/feed`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      }),
    );
    await page.route(`**/api/communities/${MOCK_COMMUNITY.slug}/recent-workers`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      }),
    );

    await page.goto("/");

    // 所属コミュニティ名（c/slug 形式）が表示される
    const communityByline = page.getByText(`c/${MOCK_COMMUNITY.slug}`);
    await expect(communityByline).toBeVisible();

    // c/slug をクリックするとコミュニティページへ遷移する
    await communityByline.click();
    await expect(page).toHaveURL(`/communities/${MOCK_COMMUNITY.slug}`);
  },
);
