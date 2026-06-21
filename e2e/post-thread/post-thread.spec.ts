import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createWorker } from "../helpers/createWorker";
import { createCommunity } from "../helpers/createCommunity";
import { createPost } from "../helpers/createPost";
import { createComment } from "../helpers/createComment";
import { login } from "../helpers/login";
import { createUser } from "../helpers/createUser";
import { logout } from "../helpers/logout";

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

test.todo("UC-POST-02: コメントが 0 件の投稿ではコメントセクションが表示されない");

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
    await login(page, user);

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
    await login(page, user);

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

test.todo("UC-POST-05: スレッドに投稿・コメントの入力欄が存在しない");

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
  "UC-POST-08: 未ログインユーザーが post / comment の vote を押すとログイン誘導が表示される（#481）",
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

    // ログイン誘導スナックバーが表示される
    await expect(page.getByText("投票するにはログインが必要です")).toBeVisible();

    // クリーンアップ
    await post.delete();
    await community.delete();
    await worker.delete();
  },
);

test.todo(
  "UC-POST-09: スレッドページに所属コミュニティの詳細サイドバーと購読ボタンが表示される（#499）",
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

test.todo(
  "UC-POST-11: スレッドの post / コメント本文が Markdown 書式で表示される（#513）",
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

    // OGP API: 成功ケース（タイトルあり）
    await page.route("**/api/ogp?*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          title: "テスト記事タイトル",
          description: "テスト記事の説明",
          image: "https://example.com/og.jpg",
          site_name: "Example Site",
        }),
      }),
    );

    await page.goto(`/posts/${MOCK_POST_ID}`);

    // post 本文と OGP カード（role="link" として描画）が表示される
    // OGP カードは複数出現しうる（post 本文 + コメント本文）
    await expect(page.getByRole("link", { name: /テスト記事タイトル/ }).first()).toBeVisible();
    // OGP タイトルテキストが表示される
    await expect(page.getByText("テスト記事タイトル").first()).toBeVisible();
  },
);

test(
  "UC-POST-13（フォールバック）: OGP 取得失敗時は OGP カードが表示されず URL リンクのみ残る",
  async ({ page }) => {
    await setupThreadCommonMocks({ page, thread: MOCK_THREAD_WITH_URL });

    // OGP API: 失敗ケース（title なし）
    await page.route("**/api/ogp?*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ title: null, description: null, image: null, site_name: null }),
      }),
    );

    await page.goto(`/posts/${MOCK_POST_ID}`);

    // OGP カード（role="link" + "テスト記事タイトル"）は表示されない
    await expect(page.getByRole("link", { name: /テスト記事タイトル/ })).not.toBeVisible();
    // post 本文自体は表示される
    await expect(page.getByText("こちらの記事をご覧ください")).toBeVisible();
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

test.todo(
  "UC-POST-16: 返信コメントに Reddit 風 L 字コネクターが表示される（#746）",
);

test.todo(
  "UC-POST-18: vote ミューテーション進行中は vote ボタンが disabled になる（#748）",
);

test.todo(
  "UC-POST-19: 返信を持つコメントのアバター下にスレッドコネクターが表示される（#796）",
);

test.todo(
  "UC-POST-20: コメントに共有ボタンが表示され、コメントへのパーマリンクをコピー／X でシェアできる（#775）",
);

test.todo(
  "UC-POST-21: vote ウィジェットに表示される数字は up vote の累計件数である（#814）",
);
