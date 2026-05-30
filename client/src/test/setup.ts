import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom は window.scrollTo 未実装。TanStack Router のスクロール復元が呼ぶためスタブする。
vi.stubGlobal("scrollTo", () => {});

// 各テスト後に React Testing Library のマウントを破棄する（テスト間の DOM 汚染を防ぐ）。
afterEach(() => {
  cleanup();
});
