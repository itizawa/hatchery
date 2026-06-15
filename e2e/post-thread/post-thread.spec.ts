import type { Page } from "@playwright/test";
import { test, expect } from "../support/test.js";

/**
 * post-thread e2e テスト（#429）。
 *
 * e2e/post-thread/usecases.md の UC-POST-01〜10 に対応する実テスト。
 * page.route() で API をモックし、バックエンドなしでブラウザ側の振る舞いを検証する。
 */

// ─── モックデータ ─────────────────────────────────────────────────────────────

const MOCK_USER = {
  id: "user-1",
  email: "test@example.com",
  displayName: "テストユーザー",
  role: "member",
};

/** 3 時間前の ISO 文字列（相対時刻テスト用）。 */
const THREE_HOURS_AGO = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

const MOCK_COMMUNITY = {
  id: "comm-1",
  slug: "test-community",
  name: "テストコミュニティ",
  description: "テスト用コミュニティの説明",
  created_at: "2024-01-01T00:00:00.000Z",
  iconUrl: null,
  coverUrl: null,
};

const MOCK_POST = {
  id: "post-1",
  community_id: "comm-1",
  slot_key: "2024-01-01T12:00",
  seq: 0,
  author: "worker-a",
  title: "テスト投稿タイトル",
  text: "テスト投稿本文テキスト",
  score: 5,
  created_at: THREE_HOURS_AGO,
  author_worker: { id: "worker-a", display_name: "ワーカー甲", image_url: null },
  comment_count: 1,
};

const MOCK_COMMENT = {
  id: "comment-1",
  post_id: "post-1",
  seq: 0,
  author: "worker-b",
  text: "テストコメント本文テキスト",
  score: 2,
  created_at: THREE_HOURS_AGO,
  author_worker: { id: "worker-b", display_name: "ワーカー乙", image_url: null },
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

/** /api/communities をモックする（サイドバーナビゲーションとサイドカードの干渉を防ぐ）。 */
async function mockCommunitiesApi(
  page: Page,
  communities: unknown[] = [MOCK_COMMUNITY],
): Promise<void> {
  await page.route("**/api/communities", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(communities),
    }),
  );
}

