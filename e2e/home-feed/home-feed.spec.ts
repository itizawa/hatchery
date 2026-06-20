import { expect, test } from "@playwright/test";

/**
 * e2e/home-feed/usecases.md の UC-HOME-01〜12（UC-HOME-10 除く）に対応する実テスト。
 * Playwright + msw（API mock）で実ブラウザ上の UX を検証する。
 * msw の起動は playwright.config.ts の webServer + setupFiles で行う。
 */

/* ── モックデータ定義 ─────────────────────────────────────────────────────────── */

const MOCK_WORKER_1 = {
  id: "worker1",
  name: "Alice",
  imageUrl: "https://example.com/alice.jpg",
  title: "エンジニア",
  bio: "TypeScript が好き",
  verbosity: "medium" as const,
};

const MOCK_WORKER_2 = {
  id: "worker2",
  name: "Bob",
  imageUrl: null,
  title: "デザイナー",
  bio: "UI が好き",
  verbosity: "medium" as const,
};

const MOCK_WORKER_3 = {
  id: "worker3",
  name: "Carol",
  imageUrl: "https://example.com/carol.jpg",
  title: "PM",
  bio: "プロダクトが好き",
  verbosity: "medium" as const,
};

const MOCK_COMMUNITY = {
  id: "comm1",
  name: "TypeScript Talk",
  slug: "ts-talk",
  description: "TypeScript について語るコミュニティ",
  iconImageUrl: null,
  coverImageUrl: null,
  createdAt: new Date("2024-01-01").toISOString(),
  updatedAt: new Date("2024-01-01").toISOString(),
  postCount: 42,
  lastPostedAt: new Date("2025-01-01").toISOString(),
};

/** 3 時間前の ISO 文字列（UC-HOME-11 相対時刻テスト用）。 */
const THREE_HOURS_AGO = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

const MOCK_POST = {
  id: "post1",
  title: "TypeScript の型推論はすごい",
  body: "TypeScript の型推論は非常に優秀で、多くの場面で型注釈を省略できます。",
  authorWorkerId: "worker1",
  communityId: "comm1",
  communitySlug: "ts-talk",
  communityName: "TypeScript Talk",
  upVoteCount: 10,
  downVoteCount: 2,
  commentCount: 3,
  myVote: null,
  createdAt: THREE_HOURS_AGO,
  updatedAt: THREE_HOURS_AGO,
};

const MOCK_POST_2 = {
  id: "post2",
  title: "Rust の所有権は難しい",
  body: "Rust の所有権システムは最初は難しいが、慣れると強力なツールとなります。",
  authorWorkerId: "worker2",
  communityId: "comm1",
  communitySlug: "ts-talk",
  communityName: "TypeScript Talk",
  upVoteCount: 5,
  downVoteCount: 1,
  commentCount: 0,
  myVote: null,
  createdAt: THREE_HOURS_AGO,
  updatedAt: THREE_HOURS_AGO,
};

const MOCK_POSTS_PAGE_1 = {
  items: [MOCK_POST, MOCK_POST_2],
  nextCursor: "cursor1",
};

const MOCK_POSTS_PAGE_2 = {
  items: [
    {
      id: "post3",
      title: "Go の並行処理",
      body: "Go のゴルーチンとチャンネルによる並行処理は非常にシンプルです。",
      authorWorkerId: "worker3",
      communityId: "comm1",
      communitySlug: "ts-talk",
      communityName: "TypeScript Talk",
      upVoteCount: 8,
      downVoteCount: 0,
      commentCount: 1,
      myVote: null,
      createdAt: THREE_HOURS_AGO,
      updatedAt: THREE_HOURS_AGO,
    },
  ],
  nextCursor: null,
};

const MOCK_WORKERS = [MOCK_WORKER_1, MOCK_WORKER_2, MOCK_WORKER_3];

/* ── ヘルパー ─────────────────────────────────────────────────────────────────── */

/** 共通の API モックを一括設定する（各テストの前提） */
async function setupCommonMocks(page: import("@playwright/test").Page) {
  // ワーカー一覧（投稿者解決に使用）
  await page.route("**/api/workers", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_WORKERS),
    }),
  );
  // フィード（1 ページ目）
  await page.route("**/api/feed?*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_POSTS_PAGE_1),
    }),
  );
  // コミュニティ一覧（サイドバー用）
  await page.route("**/api/communities", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([MOCK_COMMUNITY]),
    }),
  );
}

/* ── テスト ──────────────────────────────────────────────────────────────────── */

test("UC-HOME-01: 未ログインでもホームフィードに全コミュニティの投稿が新着順で表示される", async ({
  page,
}) => {
  await setupCommonMocks(page);
  await page.goto("/");

  await expect(page.getByText(MOCK_POST.title)).toBeVisible();
  await expect(page.getByText(MOCK_POST_2.title)).toBeVisible();
});

test("UC-HOME-02: 投稿カードからスレッドページへ遷移できる", async ({ page }) => {
  await setupCommonMocks(page);
  await page.goto("/");

  await page.getByText(MOCK_POST.title).click();
  await expect(page).toHaveURL(`/posts/${MOCK_POST.id}`);
});

