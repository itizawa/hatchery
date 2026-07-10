import type { Page } from "@playwright/test";
import { expect, test } from "../support/test.js";

/**
 * search e2e テスト（#1097）。
 *
 * e2e/search/usecases.md の UC-SEARCH-01〜10 に対応する。
 * page.route() で API をモックし、バックエンドなしでブラウザ側の挙動を検証する。
 */

const MOCK_POST = {
  id: "post-1",
  community_id: "community-1",
  slot_key: "2024-01-01",
  seq: 1,
  author: "worker-1",
  title: "テスト投稿タイトル",
  text: "テスト投稿本文",
  score: 5,
  created_at: "2024-01-01T00:00:00Z",
  comment_count: 0,
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

async function mockCommunitiesApi(page: Page): Promise<void> {
  await page.route("**/api/communities", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    }),
  );
}

async function mockSearchApi({
  page,
  posts = [],
}: {
  page: Page;
  posts?: unknown[];
}): Promise<void> {
  await page.route("**/api/posts/search**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(posts),
    }),
  );
}

// ─── テスト ──────────────────────────────────────────────────────

test("UC-SEARCH-01: ヘッダーの検索欄にキーワードを入力すると、どのページからでも検索結果ページへ遷移できる", async ({
  page,
}) => {
  await mockUnauthenticated(page);
  await mockCommunitiesApi(page);
  await mockSearchApi({ page, posts: [MOCK_POST] });

  await page.goto("/");

  const searchBox = page.getByRole("searchbox", { name: "投稿を検索" });
  await searchBox.fill(MOCK_POST.title);
  await searchBox.press("Enter");

  await expect(page).toHaveURL(`/search?q=${encodeURIComponent(MOCK_POST.title)}`);
  await expect(page.getByRole("heading", { name: MOCK_POST.title })).toBeVisible();
});

test.todo(
  "UC-SEARCH-02: ヘッダーの検索欄で何も入力せず Enter を押すと案内テキストの検索ページが表示される",
);

test.todo("UC-SEARCH-03: /search を開いている間、ヘッダーの検索欄に現在のキーワードが表示される");

test("UC-SEARCH-04: ヘッダーの検索欄からキーワードを入力して Enter を押すと検索結果が表示される", async ({
  page,
}) => {
  await mockUnauthenticated(page);
  await mockCommunitiesApi(page);
  await mockSearchApi({ page, posts: [MOCK_POST] });

  await page.goto("/search");

  const searchBox = page.getByRole("searchbox", { name: "投稿を検索" });
  await searchBox.fill(MOCK_POST.title);
  await searchBox.press("Enter");

  await expect(page).toHaveURL(`/search?q=${encodeURIComponent(MOCK_POST.title)}`);
  await expect(page.getByRole("heading", { name: MOCK_POST.title })).toBeVisible();
  await expect(page.getByText("1 件の投稿が見つかりました")).toBeVisible();
});

test.todo("UC-SEARCH-05: 検索結果の投稿カードをクリックするとスレッドページへ遷移できる");

test("UC-SEARCH-06: キーワードにヒットする投稿が 0 件のとき「見つかりませんでした」が表示される", async ({
  page,
}) => {
  await mockUnauthenticated(page);
  await mockCommunitiesApi(page);
  await mockSearchApi({ page, posts: [] });

  await page.goto("/search");

  const keyword = "ヒットしないワード";
  const searchBox = page.getByRole("searchbox", { name: "投稿を検索" });
  await searchBox.fill(keyword);
  await searchBox.press("Enter");

  await expect(page).toHaveURL(`/search?q=${encodeURIComponent(keyword)}`);
  await expect(
    page.getByText("「ヒットしないワード」に一致する投稿が見つかりませんでした。"),
  ).toBeVisible();
});

test("UC-SEARCH-07: 検索クエリなしで /search を開くと案内テキストが表示される", async ({
  page,
}) => {
  await mockUnauthenticated(page);
  await mockCommunitiesApi(page);

  await page.goto("/search");

  await expect(page.getByText("キーワードを入力して投稿を検索できます。")).toBeVisible();
});

test.todo("UC-SEARCH-08: URL の q パラメータを直接書き換えると検索結果が切り替わる");

test.todo("UC-SEARCH-09: 検索結果カードの発言者がワーカーの表示名で表示される（#1058）");

test.todo("UC-SEARCH-10: 既に vote 済みの投稿は検索結果でも vote 済み表示になる（#1059）");
