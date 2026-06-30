/** e2e テスト用ログアウトヘルパー（Issue #897）。 */
import type { Page } from "@playwright/test";

export async function logout(page: Page): Promise<void> {
  await page.goto("/auth/logout");
  await page.waitForURL("/");
}
