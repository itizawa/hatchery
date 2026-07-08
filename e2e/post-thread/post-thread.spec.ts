import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createWorker } from "../helpers/createWorker";
import { createCommunity } from "../helpers/createCommunity";
import { createPost } from "../helpers/createPost";
import { createComment } from "../helpers/createComment";
import { login } from "../helpers/login";
import { createUser } from "../helpers/createUser";
import { logout } from "../helpers/logout";
import { devLogin } from "../helpers/devLogin";

const MOCK_WORKER_1 = {
  display_name: "ケン",
  bio: "エネルギッシュな社員",
  image_url: "https://example.com/ken.jpg",
};

const MOCK_WORKER_2 = {
  display_name: "メイ",
  bio: "新人の社員",
  image_url: null,
};

const MOCK_COMMUNITY = {
  name: "Dev Talk",
  slug: "dev-talk",
  description: "開発者の雑談コミュニティ",
};

const MOCK_POST = {
  title: "テスト投稿",
  content: "これはテスト投稿の本文です。",
};

const MOCK_COMMENT_1 = {
  text: "最初のコメントです。",
};

test(
  "UC-POST-01: 投稿スレッドに post 本文とコメント一覧が表示される",
  async ({ page }) => {
    const worker1 = await createWorker({ ...MOCK_WORKER_1 });
    const community = await createCommunity({ ...MOCK_COMMUNITY, workerIds: [worker1.id] });
    const post = await createPost({
      communityId: community.id,
      workerId: worker1.id,
      ...MOCK_POST,
    });
    const comment = await createComment({
      postId: post.id,
      workerId: worker1.id,
      ...MOCK_COMMENT_1,
    });

    await page.goto(`/posts/${post.id}`);

    // post 本文・投稿者ワーカー名・「コメント N 件」が表示される
    await expect(page.getByText(MOCK_POST.content)).toBeVisible();
    await expect(page.getByText(MOCK_WORKER_1.display_name)).toBeVisible();
    await expect(page.getByText("コメント 1 件")).toBeVisible();

    // コメント本文が表示される
    await expect(page.getByText(MOCK_COMMENT_1.text)).toBeVisible();

    // クリーンアップ
    await comment.delete();
    await post.delete();
    await community.delete();
    await worker1.delete();
  },
);

test(
  "UC-POST-02: コメントが 0 件の投稿ではコメントセクションが表示されない",
  async ({ page }) => {
    const worker = await createWorker({ ...MOCK_WORKER_1 });
    const community = await createCommunity({ ...MOCK_COMMUNITY, workerIds: [worker.id] });
    const post = await createPost({
      communityId: community.id,
      workerId: worker.id,
      ...MOCK_POST,
    });

    await page.goto(`/posts/${post.id}`);

    // コメント 0 件の場合は空状態メッセージが表示される
    await expect(
      page.getByText("まだコメントはありません。AI ワーカーが定時にコメントします。"),
    ).toBeVisible();
    // 「コメント N 件」の見出しは表示されない
    await expect(page.getByText(/コメント \d+ 件/)).not.toBeVisible();

    // クリーンアップ
    await post.delete();
    await community.delete();
    await worker.delete();
  },
);

test(
  "UC-POST-03: ログイン済みユーザーが post に upvote できる",
  async ({ page }) => {
    const worker = await createWorker({ ...MOCK_WORKER_1 });
    const community = await createCommunity({ ...MOCK_COMMUNITY, workerIds: [worker.id] });
    const post = await createPost({
      communityId: community.id,
      workerId: worker.id,
      ...MOCK_POST,
    });

    const user = await createUser();
    await login({ page, user });

    await page.goto(`/posts/${post.id}`);

    // upvote ボタンをクリックする
    const upvoteButtons = page.getByRole("button", { name: /up vote/i });
    const postUpvoteButton = upvoteButtons.first();
    const initialScore = await page
      .getByTestId("vote-score")
      .first()
      .textContent()
      .then((t) => parseInt(t || "0"));

    await postUpvoteButton.click();

    // vote 数が即時に増加して表示される
    await expect(page.getByTestId("vote-score").first()).toHaveText(
      String(initialScore + 1),
    );

    // 再読込後も維持される
    await page.reload();
    await expect(page.getByTestId("vote-score").first()).toHaveText(
      String(initialScore + 1),
    );

    // クリーンアップ
    await logout(page);
    await post.delete();
    await community.delete();
    await worker.delete();
    await user.delete();
  },
);

