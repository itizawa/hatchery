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

test("UC-HOME-01: 未ログインでもホームフィードに全コミュニティの投稿が人気順で表示される", async ({
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
    // コミュニティ所属ワーカー一覧モック（サイドバー用・#1078）
    await page.route(`**/api/communities/${MOCK_COMMUNITY.slug}/workers`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [], nextCursor: null }),
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

test(
  "UC-HOME-15: タブ復帰時に stale なデータが自動再取得される（#675）",
  async ({ page }) => {
    // リクエストカウンターで再取得を検知する
    let feedRequestCount = 0;
    await page.route("**/api/feed?*", (route) => {
      feedRequestCount++;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ posts: [MOCK_POST, MOCK_POST_2], nextCursor: null }),
      });
    });
    await page.route("**/api/workers", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_WORKERS),
      }),
    );
    await page.route("**/api/communities", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([MOCK_COMMUNITY]),
      }),
    );

    // ブラウザのクロックを制御下に置く（staleTime の超過を仮想的に進める）
    await page.clock.install();
    await page.goto("/");

    // 初回フェッチが完了したことを確認
    await expect(page.getByText(MOCK_POST.title)).toBeVisible();
    const initialCount = feedRequestCount;

    // staleTime（30 秒）を超過させる（fastForward で仮想時間を進める）
    await page.clock.fastForward(31_000);

    // visibilitychange イベントを発火してタブ復帰を疑似再現する。
    // page.evaluate 内はブラウザコンテキストで実行されるため document / Event が利用可能。
    // tsconfig に "dom" lib が含まれていないため @ts-expect-error で型エラーを抑制する。
    await page.evaluate(() => {
      // @ts-expect-error -- ブラウザ内コンテキストでは document が存在する（e2e tsconfig に dom lib が無い）
      const doc = globalThis.document;
      Object.defineProperty(doc, "hidden", {
        value: false,
        configurable: true,
        writable: true,
      });
      // @ts-expect-error -- ブラウザ内コンテキストでは Event が存在する（e2e tsconfig に dom lib が無い）
      doc.dispatchEvent(new globalThis.Event("visibilitychange"));
    });

    // refetchOnWindowFocus が機能し、フィードが再取得されることを確認
    // （初回より多くリクエストが発生していること）
    // expect.poll で再試行しながら待機することでフレーキーテストを防ぐ
    await expect.poll(() => feedRequestCount, { timeout: 3000 }).toBeGreaterThan(initialCount);
  },
);

// UC-HOME-16: コンパクト表示モードは Issue #811 で廃止済み（useViewMode フック・compact prop を削除）。
// このユースケースに対応する UI が存在しないため test.skip とする。
// usecases.md の UC-HOME-16 エントリは廃止モードへの言及として残す（削除は別 Issue で対応）。
test("UC-HOME-16: フィードの表示モードをカード/コンパクトで切り替えられる（#561）", async () => {
  // コンパクト表示モードは Issue #811 で廃止された。対応する UI が存在しないためスキップ。
  test.skip(true, "コンパクト表示モードは Issue #811 で廃止済みのためスキップ");
});

test(
  "UC-HOME-17: 未認証ユーザーが / を開くとようこそセクションが表示される（#482）",
  async ({ page }) => {
    // 未ログイン（auth/me を 401 で返す）
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Unauthorized" }),
      }),
    );
    // フィードに投稿あり（posts形式）
    await page.route("**/api/feed?*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ posts: [MOCK_POST, MOCK_POST_2], nextCursor: null }),
      }),
    );
    await page.route("**/api/workers", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_WORKERS),
      }),
    );
    await page.route("**/api/communities", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([MOCK_COMMUNITY]),
      }),
    );

    await page.goto("/");

    // 未ログインの場合はようこそセクションが表示される（投稿の有無に関わらず）
    await expect(page.getByRole("heading", { name: /Hatchery へようこそ/ })).toBeVisible();
    // 「コミュニティを探す」ボタンも表示される
    await expect(page.getByRole("link", { name: "コミュニティを探す" })).toBeVisible();
  },
);

test(
  "UC-HOME-18: 認証済みで投稿がある場合はようこそセクションが表示されない（#482）",
  async ({ page }) => {
    // ログイン済み
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
    // フィードに投稿あり（posts形式）
    await page.route("**/api/feed?*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ posts: [MOCK_POST, MOCK_POST_2], nextCursor: null }),
      }),
    );
    await page.route("**/api/workers", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_WORKERS),
      }),
    );
    await page.route("**/api/communities", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([MOCK_COMMUNITY]),
      }),
    );

    await page.goto("/");

    // ログイン済み + 投稿ありの場合はようこそセクションが非表示になる
    await expect(page.getByRole("heading", { name: /Hatchery へようこそ/ })).toBeVisible({ visible: false });
    // 投稿一覧は表示される
    await expect(page.getByText(MOCK_POST.title)).toBeVisible();
  },
);

