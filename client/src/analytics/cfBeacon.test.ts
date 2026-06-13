import { afterEach, describe, expect, it, vi } from "vitest";

import { notifyCfPageView } from "./cfBeacon";

describe("notifyCfPageView（Cloudflare ビーコンへの SPA ページビュー通知）", () => {
  afterEach(() => {
    // 各テストで触る window.__cfBeacon を毎回掃除する。
    delete (window as { __cfBeacon?: unknown }).__cfBeacon;
    vi.restoreAllMocks();
  });

  // 受け入れ条件 #3: ビーコン未ロード（window.__cfBeacon 不在）でも例外を投げず no-op。
  it("window.__cfBeacon が存在しないとき例外を投げず no-op になる", () => {
    delete (window as { __cfBeacon?: unknown }).__cfBeacon;
    expect(() => notifyCfPageView()).not.toThrow();
  });

  // 受け入れ条件 #2 の通知本体: window.__cfBeacon.push に page イベントを 1 回送る。
  it("window.__cfBeacon が存在するとき push に { type: 'page' } を 1 回送る", () => {
    const push = vi.fn();
    (window as { __cfBeacon?: { push: (e: unknown) => void } }).__cfBeacon = { push };

    notifyCfPageView();

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith({ type: "page" });
  });

  // push が無い不正な __cfBeacon でも no-op（防御的ガード）。
  it("window.__cfBeacon に push が無いとき例外を投げず no-op になる", () => {
    (window as { __cfBeacon?: unknown }).__cfBeacon = {};
    expect(() => notifyCfPageView()).not.toThrow();
  });
});