test(
  "UC-POST-04: ログイン済みユーザーがコメントに upvote できる",
  async ({ page }) => {
    const worker = await createWorker({ ...MOCK_WORKER_1 });
    const community = await createCommunity({ ...MOCK_COMMUNITY, workerIds: [worker.id] });
    const post = await createPost({
      communityId: community.id,
      workerId: worker.id,
      ...MOCK_POST,
    });
    const comment = await createComment({
      postId: post.id,
      workerId: worker.id,
      ...MOCK_COMMENT_1,
    });

    const user = await createUser();
    await login({ page, user });

    await page.goto(`/posts/${post.id}`);

    // コメントの upvote ボタンをクリックする（最後の upvote ボタン = コメントの vote）
    const upvoteButtons = page.getByRole("button", { name: /up vote/i });
    const commentUpvoteButton = upvoteButtons.last();
    const initialScore = await page
      .getByTestId("vote-score")
      .last()
      .textContent()
      .then((t) => parseInt(t || "0"));

    await commentUpvoteButton.click();

    // vote 数が即時に増加して表示される
    await expect(page.getByTestId("vote-score").last()).toHaveText(
      String(initialScore + 1),
    );

    // 再読込後も維持される
    await page.reload();
    await expect(page.getByTestId("vote-score").last()).toHaveText(
      String(initialScore + 1),
    );

    // クリーンアップ
    await logout(page);
    await comment.delete();
    await post.delete();
    await community.delete();
    await worker.delete();
    await user.delete();
  },
);

test(
  "UC-POST-05: スレッドに投稿・コメントの入力欄が存在しない",
  async ({ page }) => {
    const worker = await createWorker({ ...MOCK_WORKER_1 });
    const community = await createCommunity({ ...MOCK_COMMUNITY, workerIds: [worker.id] });
    const post = await createPost({
      communityId: community.id,
      workerId: worker.id,
      ...MOCK_POST,
    });

    await page.goto(`/posts/${post.id}`);
    await expect(page.getByText(MOCK_POST.content)).toBeVisible();

    // textarea が存在しない（コメント入力欄なし）
    await expect(page.locator("textarea")).toHaveCount(0);
    // text 型 input が存在しない（投稿入力欄なし）
    await expect(page.locator('input[type="text"]')).toHaveCount(0);

    // クリーンアップ
    await post.delete();
    await community.delete();
    await worker.delete();
  },
);

test(
  "UC-POST-06: 存在しない postId ではエラーフォールバックが表示される",
  async ({ page }) => {
    await page.goto("/posts/nonexistent-post-id");

    // エラーフォールバックが表示される
    await expect(page.getByText("データの取得に失敗しました。")).toBeVisible();
    await expect(page.getByRole("button", { name: "再試行" })).toBeVisible();
  },
);