test(
  "UC-HOME-19: 認証済みで投稿が 0 件のときはようこそセクションが表示される（#482）",
  async ({ page }) => {
    // ログイン済み
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
    // フィードに投稿なし（空配列・posts形式）
    await page.route("**/api/feed?*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ posts: [], nextCursor: null }),
      }),
    );
    await page.route("**/api/workers", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_WORKERS),
      }),
    );
    await page.route("**/api/communities", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([MOCK_COMMUNITY]),
      }),
    );

    await page.goto("/");

    // ログイン済みでも投稿が 0 件の場合はようこそセクションが表示される
    await expect(page.getByRole("heading", { name: /Hatchery へようこそ/ })).toBeVisible();
    // 「コミュニティを探す」ボタンも表示される
    await expect(page.getByRole("link", { name: "コミュニティを探す" })).toBeVisible();
  },
);

/* ── UC-HOME-20〜23 用モックデータ（PostSchema / feed レスポンス形式に準拠） ──── */

/** UC-HOME-20〜23 で使う投稿モック（score=8 で UC-HOME-22 のネットスコア表示を検証）。 */
const MOCK_POST_VOTE = {
  id: "vote-test-post",
  community_id: "comm1",
  slot_key: "2025-01-01T10:00",
  seq: 0,
  author: "Alice",
  title: "TypeScript の型推論はすごい",
  text: "TypeScript の型推論は非常に優秀です。",
  score: 8,
  created_at: "2025-01-01T07:00:00.000Z",
  comment_count: 2,
  my_vote: null as "up" | "down" | null,
  author_worker: null,
};

const MOCK_COMMUNITY_VOTE = {
  id: "comm1",
  slug: "ts-talk",
  name: "TypeScript Talk",
  description: "TypeScript について語る",
  created_at: "2024-01-01T00:00:00.000Z",
  post_count: 1,
  last_post_at: "2025-01-01T07:00:00.000Z",
  subscriber_count: 0,
};

/** UC-HOME-20〜23 の共通 API モックを設定する。 */
async function setupVoteTestMocks({
  page,
  myVote = null,
}: {
  page: import("@playwright/test").Page;
  myVote?: "up" | "down" | null;
}) {
  const post = { ...MOCK_POST_VOTE, my_vote: myVote };
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Unauthorized" }),
    }),
  );
  await page.route("**/api/feed?*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ posts: [post], nextCursor: null }),
    }),
  );
  await page.route("**/api/communities", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([MOCK_COMMUNITY_VOTE]),
    }),
  );
}

test(
  "UC-HOME-20: vote ミューテーション進行中はフィードの vote ボタンが disabled になる（#748）",
  async ({ page }) => {
    await setupVoteTestMocks({ page });

    // vote API レスポンスを保留して mutation 進行中状態を再現する
    let resolveVote!: () => void;
    await page.route("**/api/posts/*/vote", async (route) => {
      await new Promise<void>((resolve) => {
        resolveVote = resolve;
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...MOCK_POST_VOTE, score: 9, my_vote: "up" }),
      });
    });

    await page.goto("/");
    await expect(page.getByText(MOCK_POST_VOTE.title)).toBeVisible();

    const upVoteButton = page.getByRole("button", { name: "up vote" }).first();

    // route handler が実行され resolveVote が代入されるのを確実に待つ
    const voteRequestPromise = page.waitForRequest("**/api/posts/*/vote");
    await upVoteButton.click();
    await voteRequestPromise;

    // ミューテーション進行中: up vote ボタンが disabled になる
    await expect(upVoteButton).toBeDisabled();

    // ミューテーション完了後: ボタンが再度有効化される
    resolveVote();
    await expect(upVoteButton).not.toBeDisabled();
  },
);

