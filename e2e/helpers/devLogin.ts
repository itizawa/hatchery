/** e2e テスト用開発ログインヘルパー（Issue #1101）。 */
import type { Page } from "@playwright/test";

/**
 * POST /api/auth/dev-login で db:seed 済みの開発用ユーザーとしてログインする（#455）。
 * page.request は page と同じブラウザコンテキストの Cookie ストアを共有するため、
 * この呼び出し後の page.goto() はログイン済みセッションで実行される。
 */
export async function devLogin(page: Page): Promise<void> {
  const res = await page.request.post("/api/auth/dev-login");
  if (!res.ok()) throw new Error(`devLogin failed: ${res.status()} ${await res.text()}`);
}