test(
  "UC-POST-07: スレッドの post / 各コメントの発言者がアバター画像＋表示名で表示される（#479）",
  async ({ page }) => {
    const worker1 = await createWorker({ ...MOCK_WORKER_1 }); // 画像あり
    const worker2 = await createWorker({ ...MOCK_WORKER_2 }); // 画像なし
    const community = await createCommunity({
      ...MOCK_COMMUNITY,
      workerIds: [worker1.id, worker2.id],
    });
    const post = await createPost({
      communityId: community.id,
      workerId: worker1.id,
      ...MOCK_POST,
    });
    const comment = await createComment({
      postId: post.id,
      workerId: worker2.id,
      ...MOCK_COMMENT_1,
    });

    await page.goto(`/posts/${post.id}`);

    // post の発言者: 画像ありワーカー → アバター画像 + 表示名
    const postSection = page.getByTestId("post-header");
    await expect(postSection.getByRole("img", { name: worker1.display_name })).toBeVisible();
    await expect(postSection.getByText(worker1.display_name)).toBeVisible();

    // コメントの発言者: 画像なしワーカー → 頭文字フォールバック + 表示名
    const commentSection = page.getByTestId("comment-list");
    await expect(commentSection.getByRole("img")).not.toBeVisible();
    await expect(commentSection.getByText(worker2.display_name)).toBeVisible();
    // 頭文字フォールバックが表示される（display_name の先頭文字）
    await expect(
      commentSection.getByText(worker2.display_name.charAt(0).toUpperCase()),
    ).toBeVisible();

    // クリーンアップ
    await comment.delete();
    await post.delete();
    await community.delete();
    await worker1.delete();
    await worker2.delete();
  },
);

test(
  "UC-POST-08: 未ログインユーザーが post / comment の vote を押すとログイン誦導が表示される（#481）",
  async ({ page }) => {
    const worker = await createWorker({ ...MOCK_WORKER_1 });
    const community = await createCommunity({ ...MOCK_COMMUNITY, workerIds: [worker.id] });
    const post = await createPost({
      communityId: community.id,
      workerId: worker.id,
      ...MOCK_POST,
    });

    await page.goto(`/posts/${post.id}`);

    // 未ログイン状態で post の upvote ボタンをクリック
    const upvoteButtons = page.getByRole("button", { name: /up vote/i });
    await upvoteButtons.first().click();

    // ログイン誦導スナックバーが表示される
    await expect(page.getByText("投票するにはログインが必要です")).toBeVisible();

    // クリーンアップ
    await post.delete();
    await community.delete();
    await worker.delete();
  },
);

test(
  "UC-POST-09: スレッドページに所属コミュニティの詳細サイドバーと購読ボタンが表示される（#499）",
  async ({ page }) => {
    const worker = await createWorker({ ...MOCK_WORKER_1 });
    const community = await createCommunity({ ...MOCK_COMMUNITY, workerIds: [worker.id] });
    const post = await createPost({
      communityId: community.id,
      workerId: worker.id,
      ...MOCK_POST,
    });

    await devLogin(page);
    await page.goto(`/posts/${post.id}`);

    // 所属コミュニティの詳細（名前・説明）がサイドバーに表示される
    await expect(page.getByRole("heading", { name: MOCK_COMMUNITY.name })).toBeVisible();
    await expect(page.getByText(MOCK_COMMUNITY.description)).toBeVisible();

    // 購読ボタンが表示され、クリックすると購読状態が切り替わる
    const subscribeButton = page.getByRole("button", { name: "購読する" });
    await expect(subscribeButton).toBeVisible();
    await subscribeButton.click();
    await expect(page.getByRole("button", { name: "購読解除" })).toBeVisible();

    // クリーンアップ
    await page.request.post("/api/auth/logout");
    await post.delete();
    await community.delete();
    await worker.delete();
  },
);

test(
  "UC-POST-10: スレッドの post / 各コメントに投稿時刻（相対時間）が表示される（#502）",
  async ({ page }) => {
    const worker = await createWorker({ ...MOCK_WORKER_1 });
    const community = await createCommunity({ ...MOCK_COMMUNITY, workerIds: [worker.id] });
    const post = await createPost({
      communityId: community.id,
      workerId: worker.id,
      ...MOCK_POST,
    });
    const comment = await createComment({
      postId: post.id,
      workerId: worker.id,
      ...MOCK_COMMENT_1,
    });

    await page.goto(`/posts/${post.id}`);

    // 投稿時刻が相対時間（例: 「N秒前」「N分前」）で表示される
    // 直近の投稿なので「N秒前」か「N分前」が表示されるはず
    const timeElements = page.locator("time");
    await expect(timeElements.first()).toBeVisible();

    // time 要素に dateTime 属性があること
    const firstTimeEl = timeElements.first();
    const dateTimeAttr = await firstTimeEl.getAttribute("dateTime");
    expect(dateTimeAttr).not.toBeNull();
    expect(new Date(dateTimeAttr!).toISOString()).toBe(dateTimeAttr);

    // クリーンアップ
    await comment.delete();
    await post.delete();
    await community.delete();
    await worker.delete();
  },
);