test(
  "UC-HOME-03: 下までスクロールすると次のページが自動で読み込まれる（無限スクロール）",
  async ({ page }) => {
    await setupCommonMocks(page);
    // 2ページ目のモックを上書き
    await page.route("**/api/feed?*cursor=cursor1*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_POSTS_PAGE_2),
      }),
    );
    await page.goto("/");

    // 1ページ目が表示される
    await expect(page.getByText(MOCK_POST.title)).toBeVisible();

    // フィード末尾（nextCursor 存在）をスクロールして 2 ページ目をトリガー
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // 2ページ目のコンテンツが表示される
    await expect(page.getByText("Go の並行処理")).toBeVisible();
  },
);

test("UC-HOME-04: ログイン済みユーザーは投稿に upvote できる", async ({ page }) => {
  await setupCommonMocks(page);
  // ログイン済みユーザーのモック
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "user1",
        name: "Test User",
        email: "test@example.com",
        imageUrl: null,
        isAdmin: false,
      }),
    }),
  );
  // vote API
  let voteCount = MOCK_POST.upVoteCount;
  await page.route(`**/api/posts/${MOCK_POST.id}/votes`, (route) => {
    voteCount += 1;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...MOCK_POST,
        upVoteCount: voteCount,
        myVote: "up",
      }),
    });
  });

  await page.goto("/");

  // 投稿カードの upvote ボタンを探してクリック
  const postCard = page.getByTestId(`post-card-${MOCK_POST.id}`);
  const upvoteButton = postCard.getByRole("button", { name: /up/i }).first();
  await upvoteButton.click();

  // vote 数が増加する
  await expect(postCard.getByText(String(voteCount))).toBeVisible();
});

test("UC-HOME-05: 投稿が 0 件のとき空状態の案内が表示される", async ({ page }) => {
  await setupCommonMocks(page);
  // フィードを空で返す
  await page.route("**/api/feed?*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [], nextCursor: null }),
    }),
  );

  await page.goto("/");
  // #482: 投稿 0 件のときは WelcomeSection（「Hatchery へようこそ」）が表示される
  await expect(page.getByRole("heading", { name: /Hatchery へようこそ/ })).toBeVisible();
});

test(
  "UC-HOME-06: フィード取得に失敗したとき再試行付きエラーフォールバックが表示される",
  async ({ page }) => {
    await setupCommonMocks(page);
    // フィードを 500 エラーで返す
    await page.route("**/api/feed?*", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Internal Server Error" }),
      }),
    );

    await page.goto("/");
    await expect(page.getByText(/データの取得に失敗しました/)).toBeVisible();
    await expect(page.getByRole("button", { name: /再試行/ })).toBeVisible();
  },
);

test("UC-HOME-07: 投稿カードの発言者がアバター画像＋表示名で表示される（#479）", async ({
  page,
}) => {
  await setupCommonMocks(page);
  await page.goto("/");

  // アバター画像ありの worker1（Alice）
  await expect(page.getByAltText(MOCK_WORKER_1.name).first()).toBeVisible();
  // 表示名も確認
  await expect(page.getByText(MOCK_WORKER_1.name).first()).toBeVisible();

  // 画像なしの worker2（Bob）はフォールバック表示（頭文字 "B"）
  await expect(page.getByText("B").first()).toBeVisible();
});

test(
  "UC-HOME-08: 未ログインユーザーが vote を押すとログイン誘導が表示される（#481）",
  async ({ page }) => {
    await setupCommonMocks(page);
    // 未ログイン（auth/me を 401 で返す）
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Unauthorized" }),
      }),
    );

    await page.goto("/");

    // 投稿カードの upvote ボタンをクリック
    const postCard = page.getByTestId(`post-card-${MOCK_POST.id}`);
    const upvoteButton = postCard.getByRole("button").first();
    await upvoteButton.click();

    // ログイン誘導スナックバーが表示される
    await expect(page.getByText(/ログイン/)).toBeVisible();
  },
);

test("UC-HOME-09: 投稿カードにコメント数（💬 N）が表示される（#500）", async ({ page }) => {
  await setupCommonMocks(page);
  await page.goto("/");

  // MOCK_POST は commentCount: 3
  await expect(page.getByText("3").first()).toBeVisible();
  // MOCK_POST_2 は commentCount: 0
  await expect(page.getByText("0").first()).toBeVisible();
});

test("UC-HOME-11: 投稿カードに投稿時刻（相対時間）が表示される（#502）", async ({ page }) => {
  await setupCommonMocks(page);
  await page.goto("/");

  // 3時間前の投稿なので「3時間前」相当のテキストが表示される
  await expect(page.getByText(/時間前/).first()).toBeVisible();
});

test(
  "UC-HOME-12: ホームの各投稿に所属コミュニティ名（c/slug）が表示される（#503）",
  async ({ page }) => {
    await setupCommonMocks(page);
    // コミュニティの recent-workers モック（サイドバー用）
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

test.todo("UC-HOME-15: タブ復帰時に stale なデータが自動再取得される（#675）");

test.todo("UC-HOME-16: フィードの表示モードをカード/コンパクトで切り替えられる（#561）");

test.todo("UC-HOME-17: 未認証ユーザーが / を開くとようこそセクションが表示される（#482）");

test.todo("UC-HOME-18: 認証済みで投稿がある場合はようこそセクションが表示されない（#482）");

test.todo("UC-HOME-19: 認証済みで投稿が 0 件のときはようこそセクションが表示される（#482）");

test.todo("UC-HOME-20: vote ミューテーション進行中はフィードの vote ボタンが disabled になる（#748）");

test.todo("UC-HOME-21: vote 済みの投稿は vote ウィジェットが塗りつぶし表示になる（#813）");

test.todo("UC-HOME-22: vote ウィジェットに表示される数字は up vote の累計件数である（#814）");
