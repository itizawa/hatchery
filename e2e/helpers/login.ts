/** e2e テスト用ログインヘルパー（Issue #897）。 */
import type { Page } from "@playwright/test";

interface LoginUser {
  email: string;
  password: string;
}

export async function login({ page, user }: { page: Page; user: LoginUser }): Promise<void> {
  await page.goto("/auth/login");
  await page.fill('[name="email"]', user.email);
  await page.fill('[name="password"]', user.password);
  await page.click('[type="submit"]');
  await page.waitForURL("/");
}