test(
  "UC-POST-11: スレッドの post / コメント本文が Markdown 書式で表示される（#513）",
  async ({ page }) => {
    const worker = await createWorker({ ...MOCK_WORKER_1 });
    const community = await createCommunity({ ...MOCK_COMMUNITY, workerIds: [worker.id] });
    const post = await createPost({
      communityId: community.id,
      workerId: worker.id,
      title: MOCK_POST.title,
      content:
        "これは **太字テキスト** の説明です。\n\n- リスト項目イチ\n- リスト項目ニ\n\n[マークダウンリンク](https://example.com/markdown-doc)",
    });
    const comment = await createComment({
      postId: post.id,
      workerId: worker.id,
      text: "コメントも **太字コメント** を含みます。",
    });

    await page.goto(`/posts/${post.id}`);

    // post 本文: 太字が <strong> としてレンダリングされる
    await expect(page.locator("strong", { hasText: "太字テキスト" })).toBeVisible();
    // post 本文: リスト項目が <li> としてレンダリングされる
    await expect(page.locator("li", { hasText: "リスト項目イチ" })).toBeVisible();
    // post 本文: リンクがクリック可能な <a> としてレンダリングされる
    const postLink = page.getByRole("link", { name: "マークダウンリンク" });
    await expect(postLink).toBeVisible();
    await expect(postLink).toHaveAttribute("href", "https://example.com/markdown-doc");
    // 生の Markdown 記法（**太字テキスト**）がそのまま表示されない
    await expect(page.getByText("**太字テキスト**")).not.toBeVisible();

    // コメント本文の太字も装飾済みで表示され、生の Markdown 記法は表示されない
    await expect(page.locator("strong", { hasText: "太字コメント" })).toBeVisible();
    await expect(page.getByText("**太字コメント**")).not.toBeVisible();

    // クリーンアップ
    await comment.delete();
    await post.delete();
    await community.delete();
    await worker.delete();
  },
);

test(
  "UC-POST-12: 投稿スレッドを開いたときブラウザタブのタイトルに post タイトルが表示される（#528）",
  async ({ page }) => {
    const worker = await createWorker({ ...MOCK_WORKER_1 });
    const community = await createCommunity({ ...MOCK_COMMUNITY, workerIds: [worker.id] });
    const post = await createPost({
      communityId: community.id,
      workerId: worker.id,
      ...MOCK_POST,
    });

    await page.goto(`/posts/${post.id}`);

    // ブラウザタブのタイトルが「<post.title> - Hatchery」になっている
    await expect(page).toHaveTitle(`${MOCK_POST.title} - Hatchery`);
  },
);

// ─── UC-POST-13〜15 用モックデータ（page.route() ベース）────────────────────────

/** スレッド取得 API（GET /api/posts/:postId）のモックレスポンス共通構造。 */
const MOCK_AUTHOR_WORKER = {
  id: "worker-mock-1",
  display_name: "モックワーカー",
  image_url: null,
};

const MOCK_POST_ID = "mock-post-id-741";
const MOCK_COMMUNITY_ID = "mock-community-id-741";
const MOCK_COMMUNITY_SLUG = "mock-community-741";

/** UC-POST-13 用: post.text と comment.text に URL を含むスレッドデータ。 */
const MOCK_THREAD_WITH_URL = {
  post: {
    id: MOCK_POST_ID,
    community_id: MOCK_COMMUNITY_ID,
    slot_key: "2024-01-15T12:00",
    seq: 0,
    author: "worker-mock-1",
    title: "OGP テスト投稿",
    text: "https://example.com/ogp-page こちらの記事をご覧ください。",
    score: 5,
    comment_count: 1,
    created_at: "2024-01-15T12:00:00.000Z",
    author_worker: MOCK_AUTHOR_WORKER,
  },
  comments: [
    {
      id: "comment-mock-1",
      community_id: MOCK_COMMUNITY_ID,
      post_id: MOCK_POST_ID,
      slot_key: "2024-01-15T12:00",
      seq: 0,
      author: "worker-mock-1",
      text: "https://example.com/comment-ogp こちらも参考にどうぞ。",
      score: 2,
      parent_comment_id: null,
      created_at: "2024-01-15T12:01:00.000Z",
      author_worker: MOCK_AUTHOR_WORKER,
    },
  ],
};

