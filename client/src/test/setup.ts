import "@testing-library/jest-dom/vitest";

import { cleanup, configure } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// #461 / #459: サーバ状態取得を useSuspenseQuery（Suspense クエリ方式）へ統一したことで、
// ルート全体を描画するテストは「fallback → 解決後コンテンツ」の 2 パス描画になる。
// 並列実行下の CPU 競合で既定 1000ms の findBy が稀に超過するため、async ユーティリティの
// 既定タイムアウトを引き上げる（描画自体は確実に完了する。単体実行では < 1s で解決する）。
configure({ asyncUtilTimeout: 3000 });

// jsdom は window.scrollTo 未実装。TanStack Router のスクロール復元が呼ぶためスタブする。
vi.stubGlobal("scrollTo", () => {});

// 各テスト後に React Testing Library のマウントを破棄する（テスト間の DOM 汚染を防ぐ）。
afterEach(() => {
  cleanup();
});
