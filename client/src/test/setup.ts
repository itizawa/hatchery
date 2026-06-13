import "@testing-library/jest-dom/vitest";

import { cleanup, configure } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// #461 / #459: サーバ状態取得を useSuspenseQuery（Suspense クエリ方式）へ統一したことで、
// ルート全体を描画するテストは「fallback → 解決後コンテンツ」の 2 パス描画になる。
// 並列実行下の CPU 競合（特に CI の低速ランナー）で既定 1000ms の findBy が超過するため、
// async ユーティリティの既定タイムアウトを引き上げる。描画自体は確実に完了するため
// 誤った緑にはならず（単体実行では < 1.5s で解決）、失敗時の報告がやや遅くなるだけ。
configure({ asyncUtilTimeout: 5000 });

// jsdom は window.scrollTo 未実装。TanStack Router のスクロール復元が呼ぶためスタブする。
vi.stubGlobal("scrollTo", () => {});

// 各テスト後に React Testing Library のマウントを破棄する（テスト間の DOM 汚染を防ぐ）。
afterEach(() => {
  cleanup();
  // MUI Modal/Dialog（#454 のログインモーダル等）はポータル先（document.body）の兄弟要素へ
  // aria-hidden を付与する。モーダルを開いたままテストが終わると、cleanup 後も body 配下に
  // aria-hidden が残り、後続テストの role ベースクエリが要素を見つけられなくなる（ファイル跨ぎの汚染）。
  // 残存した MUI ポータル要素と aria-hidden を明示的に除去してテスト間を確実に分離する。
  // jsdom 環境以外（node 環境の純粋ユニットテスト）では document が無いためガードする。
  if (typeof document !== "undefined") {
    document.body
      .querySelectorAll("[aria-hidden]")
      .forEach((el) => el.removeAttribute("aria-hidden"));
    document.body
      .querySelectorAll(".MuiModal-root, .MuiPopover-root, .MuiPopper-root")
      .forEach((el) => el.remove());
  }
});