test(
  "UC-HOME-21: vote 済みの投稿は vote ウィジェットが塗りつぶし表示になる（#813）",
  async ({ page }) => {
    await setupVoteTestMocks({ page });
    await page.route("**/api/posts/*/vote", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...MOCK_POST_VOTE, score: 9, my_vote: "up" }),
      }),
    );

    await page.goto("/");
    await expect(page.getByText(MOCK_POST_VOTE.title)).toBeVisible();

    // 投票前: vote ウィジェットは未投票状態
    const voteWidget = page.locator("[data-voted]").first();
    await expect(voteWidget).toHaveAttribute("data-voted", "none");

    // up vote する
    await page.getByRole("button", { name: "up vote" }).first().click();

    // 投票後: vote ウィジェットが up 状態（塗りつぶし表示）になる（楽観更新で即座に変わる）
    await expect(voteWidget).toHaveAttribute("data-voted", "up");
  },
);

test(
  "UC-HOME-22: vote ウィジェットに表示される数字は up − down のネットスコアである（#856）",
  async ({ page }) => {
    // MOCK_POST_VOTE.score = 8 (up 10 - down 2 のネットスコア相当)
    await setupVoteTestMocks({ page });

    await page.goto("/");
    await expect(page.getByText(MOCK_POST_VOTE.title)).toBeVisible();

    // vote ウィジェット内に score（= 8）が表示される
    const voteWidget = page.locator("[data-voted]").first();
    await expect(voteWidget).toBeVisible();
    await expect(voteWidget.getByText(String(MOCK_POST_VOTE.score))).toBeVisible();
  },
);

test(
  "UC-HOME-23: ページリロード後もホームフィードの vote 状態が塗りつぶし表示で復元される（#831）",
  async ({ page }) => {
    let postMyVote: "up" | "down" | null = null;

    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Unauthorized" }),
      }),
    );
    // feed ルートはクロージャで postMyVote の最新値を読む（リロード後に my_vote: "up" を返す）
    await page.route("**/api/feed?*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ posts: [{ ...MOCK_POST_VOTE, my_vote: postMyVote }], nextCursor: null }),
      }),
    );
    await page.route("**/api/communities", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([MOCK_COMMUNITY_VOTE]),
      }),
    );
    await page.route("**/api/posts/*/vote", (route) => {
      postMyVote = "up";
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...MOCK_POST_VOTE, score: 9, my_vote: "up" }),
      });
    });

    await page.goto("/");
    await expect(page.getByText(MOCK_POST_VOTE.title)).toBeVisible();

    // up vote する（route handler 完了を待ってから reload することで postMyVote が確実に "up" になる）
    const voteResponsePromise = page.waitForResponse("**/api/posts/*/vote");
    await page.getByRole("button", { name: "up vote" }).first().click();
    await voteResponsePromise;

    // 投票後: vote ウィジェットが up 状態
    const voteWidget = page.locator("[data-voted]").first();
    await expect(voteWidget).toHaveAttribute("data-voted", "up");

    // ページをリロード（TanStack Query キャッシュはクリアされ、feed が再取得される）
    await page.reload();
    await expect(page.getByText(MOCK_POST_VOTE.title)).toBeVisible();

    // リロード後も vote 状態が復元される（feed が my_vote: "up" を返すため）
    await expect(page.locator("[data-voted]").first()).toHaveAttribute("data-voted", "up");
  },
);

test(
  "UC-HOME-24: フィードの投稿カードのコメント Chip をクリックすると /posts/$postId#comments へ遷移する（#836）",
  async ({ page }) => {
    await setupVoteTestMocks({ page });
    await page.goto("/");
    await expect(page.getByText(MOCK_POST_VOTE.title)).toBeVisible();

    // コメント数 Chip（aria-label="コメント N 件"）をクリック
    const commentChip = page.getByRole("button", {
      name: `コメント ${MOCK_POST_VOTE.comment_count} 件`,
    });
    await expect(commentChip).toBeVisible();
    await commentChip.click();

    // /posts/$postId#comments へ遷移することを確認
    await expect(page).toHaveURL(new RegExp(`/posts/${MOCK_POST_VOTE.id}#comments`));
  },
);

test(
  "UC-HOME-25: ホームフィードの投稿一覧が border-bottom のフラットリスト表示である（#834）",
  async ({ page }) => {
    await setupVoteTestMocks({ page });
    await page.goto("/");
    await expect(page.getByText(MOCK_POST_VOTE.title)).toBeVisible();

    // PostCard が list バリアントで描画される（data-variant="list"）
    await expect(page.locator('[data-variant="list"]').first()).toBeVisible();
    // card バリアントは使われていない
    await expect(page.locator('[data-variant="card"]')).not.toBeVisible();
  },
);

