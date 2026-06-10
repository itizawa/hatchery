import { describe, expect, it } from "vitest";

import { decideHeaderVisibility, MIN_SCROLL_DELTA, TOP_THRESHOLD } from "./scrollHeader.js";

// Issue #302: スクロール方向 → ヘッダ表示可否の純粋関数
describe("decideHeaderVisibility (#302)", () => {
  it("下スクロール（位置が増加）でヘッダを非表示にする", () => {
    const prev = { lastScrollTop: 100, hidden: false };
    const next = decideHeaderVisibility(prev, {
      currentScrollTop: 100 + MIN_SCROLL_DELTA + 1,
      topThreshold: TOP_THRESHOLD,
      minDelta: MIN_SCROLL_DELTA,
    });
    expect(next.hidden).toBe(true);
    expect(next.lastScrollTop).toBe(100 + MIN_SCROLL_DELTA + 1);
  });

  it("上スクロール（位置が減少）でヘッダを表示する", () => {
    const prev = { lastScrollTop: 300, hidden: true };
    const next = decideHeaderVisibility(prev, {
      currentScrollTop: 300 - MIN_SCROLL_DELTA - 1,
      topThreshold: TOP_THRESHOLD,
      minDelta: MIN_SCROLL_DELTA,
    });
    expect(next.hidden).toBe(false);
    expect(next.lastScrollTop).toBe(300 - MIN_SCROLL_DELTA - 1);
  });

  it("最上部付近（しきい値以下）では下スクロール中でも常に表示する", () => {
    const prev = { lastScrollTop: 0, hidden: false };
    const next = decideHeaderVisibility(prev, {
      currentScrollTop: TOP_THRESHOLD,
      topThreshold: TOP_THRESHOLD,
      minDelta: MIN_SCROLL_DELTA,
    });
    expect(next.hidden).toBe(false);
  });

  it("非表示状態でも最上部付近まで戻れば表示する", () => {
    const prev = { lastScrollTop: 500, hidden: true };
    const next = decideHeaderVisibility(prev, {
      currentScrollTop: 0,
      topThreshold: TOP_THRESHOLD,
      minDelta: MIN_SCROLL_DELTA,
    });
    expect(next.hidden).toBe(false);
  });

  it("しきい値未満の微小スクロールでは状態を維持しチラつかせない", () => {
    const prev = { lastScrollTop: 200, hidden: true };
    const next = decideHeaderVisibility(prev, {
      currentScrollTop: 200 + MIN_SCROLL_DELTA - 1,
      topThreshold: TOP_THRESHOLD,
      minDelta: MIN_SCROLL_DELTA,
    });
    expect(next.hidden).toBe(true);
    // 微小移動は基準位置を更新しない（累積で誤判定しないため）
    expect(next.lastScrollTop).toBe(200);
  });

  it("微小スクロール（表示中）でも表示状態を維持する", () => {
    const prev = { lastScrollTop: 200, hidden: false };
    const next = decideHeaderVisibility(prev, {
      currentScrollTop: 200 - (MIN_SCROLL_DELTA - 1),
      topThreshold: TOP_THRESHOLD,
      minDelta: MIN_SCROLL_DELTA,
    });
    expect(next.hidden).toBe(false);
    expect(next.lastScrollTop).toBe(200);
  });

  it("定数 TOP_THRESHOLD / MIN_SCROLL_DELTA が正の値で公開される", () => {
    expect(TOP_THRESHOLD).toBeGreaterThan(0);
    expect(MIN_SCROLL_DELTA).toBeGreaterThan(0);
  });
});
