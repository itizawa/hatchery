import type { Page } from "@playwright/test";
import { test, expect } from "../support/test.js";

/**
 * community e2e テスト（#428）。
 *
 * e2e/community/usecases.md の UC-COMM-01〜10 に対応する実テスト。
 * page.route() で API をモックし、バックエンドなしでブラウザ側の挙動を検証する。
 */

// ─── モックデータ ─────────────────────────────────────────────────

const MOCK_USER = {
  id: "user-1",
  email: "test@example.com",
  displayName: "テストユーザー",
  role: "member",
};

const MOCK_COMMUNITY = {
  id: "comm-1",
  slug: "test-community",
  name: "テストコミュニティ",
  description: "テスト用コミュニティの説明",
  created_at: "2024-03-15T00:00:00.000Z",
  iconUrl: null,
  coverUrl: null,
  post_count: 3,
  last_post_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
};

const MOCK_COMMUNITY_WITH_IMAGES = {
  ...MOCK_COMMUNITY,
  id: "comm-2",
  slug: "image-community",
  name: "画像コミュニティ",
  iconUrl: "https://example.com/icon.png",
  coverUrl: "https://example.com/cover.png",
};

const MOCK_POST = {
  id: "post-1",
  community_id: "comm-1",
  slot_key: "2024-03-15T12:00",
  seq: 0,
  author: "worker-a",
  title: "テスト投稿タイトル",
  text: "テスト投稿本文",
  score: 3,
  created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  author_worker: { id: "worker-a", display_name: "ワーカー甲", image_url: null },
  comment_count: 2,
};

const MOCK_COMMUNITY_WORKERS = [
  { id: "worker-a", displayName: "ワーカー甲", role: "engineer", imageUrl: null },
  { id: "worker-b", displayName: "ワーカー乙", role: "designer", imageUrl: null },
];

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

async function mockAuthenticated(page: Page): Promise<void> {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_USER),
    }),
  );
}

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

async function mockFeedApi(page: Page): Promise<void> {
  await page.route("**/api/feed", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ posts: [], nextCursor: null }),
    }),
  );
}