test(
  "UC-HOME-26: ホームフィードの各投稿カードに共有ボタンが表示される（#838）",
  async ({ page }) => {
    await setupVoteTestMocks({ page });
    await page.goto("/");
    // 右サイドバー（新着ポスト）にも同じ投稿タイトルが表示されるため、
    // メインリストの投稿カード見出し（h3）に絞り込む。
    await expect(page.getByRole("heading", { name: MOCK_POST_VOTE.title })).toBeVisible();

    // 投稿カード（data-variant="list"）内の共有ボタンを確認する
    const postCard = page.locator('[data-variant="list"]').first();
    const shareButton = postCard.getByLabel("共有");
    await expect(shareButton).toBeVisible();

    // 共有ボタンをクリックすると「URL をコピー」「X でシェア」の選択肢が表示される
    await shareButton.click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "URL をコピー" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "X でシェア" })).toBeVisible();
  },
);

test(
  "UC-HOME-32: 購読コミュニティの新着投稿に「New」ラベルが表示される（#935）",
  async ({ page }) => {
    const now = Date.now();
    const OLD_LAST_VIEWED_AT = new Date(now - 3 * 60 * 60 * 1000).toISOString();

    const SUBSCRIBED_COMMUNITY = MOCK_COMMUNITY_VOTE;
    const OTHER_COMMUNITY = {
      ...MOCK_COMMUNITY_VOTE,
      id: "comm2",
      slug: "other-talk",
      name: "Other Talk",
    };

    const SUBSCRIBED_NEW_POST = {
      ...MOCK_POST_VOTE,
      id: "post-subscribed-new",
      title: "購読中コミュニティの新着投稿",
      community_id: SUBSCRIBED_COMMUNITY.id,
      created_at: new Date(now - 30 * 60 * 1000).toISOString(),
    };
    const OTHER_COMMUNITY_NEW_POST = {
      ...MOCK_POST_VOTE,
      id: "post-other-new",
      title: "別コミュニティの新着投稿",
      community_id: OTHER_COMMUNITY.id,
      created_at: new Date(now - 30 * 60 * 1000).toISOString(),
    };

    let isAuthenticated = true;
    let lastViewedAt: string | null = OLD_LAST_VIEWED_AT;

    await page.route("**/api/auth/me", (route) =>
      isAuthenticated
        ? route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              id: "user1",
              name: "Test User",
              email: "test@example.com",
              imageUrl: null,
              isAdmin: false,
            }),
          })
        : route.fulfill({
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({ message: "Unauthorized" }),
          }),
    );
    await page.route("**/api/feed?*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          posts: [SUBSCRIBED_NEW_POST, OTHER_COMMUNITY_NEW_POST],
          nextCursor: null,
        }),
      }),
    );
    await page.route("**/api/communities", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([SUBSCRIBED_COMMUNITY, OTHER_COMMUNITY]),
      }),
    );
    // OTHER_COMMUNITY は購読していないため unread_counts に含めない
    await page.route("**/api/subscriptions/unread-counts", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          unread_counts: [
            {
              community_id: SUBSCRIBED_COMMUNITY.id,
              community_slug: SUBSCRIBED_COMMUNITY.slug,
              unread_count: lastViewedAt ? 1 : 0,
              last_viewed_at: lastViewedAt,
            },
          ],
        }),
      }),
    );

    const subscribedCard = page.locator(`[data-post-id="${SUBSCRIBED_NEW_POST.id}"]`);
    const otherCard = page.locator(`[data-post-id="${OTHER_COMMUNITY_NEW_POST.id}"]`);

    await page.goto("/");
    await expect(page.getByRole("heading", { name: SUBSCRIBED_NEW_POST.title })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: OTHER_COMMUNITY_NEW_POST.title }),
    ).toBeVisible();

    // 購読コミュニティの lastViewedAt より後の投稿のカードにのみ「New」チップが表示される
    // （未購読コミュニティの同時刻の投稿のカードには表示されない）
    await expect(subscribedCard.getByText("New", { exact: true })).toBeVisible();
    await expect(otherCard.getByText("New", { exact: true })).not.toBeVisible();

    // 未ログインの場合は「New」チップが一切表示されない
    isAuthenticated = false;
    await page.reload();
    await expect(page.getByRole("heading", { name: SUBSCRIBED_NEW_POST.title })).toBeVisible();
    await expect(subscribedCard.getByText("New", { exact: true })).not.toBeVisible();

    // lastViewedAt が null（初回購読直後）の場合も「New」チップは表示されない
    isAuthenticated = true;
    lastViewedAt = null;
    await page.reload();
    await expect(page.getByRole("heading", { name: SUBSCRIBED_NEW_POST.title })).toBeVisible();
    await expect(subscribedCard.getByText("New", { exact: true })).not.toBeVisible();
  },
);