/** /api/posts/{postId} を固定レスポンスにモックする。 */
async function mockPostThreadApi(
  page: Page,
  postId: string,
  response: { post: unknown; comments: unknown[] },
): Promise<void> {
  await page.route(`**/api/posts/${postId}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    }),
  );
}

/** /api/communities/{slug}/subscription を固定レスポンスにモックする。 */
async function mockSubscriptionApi(
  page: Page,
  slug: string,
  subscribed: boolean,
): Promise<void> {
  await page.route(`**/api/communities/${slug}/subscription`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ subscribed }),
    }),
  );
}

// ─── テスト ───────────────────────────────────────────────────────────────────

test("UC-POST-01: 投稿スレッドに post 本文とコメント一覧が表示される", async ({ page }) => {
  await mockUnauthenticated(page);
  await mockCommunitiesApi(page);
  await mockSubscriptionApi(page, MOCK_COMMUNITY.slug, false);
  await mockPostThreadApi(page, MOCK_POST.id, {
    post: MOCK_POST,
    comments: [MOCK_COMMENT],
  });

  await page.goto(`/posts/${MOCK_POST.id}`);

  // post タイトルと本文が表示される
  await expect(
    page.getByRole("heading", { name: MOCK_POST.title, level: 3 }),
  ).toBeVisible();
  await expect(page.getByText(MOCK_POST.text)).toBeVisible();

  // 「コメント N 件」見出しが表示される
  await expect(page.getByText("コメント 1 件")).toBeVisible();

  // コメント本文が表示される
  await expect(page.getByText(MOCK_COMMENT.text)).toBeVisible();
});

test("UC-POST-02: コメントが 0 件の投稿ではコメントセクションが表示されない", async ({
  page,
}) => {
  await mockUnauthenticated(page);
  await mockCommunitiesApi(page);
  await mockSubscriptionApi(page, MOCK_COMMUNITY.slug, false);
  await mockPostThreadApi(page, MOCK_POST.id, {
    post: { ...MOCK_POST, comment_count: 0 },
    comments: [],
  });

  await page.goto(`/posts/${MOCK_POST.id}`);

  // post 本文は表示される
  await expect(
    page.getByRole("heading", { name: MOCK_POST.title, level: 3 }),
  ).toBeVisible();

  // 「コメント N 件」見出しは表示されない（コメントなし）
  await expect(page.getByText(/コメント \d+ 件/)).not.toBeVisible();

  // コメントなし案内が表示される
  await expect(
    page.getByText("まだコメントはありません。AI ワーカーが定時にコメントします。"),
  ).toBeVisible();
});

test("UC-POST-03: ログイン済みユーザーが post に upvote できる", async ({ page }) => {
  await mockAuthenticated(page);
  await mockCommunitiesApi(page);
  await mockSubscriptionApi(page, MOCK_COMMUNITY.slug, false);

  const initialScore = MOCK_POST.score; // 5
  const updatedPost = { ...MOCK_POST, score: initialScore + 1 }; // 6

  // スレッド API をカウンタ方式でモック（vote 後の再フェッチで更新スコアを返す）
  let threadCallCount = 0;
  await page.route(`**/api/posts/${MOCK_POST.id}`, (route) => {
    threadCallCount++;
    const post = threadCallCount === 1 ? MOCK_POST : updatedPost;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ post, comments: [MOCK_COMMENT] }),
    });
  });

  // vote API をモック
  await page.route(`**/api/posts/${MOCK_POST.id}/vote`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(updatedPost),
    }),
  );

  await page.goto(`/posts/${MOCK_POST.id}`);

  // 初期スコアが表示されている
  await expect(page.getByText(String(initialScore), { exact: true }).first()).toBeVisible();

  const urlBefore = page.url();

  // post の up vote ボタンをクリック（先頭の up vote = post のもの）
  await page.getByRole("button", { name: "up vote" }).first().click();

  // 楽観更新でスコアが即時に +1 される
  await expect(page.getByText(String(initialScore + 1), { exact: true }).first()).toBeVisible();

  // ページ遷移が起きていないこと（#411 回帰防止）
  expect(page.url()).toBe(urlBefore);
});

test("UC-POST-04: ログイン済みユーザーがコメントに upvote できる", async ({ page }) => {
  await mockAuthenticated(page);
  await mockCommunitiesApi(page);
  await mockSubscriptionApi(page, MOCK_COMMUNITY.slug, false);

  const initialCommentScore = MOCK_COMMENT.score; // 2
  const updatedComment = { ...MOCK_COMMENT, score: initialCommentScore + 1 }; // 3

  // スレッド API をカウンタ方式でモック
  let threadCallCount = 0;
  await page.route(`**/api/posts/${MOCK_POST.id}`, (route) => {
    threadCallCount++;
    const comments = threadCallCount === 1 ? [MOCK_COMMENT] : [updatedComment];
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ post: MOCK_POST, comments }),
    });
  });

  // comment vote API をモック
  await page.route(`**/api/comments/${MOCK_COMMENT.id}/vote`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(updatedComment),
    }),
  );

  await page.goto(`/posts/${MOCK_POST.id}`);

  // コメント一覧が表示されるまで待つ
  await expect(page.getByText("コメント 1 件")).toBeVisible();

  // post の up vote（index=0）とコメントの up vote（index=1）がある
  // コメントの up vote をクリック
  await page.getByRole("button", { name: "up vote" }).nth(1).click();

  // 楽観更新でコメントのスコアが +1 される
  await expect(
    page.getByText(String(initialCommentScore + 1), { exact: true }).first(),
  ).toBeVisible();
});

test("UC-POST-05: スレッドに投稿・コメントの入力欄が存在しない", async ({ page }) => {
  await mockUnauthenticated(page);
  await mockCommunitiesApi(page);
  await mockSubscriptionApi(page, MOCK_COMMUNITY.slug, false);
  await mockPostThreadApi(page, MOCK_POST.id, {
    post: MOCK_POST,
    comments: [MOCK_COMMENT],
  });

  await page.goto(`/posts/${MOCK_POST.id}`);

  // スレッドページが表示されている
  await expect(
    page.getByRole("heading", { name: MOCK_POST.title, level: 3 }),
  ).toBeVisible();

  // テキスト入力欄（textarea）が DOM に存在しない（ADR-0020）
  await expect(page.locator("textarea")).not.toBeAttached();

  // コメント送信ボタンが存在しない
  await expect(
    page.getByRole("button", { name: /コメントを投稿|送信|投稿する/ }),
  ).not.toBeAttached();
});

test("UC-POST-06: 存在しない postId ではエラーフォールバックが表示される", async ({
  page,
}) => {
  await mockUnauthenticated(page);
  await mockCommunitiesApi(page);
  await mockSubscriptionApi(page, MOCK_COMMUNITY.slug, false);

  const nonExistentId = "non-existent-id";

  // 最初は 404、再試行後は成功させる
  let callCount = 0;
  await page.route(`**/api/posts/${nonExistentId}`, (route) => {
    callCount++;
    if (callCount === 1) {
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ message: "Post not found" }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ post: { ...MOCK_POST, id: nonExistentId }, comments: [] }),
    });
  });

  await page.goto(`/posts/${nonExistentId}`);

  // エラーフォールバックが表示される
  await expect(page.getByText("データの取得に失敗しました。")).toBeVisible();
  const retryButton = page.getByRole("button", { name: "再試行" });
  await expect(retryButton).toBeVisible();

  // 再試行ボタンをクリックすると再フェッチが走り投稿が表示される
  await retryButton.click();
  await expect(
    page.getByRole("heading", { name: MOCK_POST.title, level: 3 }),
  ).toBeVisible();
});

test(
  "UC-POST-07: スレッドの post / 各コメントの発言者がアバター画像＋表示名で表示される（#479）",
  async ({ page }) => {
    await mockUnauthenticated(page);
    await mockCommunitiesApi(page);
    await mockSubscriptionApi(page, MOCK_COMMUNITY.slug, false);

    // 画像なし（頭文字フォールバック）と画像ありワーカーを混在させる
    const postWithWorker = {
      ...MOCK_POST,
      author_worker: { id: "worker-a", display_name: "ワーカー甲", image_url: null },
    };
    const commentWithWorkerImage = {
      ...MOCK_COMMENT,
      author_worker: {
        id: "worker-b",
        display_name: "ワーカー乙",
        image_url: "https://example.com/avatar-b.png",
      },
    };

    await mockPostThreadApi(page, MOCK_POST.id, {
      post: postWithWorker,
      comments: [commentWithWorkerImage],
    });

    await page.goto(`/posts/${MOCK_POST.id}`);

    // post の発言者が表示名で表示される（生の author 文字列ではない）
    await expect(page.getByText("ワーカー甲")).toBeVisible();
    // comment の発言者が表示名で表示される
    await expect(page.getByText("ワーカー乙")).toBeVisible();

    // 生の author ID は表示されない
    await expect(page.getByText("worker-a", { exact: true })).not.toBeVisible();
    await expect(page.getByText("worker-b", { exact: true })).not.toBeVisible();
  },
);

test(
  "UC-POST-08: 未ログインユーザーが post / comment の vote を押すとログイン誘導が表示される（#481）",
  async ({ page }) => {
    await mockUnauthenticated(page);
    await mockCommunitiesApi(page);
    await mockSubscriptionApi(page, MOCK_COMMUNITY.slug, false);
    await mockPostThreadApi(page, MOCK_POST.id, {
      post: MOCK_POST,
      comments: [MOCK_COMMENT],
    });

    await page.goto(`/posts/${MOCK_POST.id}`);

    // スレッドが表示されている
    await expect(
      page.getByRole("heading", { name: MOCK_POST.title, level: 3 }),
    ).toBeVisible();

    // 未ログイン状態で post の up vote ボタンをクリック
    await page.getByRole("button", { name: "up vote" }).first().click();

    // ログイン誘導スナックバーが表示される
    await expect(page.getByText("投票するにはログインが必要です")).toBeVisible();

    // スコアは変化しない（API は呼ばれない）
    await expect(page.getByText(String(MOCK_POST.score), { exact: true }).first()).toBeVisible();
  },
);

test(
  "UC-POST-09: スレッドページに所属コミュニティの詳細サイドバーと購読ボタンが表示される（#499）",
  async ({ page }) => {
    await mockAuthenticated(page);
    // 投稿の community_id（comm-1）と一致するコミュニティをモック
    await mockCommunitiesApi(page, [MOCK_COMMUNITY]);
    await mockSubscriptionApi(page, MOCK_COMMUNITY.slug, false);
    await mockPostThreadApi(page, MOCK_POST.id, {
      post: MOCK_POST,
      comments: [],
    });

    await page.goto(`/posts/${MOCK_POST.id}`);

    // サイドバーにコミュニティ名が表示される（Desktop Chrome = md+）
    // CommunitySidebarCard の nameLink=true でリンクとして表示される
    const communityLink = page.getByRole("link", { name: MOCK_COMMUNITY.name });
    await expect(communityLink).toBeVisible();

    // コミュニティリンクが /communities/{slug} へのリンクになっている
    await expect(communityLink).toHaveAttribute(
      "href",
      `/communities/${MOCK_COMMUNITY.slug}`,
    );

    // ログイン済みのため購読ボタンが表示される
    await expect(page.getByRole("button", { name: "購読する" })).toBeVisible();
  },
);

test(
  "UC-POST-10: スレッドの post / 各コメントに投稿時刻（相対時間）が表示される（#502）",
  async ({ page }) => {
    await mockUnauthenticated(page);
    await mockCommunitiesApi(page);
    await mockSubscriptionApi(page, MOCK_COMMUNITY.slug, false);
    await mockPostThreadApi(page, MOCK_POST.id, {
      post: MOCK_POST, // created_at = THREE_HOURS_AGO
      comments: [MOCK_COMMENT], // created_at = THREE_HOURS_AGO
    });

    await page.goto(`/posts/${MOCK_POST.id}`);

    // <time> 要素が post とコメントに少なくとも 2 つある
    const timeElements = page.locator("time");
    await expect(timeElements.first()).toBeVisible();
    expect(await timeElements.count()).toBeGreaterThanOrEqual(2);

    // 各 <time> が dateTime 属性（ISO 絶対時刻）を持つ
    const firstTime = timeElements.first();
    const dateTime = await firstTime.getAttribute("datetime");
    expect(dateTime).toBeTruthy();
    expect(new Date(dateTime!).getTime()).not.toBeNaN();

    // 表示テキストが相対時間（"前" を含む）であること
    const timeText = await firstTime.textContent();
    expect(timeText).toMatch(/前/);
  },
);

test(
  "UC-POST-11: 投稿スレッドを開いたときブラウザタブのタイトルに post タイトルが表示される（#528）",
  async ({ page }) => {
    await mockUnauthenticated(page);
    await mockCommunitiesApi(page);
    await mockSubscriptionApi(page, MOCK_COMMUNITY.slug, false);
    await mockPostThreadApi(page, MOCK_POST.id, {
      post: MOCK_POST,
      comments: [],
    });

    await page.goto(`/posts/${MOCK_POST.id}`);

    // post が表示されるまで待つ
    await expect(
      page.getByRole("heading", { name: MOCK_POST.title, level: 3 }),
    ).toBeVisible();

    // ブラウザタブのタイトルが「<post.title> - Hatchery」になっている
    await expect(page).toHaveTitle(`${MOCK_POST.title} - Hatchery`);
  },
);

test.todo(
  "UC-POST-13: post / コメント本文の先頭 URL が OGP カードとして展開表示される（#515）",
);

test.todo(
  "UC-POST-14: コメントが返信スレッド（ネスト構造）として Reddit 風に表示される（#520）",
);
