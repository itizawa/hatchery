import type { Page } from "@playwright/test";
import { test, expect } from "../support/test.js";

/**
 * community e2e テスト（#428）。
 *
 * e2e/community/usecases.md の UC-COMM-01〜10 に対応する実テスト。
 * page.route() で API をモックし、バックエンドなしでブラウザ側の振る舞いを検証する。
 */

// ─── モックデータ ─────────────────────────────────────────────────────────────

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

const MOCK_RECENT_WORKERS = [
  { id: "worker-a", displayName: "ワーカー甲", role: "engineer", imageUrl: null },
  { id: "worker-b", displayName: "ワーカー乙", role: "designer", imageUrl: null },
];

// ─── モックヘルパー ────────────────────────────────────────────────────────────

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
  await page.route(`**/api/communities/${slug}/feed`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(posts),
    }),
  );
}

async function mockRecentWorkersApi(
  page: Page,
  slug: string,
  workers: unknown[] = MOCK_RECENT_WORKERS,
): Promise<void> {
  await page.route(`**/api/communities/${slug}/recent-workers`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(workers),
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

// ─── テスト ───────────────────────────────────────────────────────────────────

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
  await mockRecentWorkersApi(page, MOCK_COMMUNITY.slug);
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

test("UC-COMM-03: コミュニティ詳細に post 一覧と直近の登場ワーカーが表示される", async ({
  page,
}) => {
  await mockUnauthenticated(page);
  await mockCommunitiesApi(page);
  await mockFeedApi(page);
  await mockCommunityFeedApi(page, MOCK_COMMUNITY.slug);
  await mockRecentWorkersApi(page, MOCK_COMMUNITY.slug);
  await mockSubscriptionApi(page, MOCK_COMMUNITY.slug, false);

  await page.goto(`/communities/${MOCK_COMMUNITY.slug}`);

  // 投稿一覧が表示される
  await expect(page.getByRole("heading", { name: MOCK_POST.title })).toBeVisible();

  // コメント数が表示される（💬 N 形式）
  await expect(page.getByLabel("コメント 2 件")).toBeVisible();

  // サイドバーの作成日が正しくフォーマットされる（NaN年ではない）
  // 2024-03-15 UTC → "2024年3月15日 作成"
  await expect(page.getByText("2024年3月15日 作成")).toBeVisible();

  // 最近投稿したワーカーが表示される
  await expect(page.getByText(MOCK_RECENT_WORKERS[0].displayName)).toBeVisible();
});

test("UC-COMM-04: ログイン済みユーザーがコミュニティを購読できる", async ({ page }) => {
  await mockAuthenticated(page);
  await mockCommunitiesApi(page);
  await mockFeedApi(page);
  await mockCommunityFeedApi(page, MOCK_COMMUNITY.slug, []);
  await mockRecentWorkersApi(page, MOCK_COMMUNITY.slug, []);

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
  await mockRecentWorkersApi(page, MOCK_COMMUNITY.slug, []);

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

test("UC-COMM-06: 未ログインユーザーには購読ボタンが表示されない", async ({ page }) => {
  await mockUnauthenticated(page);
  await mockCommunitiesApi(page);
  await mockFeedApi(page);
  await mockCommunityFeedApi(page, MOCK_COMMUNITY.slug);
  await mockRecentWorkersApi(page, MOCK_COMMUNITY.slug);
  await mockSubscriptionApi(page, MOCK_COMMUNITY.slug, false);

  await page.goto(`/communities/${MOCK_COMMUNITY.slug}`);

  // post 一覧は表示される
  await expect(page.getByRole("heading", { name: MOCK_POST.title })).toBeVisible();
  // 購読ボタンは表示されない
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
    await mockRecentWorkersApi(page, MOCK_COMMUNITY.slug, []);
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
    await mockRecentWorkersApi(page, MOCK_COMMUNITY_WITH_IMAGES.slug, []);
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
  "UC-COMM-08: コミュニティ詳細の最近の登場ワーカー取得に失敗してもページ本体は表示される",
  async ({ page }) => {
    await mockUnauthenticated(page);
    await mockCommunitiesApi(page);
    await mockFeedApi(page);
    await mockCommunityFeedApi(page, MOCK_COMMUNITY.slug);
    await mockSubscriptionApi(page, MOCK_COMMUNITY.slug, false);

    // recent-workers API を 500 エラーにモック
    await page.route(`**/api/communities/${MOCK_COMMUNITY.slug}/recent-workers`, (route) =>
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

    // サイドバーの recent-workers セクションにエラー表示が出る
    await expect(page.getByText("読み込みに失敗しました")).toBeVisible();
  },
);

test("UC-COMM-09: サイドバーの「コミュニティ」セクションを見出しクリックで開閉できる", async ({
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
    await mockRecentWorkersApi(page, MOCK_COMMUNITY.slug);
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