/** UC-POST-14 用: 親子ネストコメントを含むスレッドデータ。 */
const MOCK_THREAD_WITH_NESTED_COMMENTS = {
  post: {
    id: MOCK_POST_ID,
    community_id: MOCK_COMMUNITY_ID,
    slot_key: "2024-01-15T12:00",
    seq: 0,
    author: "worker-mock-1",
    title: "ネストコメントテスト投稿",
    text: "これはネストコメントのテスト投稿です。",
    score: 3,
    comment_count: 2,
    created_at: "2024-01-15T12:00:00.000Z",
    author_worker: MOCK_AUTHOR_WORKER,
  },
  comments: [
    {
      id: "comment-parent-1",
      community_id: MOCK_COMMUNITY_ID,
      post_id: MOCK_POST_ID,
      slot_key: "2024-01-15T12:00",
      seq: 0,
      author: "worker-mock-1",
      text: "これは親コメントです。",
      score: 2,
      parent_comment_id: null,
      created_at: "2024-01-15T12:01:00.000Z",
      author_worker: MOCK_AUTHOR_WORKER,
    },
    {
      id: "comment-child-1",
      community_id: MOCK_COMMUNITY_ID,
      post_id: MOCK_POST_ID,
      slot_key: "2024-01-15T12:00",
      seq: 1,
      author: "worker-mock-1",
      text: "これは子コメント（返信）です。",
      score: 1,
      parent_comment_id: "comment-parent-1",
      created_at: "2024-01-15T12:02:00.000Z",
      author_worker: MOCK_AUTHOR_WORKER,
    },
  ],
};

/** UC-POST-15 用: コミュニティ付きスレッドデータ。 */
const MOCK_THREAD_FOR_BREADCRUMB = {
  post: {
    id: MOCK_POST_ID,
    community_id: MOCK_COMMUNITY_ID,
    slot_key: "2024-01-15T12:00",
    seq: 0,
    author: "worker-mock-1",
    title: "パンくずテスト投稿",
    text: "これはパンくずリンクのテスト投稿です。",
    score: 2,
    comment_count: 0,
    created_at: "2024-01-15T12:00:00.000Z",
    author_worker: MOCK_AUTHOR_WORKER,
  },
  comments: [],
};

/** コミュニティ一覧のモックデータ（パンくず・サイドバー用）。 */
const MOCK_COMMUNITY_LIST = [
  {
    id: MOCK_COMMUNITY_ID,
    slug: MOCK_COMMUNITY_SLUG,
    name: "モックコミュニティ",
    description: "テスト用コミュニティ",
    created_at: "2024-01-01T00:00:00.000Z",
    iconUrl: null,
    coverUrl: null,
    post_count: 10,
    last_post_at: "2024-01-15T12:00:00.000Z",
  },
];

/**
 * スレッドページの共通モック（POST /api/posts/:postId/view 等のビーコン、認証、コミュニティ）。
 * 実テストで毎回設定する共通インフラ API をまとめてモックする。
 */
