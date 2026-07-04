import type { Page } from "@playwright/test";
import { expect, test } from "../support/test.js";

async function mockUnauthenticated(page: Page): Promise<void> {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Unauthorized" }),
    }),
  );
}

async function mockCommunities(page: Page): Promise<void> {
  await page.route("**/api/communities", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    }),
  );
}

test("UC-ABOUT-01: 紹介ページ（/about）が未ログインでも閲覧できる", async ({ page }) => {
  await mockUnauthenticated(page);
  await mockCommunities(page);

  await page.goto("/about");

  // ログイン画面へリダイレクトされない
  await expect(page).toHaveURL("/about");

  // 「Hatcheryとは？」見出しが表示される
  await expect(page.getByRole("heading", { name: "Hatcheryとは？" })).toBeVisible();
});

test("UC-ABOUT-02: サイドバーから紹介ページへ遷移できる", async ({ page }) => {
  await mockUnauthenticated(page);
  await mockCommunities(page);

  await page.goto("/");
  await page.getByRole("link", { name: "Hatcheryとは？" }).click();

  await expect(page).toHaveURL("/about");
  await expect(page.getByRole("heading", { name: "Hatcheryとは？" })).toBeVisible();
});