async function mockCommunityFeedApi(
  page: Page,
  slug: string,
  posts: unknown[] = [MOCK_POST],
): Promise<void> {
  await page.route(`**/api/communities/${slug}/feed**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ posts, nextCursor: null }),
    }),
  );
}

async function mockCommunityWorkersApi(
  page: Page,
  slug: string,
  workers: unknown[] = MOCK_COMMUNITY_WORKERS,
): Promise<void> {
  await page.route(`**/api/communities/${slug}/workers`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: workers, nextCursor: null }),
    }),
  );
}

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

// ─── テスト ──────────────────────────────────────────────────────

test("UC-COMM-01: コミュニティ一覧（/communities）が未ログインでも閲覧できる", async ({
  page,
}) => {
  await mockUnauthenticated(page);
  await mockCommunitiesApi(page);
  await mockFeedApi(page);

  await page.goto("/communities");

  await expect(page.getByRole("heading", { name: "コミュニティを探す" })).toBeVisible();
  await expect(page.getByText(MOCK_COMMUNITY.name)).toBeVisible();
  await expect(page.getByText(MOCK_COMMUNITY.description)).toBeVisible();
  // 未ログイン状態：「ログイン」リンクが表示される
  await expect(page.getByRole("link", { name: "ログイン" })).toBeVisible();
});

test("UC-COMM-02: 一覧からコミュニティ詳細ページへ遷移できる", async ({ page }) => {
  await mockUnauthenticated(page);
  await mockCommunitiesApi(page);
  await mockFeedApi(page);
  await mockCommunityFeedApi(page, MOCK_COMMUNITY.slug);
  await mockCommunityWorkersApi(page, MOCK_COMMUNITY.slug);
  await mockSubscriptionApi(page, MOCK_COMMUNITY.slug, false);

  await page.goto("/communities");

  // コミュニティカードをクリックして詳細ページへ遷移
  await page.getByText(MOCK_COMMUNITY.name).click();

  await expect(page).toHaveURL(`/communities/${MOCK_COMMUNITY.slug}`);
  // コミュニティ名が表示される（ヘッダーに出る）
  await expect(
    page.getByRole("heading", { name: MOCK_COMMUNITY.name }).first(),
  ).toBeVisible();
});

test("UC-COMM-03: コミュニティ詳細に post 一覧とコミュニティ所属ワーカー一覧が表示される（#1078）", async ({
  page,
}) => {
  await mockUnauthenticated(page);
  await mockCommunitiesApi(page);
  await mockFeedApi(page);
  await mockCommunityFeedApi(page, MOCK_COMMUNITY.slug);
  await mockCommunityWorkersApi(page, MOCK_COMMUNITY.slug);
  await mockSubscriptionApi(page, MOCK_COMMUNITY.slug, false);

  await page.goto(`/communities/${MOCK_COMMUNITY.slug}`);

  // 投稿一覧が表示されることを確認
  await expect(page.getByRole("heading", { name: MOCK_POST.title })).toBeVisible();

  // コメント数が表示される（💬 N 形式）
  await expect(page.getByLabel("コメント 2 件")).toBeVisible();

  // サイドバーの作成日が正しくフォーマットされる（NaN年ではない）
  // 2024-03-15 UTC → "2024年3月15日 作成"
  await expect(page.getByText("2024年3月15日 作成")).toBeVisible();

  // コミュニティ所属ワーカーが表示される（#1078）
  await expect(page.getByText(MOCK_COMMUNITY_WORKERS[0].displayName)).toBeVisible();
});

test("UC-COMM-04: ログイン済みユーザーがコミュニティを購読できる", async ({ page }) => {
  await mockAuthenticated(page);
  await mockCommunitiesApi(page);
  await mockFeedApi(page);
  await mockCommunityFeedApi(page, MOCK_COMMUNITY.slug, []);
  await mockCommunityWorkersApi(page, MOCK_COMMUNITY.slug, []);

  // 購読状態: 最初は未購読、POST 後は購読済みに切り替え
  let subscriptionCallCount = 0;
  await page.route(`**/api/communities/${MOCK_COMMUNITY.slug}/subscription`, (route) => {
    subscriptionCallCount++;
    const subscribed = subscriptionCallCount > 1;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ subscribed }),
    });
  });
  await page.route(`**/api/communities/${MOCK_COMMUNITY.slug}/subscribe`, (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    }
    return route.continue();
  });

  await page.goto(`/communities/${MOCK_COMMUNITY.slug}`);

  // 初期状態: 購読するボタンが表示される
  const subscribeButton = page.getByRole("button", { name: "購読する" });
  await expect(subscribeButton).toBeVisible();

  // 購読するボタンをクリック
  await subscribeButton.click();

  // 購読済み状態に切り替わる
  await expect(page.getByRole("button", { name: "購読解除" })).toBeVisible();
});

test("UC-COMM-05: 購読済みコミュニティの購読を解除できる", async ({ page }) => {
  await mockAuthenticated(page);
  await mockCommunitiesApi(page);
  await mockFeedApi(page);
  await mockCommunityFeedApi(page, MOCK_COMMUNITY.slug, []);
  await mockCommunityWorkersApi(page, MOCK_COMMUNITY.slug, []);

  // 購読状態: 最初は購読済み、DELETE 後は未購読に切り替え
  let subscriptionCallCount = 0;
  await page.route(`**/api/communities/${MOCK_COMMUNITY.slug}/subscription`, (route) => {
    subscriptionCallCount++;
    const subscribed = subscriptionCallCount === 1;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ subscribed }),
    });
  });
  await page.route(`**/api/communities/${MOCK_COMMUNITY.slug}/subscribe`, (route) => {
    if (route.request().method() === "DELETE") {
      return route.fulfill({ status: 204 });
    }
    return route.continue();
  });

  await page.goto(`/communities/${MOCK_COMMUNITY.slug}`);

  // 初期状態: 購読解除ボタンが表示される
  const unsubscribeButton = page.getByRole("button", { name: "購読解除" });
  await expect(unsubscribeButton).toBeVisible();

  // 購読解除ボタンをクリック
  await unsubscribeButton.click();

  // 未購読状態に切り替わる
  await expect(page.getByRole("button", { name: "購読する" })).toBeVisible();
});

test("UC-COMM-06: 未ログインユーザーがコミュニティ詳細を閲覧するとログイン誘導ボタンが表示される（#882）", async ({ page }) => {
  await mockUnauthenticated(page);
  await mockCommunitiesApi(page);
  await mockFeedApi(page);
  await mockCommunityFeedApi(page, MOCK_COMMUNITY.slug);
  await mockCommunityWorkersApi(page, MOCK_COMMUNITY.slug);
  await mockSubscriptionApi(page, MOCK_COMMUNITY.slug, false);

  await page.goto(`/communities/${MOCK_COMMUNITY.slug}`);

  // post 一覧は表示される
  await expect(page.getByRole("heading", { name: MOCK_POST.title })).toBeVisible();
  // 「ログインして購読」ボタンが表示される
  await expect(page.getByRole("button", { name: "ログインして購読" })).toBeVisible();
  // 通常の購読/購読解除ボタンは表示されない
  await expect(page.getByRole("button", { name: "購読する" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "購読解除" })).not.toBeVisible();
});

test(
  "UC-COMM-07: コミュニティ詳細が Reddit 風ヘッダー（カバー＋重ねたアイコン＋name）で表示される",
  async ({ page }) => {
    // 画像あり / なし両コミュニティを用意
    await mockAuthenticated(page);
    await mockCommunitiesApi(page, [MOCK_COMMUNITY, MOCK_COMMUNITY_WITH_IMAGES]);
    await mockFeedApi(page);
    await mockCommunityFeedApi(page, MOCK_COMMUNITY.slug, []);
    await mockCommunityWorkersApi(page, MOCK_COMMUNITY.slug, []);
    await mockSubscriptionApi(page, MOCK_COMMUNITY.slug, false);

    await page.goto(`/communities/${MOCK_COMMUNITY.slug}`);

    // コミュニティ名見出しが表示される
    await expect(
      page.getByRole("heading", { name: MOCK_COMMUNITY.name }).first(),
    ).toBeVisible();

    // 画像未設定 → カバー <img> タグは描画されない（プレースホルダ矩形のみ）
    await expect(page.locator("[data-testid='community-cover-image']")).not.toBeAttached();

    // アイコンが未設定 → MUI Avatar が表示される（頭文字フォールバック）
    await expect(page.locator(".MuiAvatar-root").first()).toBeVisible();

    // 画像ありコミュニティへ遷移
    await mockCommunityFeedApi(page, MOCK_COMMUNITY_WITH_IMAGES.slug, []);
    await mockCommunityWorkersApi(page, MOCK_COMMUNITY_WITH_IMAGES.slug, []);
    await mockSubscriptionApi(page, MOCK_COMMUNITY_WITH_IMAGES.slug, false);

    await page.goto(`/communities/${MOCK_COMMUNITY_WITH_IMAGES.slug}`);

    // カバー画像が表示される
    await expect(page.locator("[data-testid='community-cover-image']")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: MOCK_COMMUNITY_WITH_IMAGES.name }).first(),
    ).toBeVisible();
  },
);

test(
  "UC-COMM-08: コミュニティ詳細のワーカー一覧取得に失敗してもページ本体は表示される（#1078）",
  async ({ page }) => {
    await mockUnauthenticated(page);
    await mockCommunitiesApi(page);
    await mockFeedApi(page);
    await mockCommunityFeedApi(page, MOCK_COMMUNITY.slug);
    await mockSubscriptionApi(page, MOCK_COMMUNITY.slug, false);

    // workers API を 500 エラーにモック（#1078）
    await page.route(`**/api/communities/${MOCK_COMMUNITY.slug}/workers`, (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Internal Server Error" }),
      }),
    );

    await page.goto(`/communities/${MOCK_COMMUNITY.slug}`);

    // ページ本体（コミュニティ名・post 一覧）は表示される
    await expect(
      page.getByRole("heading", { name: MOCK_COMMUNITY.name }).first(),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: MOCK_POST.title })).toBeVisible();

    // サイドバーのワーカー一覧セクションにエラー表示が出る
    await expect(page.getByText("読み込みに失敗しました")).toBeVisible();
  },
);

test("サイドバーの「コミュニティ」セクションを見出しクリックで開閉できる", async ({
  page,
}) => {
  await mockUnauthenticated(page);
  await mockCommunitiesApi(page);
  await mockFeedApi(page);

  await page.goto("/");

  // 初期状態: コミュニティ一覧と「探す」リンクが表示されている（展開状態）
  await expect(page.getByRole("link", { name: MOCK_COMMUNITY.name })).toBeVisible();
  await expect(page.getByRole("link", { name: "探す" })).toBeVisible();

  // サイドバーの「コミュニティ」見出しボタンをクリック（折りたたみ）
  const communityHeadingButton = page.getByRole("button", { name: "コミュニティ" });
  await communityHeadingButton.click();

  // 折りたたまれてコミュニティ一覧と「探す」リンクが見えなくなる
  await expect(page.getByRole("link", { name: MOCK_COMMUNITY.name })).not.toBeVisible();
  await expect(page.getByRole("link", { name: "探す" })).not.toBeVisible();

  // 再度クリックして展開
  await communityHeadingButton.click();

  // 再び一覧と「探す」リンクが表示される
  await expect(page.getByRole("link", { name: MOCK_COMMUNITY.name })).toBeVisible();
  await expect(page.getByRole("link", { name: "探す" })).toBeVisible();
});

test(
  "UC-COMM-10: コミュニティ詳細の共有メニューから URL をコピーでき、失敗時はエラーが表示される",
  async ({ page }) => {
    await mockUnauthenticated(page);
    await mockCommunitiesApi(page);
    await mockFeedApi(page);
    await mockCommunityFeedApi(page, MOCK_COMMUNITY.slug);
    await mockCommunityWorkersApi(page, MOCK_COMMUNITY.slug);
    await mockSubscriptionApi(page, MOCK_COMMUNITY.slug, false);

    await page.goto(`/communities/${MOCK_COMMUNITY.slug}`);

    // === コピー成功ケース ===
    // clipboard.writeText を成功するようにオーバーライド
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: () => Promise.resolve() },
        writable: true,
        configurable: true,
      });
    });

    // 「共有」ボタンをクリックしてメニューを開く
    await page.getByRole("button", { name: "共有" }).click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();

    // 「URL をコピー」を選択
    await menu.getByRole("menuitem", { name: "URL をコピー" }).click();

    // 成功通知が表示される
    await expect(page.getByText("URL をコピーしました")).toBeVisible();

    // === コピー失敗ケース ===
    // clipboard.writeText を失敗するようにオーバーライド
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: () => Promise.reject(new Error("Permission denied")) },
        writable: true,
        configurable: true,
      });
    });

    // 再度「共有」ボタンをクリック
    await page.getByRole("button", { name: "共有" }).click();
    const menu2 = page.getByRole("menu");
    await expect(menu2).toBeVisible();

    // 「URL をコピー」を選択
    await menu2.getByRole("menuitem", { name: "URL をコピー" }).click();

    // エラー通知が表示される
    await expect(page.getByText("URL のコピーに失敗しました")).toBeVisible();
  },
);

test(
  "UC-COMM-11: コミュニティ詳細の投稿一覧では本文が数行に省略表示される（#501）",
  async ({ page }) => {
    // 長い本文の投稿を用意（3 行を超えるテキスト）
    const LONG_TEXT_POST = {
      ...MOCK_POST,
      text: "これは非常に長い投稿の本文です。\n\n".repeat(10) + "このテキストは絶対に省略されるべきです。",
    };

    await mockUnauthenticated(page);
    await mockCommunitiesApi(page);
    await mockFeedApi(page);
    await mockCommunityFeedApi(page, MOCK_COMMUNITY.slug, [LONG_TEXT_POST]);
    await mockCommunityWorkersApi(page, MOCK_COMMUNITY.slug);
    await mockSubscriptionApi(page, MOCK_COMMUNITY.slug, false);

    await page.goto(`/communities/${MOCK_COMMUNITY.slug}`);

    // 投稿タイトルが表示されていることを確認
    await expect(page.getByRole("heading", { name: LONG_TEXT_POST.title })).toBeVisible();

    // truncateText が true のとき MarkdownContent の clampToLines により、ReactMarkdown の
    // 出力全体を包む外側コンテナ（Box）に overflow: hidden が適用される（p 個別ではない・#1105）。
    // PostCard の本文（長い本文テキストを含む p 要素）を起点に祖先を辿り、クランプ用コンテナを特定する。
    // allElements の全走査は MUI コンテナ等にも overflow:hidden があるため偽陽性になるリスクがある（#742）。
    const bodyParagraph = page.locator("p").filter({ hasText: "これは非常に長い投稿の本文です" }).first();
    await expect(bodyParagraph).toBeAttached();
    const overflow = await bodyParagraph.evaluate((el) => {
      let current: Element | null = el.parentElement;
      while (current) {
        if (window.getComputedStyle(current).display === "-webkit-box") {
          return window.getComputedStyle(current).overflow;
        }
        current = current.parentElement;
      }
      return null;
    });
    expect(overflow).toBe("hidden");
  },
);

// UC-COMM-12: モバイルドロワーを開いたとき全ナビ項目が見切れず表示される（#514）
test(
  "UC-COMM-12: モバイルドロワーを開いたとき全ナビ項目が見切れず表示される",
  async ({ page }) => {
    // モバイルビューポート（375px）に設定
    await page.setViewportSize({ width: 375, height: 812 });

    await mockUnauthenticated(page);
    await mockCommunitiesApi(page);
    await mockFeedApi(page);

    await page.goto("/");

    // ハンバーガーボタン（メニューを開く）をクリック
    const menuButton = page.getByRole("button", { name: "メニューを開く" });
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    // モバイルサイドバーのドロワーが開く
    const mobileSidebar = page.getByTestId("mobile-sidebar-nav");
    await expect(mobileSidebar).toBeVisible();

    // 主要ナビ項目が全て表示される（見切れない）
    await expect(mobileSidebar.getByRole("link", { name: "ホーム" })).toBeVisible();
    await expect(mobileSidebar.getByRole("link", { name: "人気" })).toBeVisible();
    await expect(mobileSidebar.getByRole("link", { name: "ランキング" })).toBeVisible();
    await expect(mobileSidebar.getByRole("link", { name: "利用規約" })).toBeVisible();
    await expect(mobileSidebar.getByRole("link", { name: "プライバシーポリシー" })).toBeVisible();
  },
);

test(
  "UC-COMM-13: コミュニティ一覧に投稿数・最終投稿の活気指標が表示される（#527）",
  async ({ page }) => {
    // 投稿ありのコミュニティと投稿なしのコミュニティを用意
    const COMMUNITY_WITH_POSTS = {
      ...MOCK_COMMUNITY,
      post_count: 5,
      last_post_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30分前
    };
    const COMMUNITY_WITHOUT_POSTS = {
      ...MOCK_COMMUNITY,
      id: "comm-empty",
      slug: "empty-community",
      name: "空コミュニティ",
      post_count: 0,
      last_post_at: null,
    };

    await mockUnauthenticated(page);
    await page.route("**/api/communities", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([COMMUNITY_WITH_POSTS, COMMUNITY_WITHOUT_POSTS]),
      }),
    );
    await mockFeedApi(page);

    await page.goto("/communities");

    // 投稿ありのコミュニティ: 「N件の投稿」と「最終投稿:」が表示される
    await expect(page.getByText("5件の投稿")).toBeVisible();
    await expect(page.getByText(/最終投稿:/)).toBeVisible();

    // 投稿なしのコミュニティ: 「投稿なし」と「未投稿」が表示される
    await expect(page.getByText("投稿なし")).toBeVisible();
    await expect(page.getByText("未投稿")).toBeVisible();
  },
);

// UC-COMM-15: コンパクト表示モードは Issue #811 で廃止済み（useViewMode フック・compact prop を削除）。
// このユースケースに対応する UI が存在しないため、test.skip とする。
// usecases.md の UC-COMM-15 エントリは廃止モードへの言及として残す（削除は別 Issue で対応）。
test(
  "UC-COMM-15: コミュニティ詳細の投稿一覧の表示モードをカード/コンパクトで切り替えられる（#561）",
  async () => {
    // コンパクト表示モードは Issue #811 で廃止された。対応する UI が存在しないためスキップ。
    test.skip(true, "コンパクト表示モードは Issue #811 で廃止済みのためスキップ");
  },
);

test(
  "UC-COMM-16: vote ミューテーション進行中はコミュニティフィードの vote ボタンが disabled になる（#748）",
  async ({ page }) => {
    const MOCK_POST_VOTE = { ...MOCK_POST, my_vote: null as "up" | "down" | null };

    await mockAuthenticated(page);
    await mockCommunitiesApi(page);
    await mockFeedApi(page);
    await mockCommunityFeedApi(page, MOCK_COMMUNITY.slug, [MOCK_POST_VOTE]);
    await mockCommunityWorkersApi(page, MOCK_COMMUNITY.slug);
    await mockSubscriptionApi(page, MOCK_COMMUNITY.slug, false);

    // vote API レスポンスを保留して mutation 進行中状態を再現する
    let resolveVote!: () => void;
    await page.route("**/api/posts/*/vote", async (route) => {
      await new Promise<void>((resolve) => {
        resolveVote = resolve;
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...MOCK_POST_VOTE, score: 4, my_vote: "up" }),
      });
    });

    await page.goto(`/communities/${MOCK_COMMUNITY.slug}`);
    await expect(page.getByRole("heading", { name: MOCK_POST.title })).toBeVisible();

    const upVoteButton = page.getByRole("button", { name: "up vote" }).first();

    // route handler が実行され resolveVote が代入されるのを確実に待つ
    const voteRequestPromise = page.waitForRequest("**/api/posts/*/vote");
    await upVoteButton.click();
    await voteRequestPromise;

    await expect(upVoteButton).toBeDisabled();

    resolveVote();
    await expect(upVoteButton).not.toBeDisabled();
  },
);

test(
  "UC-COMM-17: コミュニティフィードのコメント Chip をクリックするとコメントセクションへ直接遷移する（#836）",
  async ({ page }) => {
    await mockUnauthenticated(page);
    await mockCommunitiesApi(page);
    await mockFeedApi(page);
    await mockCommunityFeedApi(page, MOCK_COMMUNITY.slug);
    await mockCommunityWorkersApi(page, MOCK_COMMUNITY.slug);
    await mockSubscriptionApi(page, MOCK_COMMUNITY.slug, false);

    // 遷移先の投稿スレッドページ API をモック（遷移後のエラーを防ぐ）
    await page.route(`**/api/posts/${MOCK_POST.id}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ post: MOCK_POST, comments: [] }),
      }),
    );

    await page.goto(`/communities/${MOCK_COMMUNITY.slug}`);

    // 投稿タイトルが表示されることを確認
    await expect(page.getByRole("heading", { name: MOCK_POST.title })).toBeVisible();

    // コメント Chip が表示される（aria-label で特定）
    const commentChip = page.getByLabel(`コメント ${MOCK_POST.comment_count} 件`);
    await expect(commentChip).toBeVisible();

    // コメント Chip をクリック → /posts/$postId#comments へ遷移する
    await commentChip.click();
    await expect(page).toHaveURL(`/posts/${MOCK_POST.id}#comments`);
  },
);