async function setupThreadCommonMocks({
  page,
  thread,
}: {
  page: Page;
  thread: { post: unknown; comments: unknown[] };
}): Promise<void> {
  // スレッドデータ
  await page.route(`**/api/posts/${MOCK_POST_ID}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(thread),
    }),
  );
  // コミュニティ一覧（パンくず・サイドバー）
  await page.route("**/api/communities", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_COMMUNITY_LIST),
    }),
  );
  // 認証（未ログイン）
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Unauthorized" }),
    }),
  );
  // 閲覧ビーコン（post view / comment-views）
  await page.route(`**/api/posts/${MOCK_POST_ID}/view`, (route) =>
    route.fulfill({ status: 202 }),
  );
  await page.route(`**/api/posts/${MOCK_POST_ID}/comment-views`, (route) =>
    route.fulfill({ status: 202 }),
  );
  // サブスクリプション（サイドバー）
  await page.route(`**/api/communities/${MOCK_COMMUNITY_SLUG}/subscription`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ subscribed: false }),
    }),
  );
}

test(
  "UC-POST-13: post / コメント本文の先頭 URL が OGP カードとして展開表示される（#515）",
  async ({ page }) => {
    await setupThreadCommonMocks({ page, thread: MOCK_THREAD_WITH_URL });

    // OGP API: URL ごとに異なるタイトルを返す（post 用と comment 用を区別）
    await page.route("**/api/ogp?url=https%3A%2F%2Fexample.com%2Fogp-page", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          title: "投稿OGPタイトル",
          description: "投稿用OGPの説明",
          image: "https://example.com/og-post.jpg",
          site_name: "Example Site",
        }),
      }),
    );
    await page.route("**/api/ogp?url=https%3A%2F%2Fexample.com%2Fcomment-ogp", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          title: "コメントOGPタイトル",
          description: "コメント用OGPの説明",
          image: "https://example.com/og-comment.jpg",
          site_name: "Comment Site",
        }),
      }),
    );

    await page.goto(`/posts/${MOCK_POST_ID}`);

    // post 本文の OGP カードが表示される
    await expect(page.getByRole("link", { name: /投稿OGPタイトル/ })).toBeVisible();
    // コメント本文の OGP カードも表示される
    await expect(page.getByRole("link", { name: /コメントOGPタイトル/ })).toBeVisible();
  },
);

test(
  "UC-POST-13（フォールバック）: OGP 取得失敗時は OGP カードが表示されず URL リンクのみ残る",
  async ({ page }) => {
    await setupThreadCommonMocks({ page, thread: MOCK_THREAD_WITH_URL });

    // OGP API: 失敗ケース（title なし）→ 全 URL に対してカードを返さない
    await page.route("**/api/ogp?*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ title: null, description: null, image: null, site_name: null }),
      }),
    );

    await page.goto(`/posts/${MOCK_POST_ID}`);

    // post 本文自体は表示される（MarkdownContent で URL テキストが描画される）
    await expect(page.getByText("こちらの記事をご覧ください")).toBeVisible();
    // OGP カード（role="link" として描画）は表示されない
    await expect(page.getByRole("link", { name: /投稿OGPタイトル/ })).not.toBeVisible();
    await expect(page.getByRole("link", { name: /コメントOGPタイトル/ })).not.toBeVisible();
  },
);

test(
  "UC-POST-14: コメントが返信スレッド（ネスト構造）として Reddit 風に表示される（#520）",
  async ({ page }) => {
    await setupThreadCommonMocks({ page, thread: MOCK_THREAD_WITH_NESTED_COMMENTS });

    await page.goto(`/posts/${MOCK_POST_ID}`);

    // 親コメントと子コメントが両方表示される
    await expect(page.getByText("これは親コメントです。")).toBeVisible();
    await expect(page.getByText("これは子コメント（返信）です。")).toBeVisible();

    // 子コメント（depth > 0）の L 字コネクターが表示される（Reddit 風インデント）
    await expect(page.getByTestId("comment-l-connector")).toBeVisible();
  },
);

test(
  "UC-POST-15: 投稿スレッドにコミュニティへのパンくずリンクが表示される（#525 / #693 / #780）",
  async ({ page }) => {
    await setupThreadCommonMocks({ page, thread: MOCK_THREAD_FOR_BREADCRUMB });

    await page.goto(`/posts/${MOCK_POST_ID}`);

    // 「ポスト一覧」のパンくずリンクが表示される
    const breadcrumb = page.getByRole("link", { name: /ポスト一覧/ });
    await expect(breadcrumb).toBeVisible();

    // クリックするとコミュニティページへ遷移する
    await breadcrumb.click();
    await page.waitForURL(`**/communities/${MOCK_COMMUNITY_SLUG}`);
  },
);

test(
  "UC-POST-16: 返信コメントに Reddit 風 L 字コネクターが表示される（#746）",
  async ({ page }) => {
    await setupThreadCommonMocks({ page, thread: MOCK_THREAD_WITH_NESTED_COMMENTS });

    await page.goto(`/posts/${MOCK_POST_ID}`);

    // 子コメント（depth > 0）に L 字コネクターが表示される
    const lConnectors = page.getByTestId("comment-l-connector");
    await expect(lConnectors).toBeVisible();
    // 子コメントは 1 件のため L 字コネクターも 1 個
    await expect(lConnectors).toHaveCount(1);
  },
);

test(
  "UC-POST-18: vote ミューテーション進行中は vote ボタンが disabled になる（#748）",
  async ({ page }) => {
    await setupThreadCommonMocks({ page, thread: MOCK_THREAD_WITH_URL });

    // vote API レスポンスを保留して mutation 進行中状態を再現する
    let resolveVote!: () => void;
    await page.route(`**/api/posts/${MOCK_POST_ID}/vote`, async (route) => {
      await new Promise<void>((resolve) => {
        resolveVote = resolve;
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...MOCK_THREAD_WITH_URL.post, score: 6, my_vote: "up" }),
      });
    });

    await page.goto(`/posts/${MOCK_POST_ID}`);
    await expect(page.getByText(MOCK_THREAD_WITH_URL.post.title)).toBeVisible();

    const upVoteButton = page.getByRole("button", { name: "up vote" }).first();
    const voteRequestPromise = page.waitForRequest(`**/api/posts/${MOCK_POST_ID}/vote`);
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
  "UC-POST-19: 返信を持つコメントのアバター下にスレッドコネクターが表示される（#796）",
  async ({ page }) => {
    await setupThreadCommonMocks({ page, thread: MOCK_THREAD_WITH_NESTED_COMMENTS });

    await page.goto(`/posts/${MOCK_POST_ID}`);

    // 子コメントを持つ親コメントのアバター下にスレッドコネクター（縦線）が表示される
    await expect(page.getByTestId("comment-avatar-connector")).toBeVisible();
  },
);

test(
  "UC-POST-20: コメントに共有ボタンが表示され、コメントへのパーマリンクをコピー／X でシェアできる（#775）",
  async ({ page }) => {
    await setupThreadCommonMocks({ page, thread: MOCK_THREAD_WITH_URL });

    await page.goto(`/posts/${MOCK_POST_ID}`);

    // コメントの共有ボタンが表示される（最後の「共有」ボタン = コメントのボタン）
    const commentShareButton = page.getByRole("button", { name: "共有" }).last();
    await expect(commentShareButton).toBeVisible();

    // クリックするとメニューが開く
    await commentShareButton.click();
    await expect(page.getByText("URL をコピー")).toBeVisible();
    await expect(page.getByText("X でシェア")).toBeVisible();
  },
);

test(
  "UC-POST-21: vote ウィジェットに表示される数字は up − down のネットスコアである（#856）",
  async ({ page }) => {
    // MOCK_THREAD_WITH_URL: post.score = 5、comment.score = 2
    await setupThreadCommonMocks({ page, thread: MOCK_THREAD_WITH_URL });

    await page.goto(`/posts/${MOCK_POST_ID}`);
    await expect(page.getByText(MOCK_THREAD_WITH_URL.post.title)).toBeVisible();

    // post の vote ウィジェットに score 5 が表示される
    const postVoteWidget = page.locator("[data-voted]").first();
    await expect(postVoteWidget).toBeVisible();
    await expect(postVoteWidget.getByText(String(MOCK_THREAD_WITH_URL.post.score))).toBeVisible();

    // コメントの vote ウィジェットに score 2 が表示される
    const commentVoteWidget = page.locator("[data-voted]").last();
    await expect(
      commentVoteWidget.getByText(String(MOCK_THREAD_WITH_URL.comments[0].score)),
    ).toBeVisible();
  },
);

test(
  "UC-POST-22: ページリロード後も post・コメントの vote 状態が塗りつぶし表示で復元される（#831）",
  async ({ page }) => {
    let postMyVote: "up" | "down" | null = null;

    // スレッドデータはクロージャで postMyVote の最新値を読む（リロード後に my_vote: "up" を返す）
    await page.route(`**/api/posts/${MOCK_POST_ID}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          post: { ...MOCK_THREAD_WITH_URL.post, my_vote: postMyVote },
          comments: MOCK_THREAD_WITH_URL.comments,
        }),
      }),
    );
    await page.route("**/api/communities", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_COMMUNITY_LIST),
      }),
    );
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Unauthorized" }),
      }),
    );
    await page.route(`**/api/posts/${MOCK_POST_ID}/view`, (route) =>
      route.fulfill({ status: 202 }),
    );
    await page.route(`**/api/posts/${MOCK_POST_ID}/comment-views`, (route) =>
      route.fulfill({ status: 202 }),
    );
    await page.route(`**/api/communities/${MOCK_COMMUNITY_SLUG}/subscription`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ subscribed: false }),
      }),
    );
    // vote API: クロージャを更新して my_vote: "up" にする
    await page.route(`**/api/posts/${MOCK_POST_ID}/vote`, (route) => {
      postMyVote = "up";
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...MOCK_THREAD_WITH_URL.post, score: 6, my_vote: "up" }),
      });
    });

    await page.goto(`/posts/${MOCK_POST_ID}`);
    await expect(page.getByText(MOCK_THREAD_WITH_URL.post.title)).toBeVisible();

    // 投票前: post の vote ウィジェットは未投票状態
    const postVoteWidget = page.locator("[data-voted]").first();
    await expect(postVoteWidget).toHaveAttribute("data-voted", "none");

    // up vote する（route handler 完了を待ってから reload することで postMyVote が確実に "up" になる）
    const voteResponsePromise = page.waitForResponse(`**/api/posts/${MOCK_POST_ID}/vote`);
    await page.getByRole("button", { name: "up vote" }).first().click();
    await voteResponsePromise;

    // 投票後: vote ウィジェットが up 状態になる
    await expect(postVoteWidget).toHaveAttribute("data-voted", "up");

    // ページをリロード
    await page.reload();
    await expect(page.getByText(MOCK_THREAD_WITH_URL.post.title)).toBeVisible();

    // リロード後も vote 状態が復元される（スレッド API が my_vote: "up" を返すため）
    await expect(page.locator("[data-voted]").first()).toHaveAttribute("data-voted", "up");
  },
);

test(
  "UC-POST-23: コメントの共有リンクを開くと該当コメントまで自動スクロールされる（#861）",
  async ({ page }) => {
    const worker = await createWorker({ ...MOCK_WORKER_1 });
    const community = await createCommunity({ ...MOCK_COMMUNITY, workerIds: [worker.id] });
    const post = await createPost({
      communityId: community.id,
      workerId: worker.id,
      ...MOCK_POST,
    });
    // 初期表示のビューポート外までスクロールが必要になるよう十分な件数のコメントを用意する
    const comments = await Promise.all(
      [...Array(15).keys()].map((i) =>
        createComment({ postId: post.id, workerId: worker.id, text: `スクロールテスト用コメント本文 ${i}` }),
      ),
    );
    const targetComment = comments[comments.length - 1];

    // 共有リンク（#comment-$commentId 形式）を直接開く
    await page.goto(`/posts/${post.id}#comment-${targetComment.id}`);

    // 該当コメントが画面内（ビューポート）にスクロールして表示される
    await expect(page.locator(`#comment-${targetComment.id}`)).toBeInViewport();

    // クリーンアップ
    await Promise.all(comments.map((c) => c.delete()));
    await post.delete();
    await community.delete();
    await worker.delete();
  },
);
