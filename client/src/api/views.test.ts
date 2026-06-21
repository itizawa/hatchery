import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendCommentViewsBeacon, sendPostViewBeacon, useCommentImpressions } from "./views.js";

// ─── IntersectionObserver モック ────────────────────────────────────────────
// jsdom は IntersectionObserver 未実装のため、コールバックを手動でトリガーできるモックを用意する。

type MockIntersectionObserverCallback = (entries: IntersectionObserverEntry[]) => void;

let lastObserverCallback: MockIntersectionObserverCallback | null = null;
const observedElements: HTMLElement[] = [];

class MockIntersectionObserver {
  constructor(callback: MockIntersectionObserverCallback) {
    lastObserverCallback = callback;
  }
  observe(el: HTMLElement): void {
    observedElements.push(el);
  }
  unobserve(el: HTMLElement): void {
    const i = observedElements.indexOf(el);
    if (i !== -1) observedElements.splice(i, 1);
  }
  disconnect(): void {
    observedElements.length = 0;
    lastObserverCallback = null;
  }
  takeRecords(): [] {
    return [];
  }
}

function triggerIntersection({
  el,
  isIntersecting,
}: {
  el: HTMLElement;
  isIntersecting: boolean;
}): void {
  lastObserverCallback?.([
    {
      target: el,
      isIntersecting,
      intersectionRatio: isIntersecting ? 1 : 0,
      boundingClientRect: {} as DOMRectReadOnly,
      intersectionRect: {} as DOMRectReadOnly,
      rootBounds: null,
      time: Date.now(),
    } as IntersectionObserverEntry,
  ]);
}

// ─── sendJsonBeacon / sendPostViewBeacon ──────────────────────────────────────

describe("sendJsonBeacon（sendPostViewBeacon 経由）", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it("navigator.sendBeacon が true を返すとき fetch を呼ばない", () => {
    const sendBeaconMock = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", { sendBeacon: sendBeaconMock });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    sendPostViewBeacon("post-1");

    expect(sendBeaconMock).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sendBeacon が false を返すとき fetch(keepalive) にフォールバックする", async () => {
    const sendBeaconMock = vi.fn().mockReturnValue(false);
    vi.stubGlobal("navigator", { sendBeacon: sendBeaconMock });
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    sendPostViewBeacon("post-1");

    expect(sendBeaconMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.keepalive).toBe(true);
    expect(init.method).toBe("POST");
  });

  it("navigator に sendBeacon が無い環境で fetch(keepalive) を使う", async () => {
    vi.stubGlobal("navigator", {});
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    sendPostViewBeacon("post-1");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.keepalive).toBe(true);
  });
});

// ─── getOrCreateSessionId（sendPostViewBeacon 経由の間接検証）─────────────────

describe("getOrCreateSessionId（sendPostViewBeacon 経由）", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it("同一セッションで 2 回呼んでも beacon body に同じ sessionId が含まれる", async () => {
    // fetch フォールバック（navigator.sendBeacon なし）を使うとボディが JSON 文字列で取れる。
    vi.stubGlobal("navigator", {});
    const bodies: string[] = [];
    // eslint-disable-next-line max-params
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      bodies.push(init.body as string);
      return Promise.resolve(new Response(null, { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    sendPostViewBeacon("post-1");
    sendPostViewBeacon("post-2");

    expect(bodies).toHaveLength(2);
    const id1 = (JSON.parse(bodies[0]) as { sessionId: string }).sessionId;
    const id2 = (JSON.parse(bodies[1]) as { sessionId: string }).sessionId;
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("sessionStorage が例外を投げても beacon が送信される", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("sessionStorage unavailable");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("sessionStorage unavailable");
    });

    const sendBeaconMock = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", { sendBeacon: sendBeaconMock });

    sendPostViewBeacon("post-1");

    expect(sendBeaconMock).toHaveBeenCalledOnce();
  });
});

// ─── sendCommentViewsBeacon ─────────────────────────────────────────────────

describe("sendCommentViewsBeacon", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it("未送のコメントのみ送信し、既送済みは除外する", () => {
    // fetch フォールバック（navigator.sendBeacon なし）でボディを JSON 文字列として検証する。
    vi.stubGlobal("navigator", {});
    const fetchBodies: string[] = [];
    // eslint-disable-next-line max-params
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      fetchBodies.push(init.body as string);
      return Promise.resolve(new Response(null, { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    // 初回: comment-1 と comment-2 を送信 → 既読マーク
    sendCommentViewsBeacon("post-1", ["comment-1", "comment-2"]);
    expect(fetchMock).toHaveBeenCalledOnce();
    fetchMock.mockClear();
    fetchBodies.length = 0;

    // 2 回目: comment-2 は既送、comment-3 は未送 → comment-3 だけ送信される
    sendCommentViewsBeacon("post-1", ["comment-2", "comment-3"]);
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse(fetchBodies[0]) as { commentIds: string[] };
    expect(body.commentIds).toEqual(["comment-3"]);
  });

  it("全コメントが既送済みのとき sendBeacon も fetch も呼ばれない", () => {
    const sendBeaconMock = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", { sendBeacon: sendBeaconMock });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    // 初回送信で既送にマーク
    sendCommentViewsBeacon("post-1", ["comment-1"]);
    sendBeaconMock.mockClear();
    fetchMock.mockClear();

    // 再送 → 全て既送なので何も呼ばれない
    sendCommentViewsBeacon("post-1", ["comment-1"]);
    expect(sendBeaconMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ─── useCommentImpressions ──────────────────────────────────────────────────

describe("useCommentImpressions", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    lastObserverCallback = null;
    observedElements.length = 0;
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it("dwell(1s) 経過後に未送コメントが送信される", async () => {
    vi.useFakeTimers();
    const sendBeaconMock = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", { sendBeacon: sendBeaconMock });

    const { result } = renderHook(() => useCommentImpressions("post-1"));

    // コメント要素を作成・ref セット → IntersectionObserver に observe させる
    const el = document.createElement("div");
    el.dataset.commentId = "comment-a";
    act(() => {
      result.current.commentRef("comment-a")(el);
    });

    // 可視になったと通知
    act(() => {
      triggerIntersection({ el, isIntersecting: true });
    });

    // dwell(1s) 未満 → まだ送信されない
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(sendBeaconMock).not.toHaveBeenCalled();

    // dwell(1s) 経過 → 送信される
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(sendBeaconMock).toHaveBeenCalledOnce();
  });

  it("可視解除でタイマーがクリアされ dwell 後も送信されない", async () => {
    vi.useFakeTimers();
    const sendBeaconMock = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", { sendBeacon: sendBeaconMock });

    const { result } = renderHook(() => useCommentImpressions("post-1"));

    const el = document.createElement("div");
    el.dataset.commentId = "comment-b";
    act(() => {
      result.current.commentRef("comment-b")(el);
    });

    // 可視 → 500ms 経過後に可視解除
    act(() => {
      triggerIntersection({ el, isIntersecting: true });
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    act(() => {
      triggerIntersection({ el, isIntersecting: false });
    });

    // さらに 1s 経過しても送信されない
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(sendBeaconMock).not.toHaveBeenCalled();
  });
});