test(
  "UC-COMM-18: コミュニティ詳細の投稿一覧がフラットリスト（border 区切り）で表示される（#834）",
  async ({ page }) => {
    await mockUnauthenticated(page);
    await mockCommunitiesApi(page);
    await mockFeedApi(page);
    await mockCommunityFeedApi(page, MOCK_COMMUNITY.slug);
    await mockCommunityWorkersApi(page, MOCK_COMMUNITY.slug);
    await mockSubscriptionApi(page, MOCK_COMMUNITY.slug, false);

    await page.goto(`/communities/${MOCK_COMMUNITY.slug}`);

    // 投稿タイトルが表示されることを確認
    await expect(page.getByRole("heading", { name: MOCK_POST.title })).toBeVisible();

    // 投稿カードが variant="list" で描画されている（data-variant="list" 属性で確認）
    const postCard = page.locator('[data-variant="list"]').first();
    // toBeVisible() で描画完了を待ってから computed style を検証する
    await expect(postCard).toBeVisible();

    // フラットリストスタイル: border-bottom が適用されている（浮き上がりカードではない）
    // 1 回の evaluate() でアトミックに取得する
    const { borderBottomWidth, borderBottomStyle } = await postCard.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return { borderBottomWidth: s.borderBottomWidth, borderBottomStyle: s.borderBottomStyle };
    });
    expect(borderBottomWidth).toBe("1px");
    expect(borderBottomStyle).toBe("solid");
  },
);

test.todo("UC-COMM-19: コミュニティ詳細の各投稿カードに共有ボタンが表示される（#838）");

test.todo("UC-COMM-23: コミュニティフィードを無限スクロールで閲覧できる（#881）");

test.todo("UC-COMM-24: モバイル幅でもコミュニティ概要（description）が表示される（#883）");

test.todo("UC-COMM-26: 購読コミュニティの新着投稿に「New」ラベルが表示される（#935）");

test.todo("UC-COMM-30: コミュニティ詳細のワーカー一覧がスクロールで無限に追加読み込まれる（#1078）");

test.todo("UC-COMM-31: コミュニティ単位で Web Push 通知の ON/OFF を切り替えられる（#1088）");