/** UC-HOME-33/34 共通: スクロール可能な件数の投稿一覧 + 認証/フィード/コミュニティのモックを設定する。 */
async function setupScrollablePostsMocks({
  page,
  posts,
}: {
  page: import("@playwright/test").Page;
  posts: (typeof MOCK_POST_VOTE)[];
}) {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Unauthorized" }),
    }),
  );
  await page.route("**/api/feed?*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ posts, nextCursor: null }),
    }),
  );
  await page.route("**/api/communities", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([MOCK_COMMUNITY_VOTE]),
    }),
  );
}

test(
  "UC-HOME-33: フィードでスクロール後に別画面へ遷移し、ブラウザ戻るで元のスクロール位置が復元される（#950）",
  async ({ page }) => {
    // eslint-disable-next-line max-params -- Array.from の mapFn コールバック（CLAUDE.md 例外）
    const MANY_POSTS = Array.from({ length: 10 }, (_, i) => ({
      ...MOCK_POST_VOTE,
      id: `post-${i}`,
      title: `投稿タイトル${i}`,
    }));
    await setupScrollablePostsMocks({ page, posts: MANY_POSTS });
    const TARGET_POST = MANY_POSTS[0];
    await page.route(`**/api/posts/${TARGET_POST.id}*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ post: TARGET_POST, comments: [], related_posts: [] }),
      }),
    );

    await page.goto("/");
    await expect(page.getByRole("heading", { name: TARGET_POST.title })).toBeVisible();

    // メインコンテンツ領域（<main data-scroll-restoration-id="main-content">）を下方向へスクロールする
    const mainContent = page.locator('[data-scroll-restoration-id="main-content"]');
    await mainContent.evaluate((el) => el.scrollTo(0, 500));
    await expect
      .poll(() => mainContent.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(300);
    const scrolledPosition = await mainContent.evaluate((el) => el.scrollTop);

    // 投稿カードのリンクを DOM 経由で直接クリックし、スレッドページへ遷移する。
    // Playwright の通常の click() は要素を自動でビューへスクロールし直す（actionability チェック）ため、
    // テストが設定したスクロール位置を上書きしてしまう（{ force: true } でもこのスクロールは回避できない）。
    await page.getByRole("heading", { name: TARGET_POST.title }).evaluate((el) => {
      (el.closest("a") as HTMLAnchorElement | null)?.click();
    });
    await expect(page).toHaveURL(`/posts/${TARGET_POST.id}`);

    // ブラウザの戻るでホームフィードへ戻る
    await page.goBack();
    await expect(page).toHaveURL("/");

    // 先頭（scrollTop: 0）ではなく、スクロールした位置（手順2の値）まで自動復元される
    await expect
      .poll(() => mainContent.evaluate((el) => el.scrollTop))
      .toBe(scrolledPosition);
  },
);

test(
  "UC-HOME-34: ホームフィードへ前方遷移（新規遷移）すると常に先頭（scrollTop: 0）から表示される（#950）",
  async ({ page }) => {
    // eslint-disable-next-line max-params -- Array.from の mapFn コールバック（CLAUDE.md 例外）
    const MANY_POSTS = Array.from({ length: 10 }, (_, i) => ({
      ...MOCK_POST_VOTE,
      id: `post-${i}`,
      title: `投稿タイトル${i}`,
    }));
    await setupScrollablePostsMocks({ page, posts: MANY_POSTS });

    await page.goto("/");
    await expect(page.getByRole("heading", { name: MANY_POSTS[0].title })).toBeVisible();

    const mainContent = page.locator('[data-scroll-restoration-id="main-content"]');
    await mainContent.evaluate((el) => el.scrollTo(0, 500));
    await expect
      .poll(() => mainContent.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(300);

    // サイドバーのリンクで別画面（/about）へ遷移する
    await page.getByRole("link", { name: "Hatcheryとは？" }).click();
    await expect(page).toHaveURL("/about");

    // サイドバーの「ホーム」リンクで / へ前方（新規）遷移する
    await page.getByRole("link", { name: "ホーム" }).click();
    await expect(page).toHaveURL("/");

    // 前の画面のスクロール位置は引き継がれず、常に先頭（scrollTop: 0）から表示される
    await expect
      .poll(() => mainContent.evaluate((el) => el.scrollTop))
      .toBe(0);
  },
);
