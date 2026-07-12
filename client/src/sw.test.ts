import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("workbox-precaching", () => ({
  cleanupOutdatedCaches: vi.fn(),
  matchPrecache: vi.fn(),
  precacheAndRoute: vi.fn(),
}));
vi.mock("workbox-routing", () => ({
  NavigationRoute: vi.fn(),
  registerRoute: vi.fn(),
}));

type Listener = (event: unknown) => void;

interface SelfMock {
  __WB_MANIFEST: unknown[];
  skipWaiting: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  clients: {
    claim: ReturnType<typeof vi.fn>;
    matchAll: ReturnType<typeof vi.fn>;
    openWindow: ReturnType<typeof vi.fn>;
  };
  registration: {
    showNotification: ReturnType<typeof vi.fn>;
  };
  location: { origin: string };
  listeners: Record<string, Listener[]>;
}

function createSelfMock(): SelfMock {
  const listeners: Record<string, Listener[]> = {};
  return {
    __WB_MANIFEST: [],
    skipWaiting: vi.fn(),
    // eslint-disable-next-line max-params
    addEventListener: vi.fn((type: string, handler: Listener) => {
      listeners[type] = listeners[type] ?? [];
      listeners[type].push(handler);
    }),
    clients: {
      claim: vi.fn().mockResolvedValue(undefined),
      matchAll: vi.fn().mockResolvedValue([]),
      openWindow: vi.fn().mockResolvedValue(undefined),
    },
    registration: {
      showNotification: vi.fn().mockResolvedValue(undefined),
    },
    location: { origin: "https://hatchery.example" },
    listeners,
  };
}

async function loadSwWithSelfMock(): Promise<SelfMock> {
  const selfMock = createSelfMock();
  vi.stubGlobal("self", selfMock);
  vi.resetModules();
  await import("./sw.js");
  return selfMock;
}

function createWaitUntilEvent<T extends Record<string, unknown>>(
  extra: T,
): T & { waitUntil: ReturnType<typeof vi.fn> } {
  return { ...extra, waitUntil: vi.fn() };
}

describe("sw.ts push イベント", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("JSON パース成功時: パース結果の title/body/url で showNotification が呼ばれる", async () => {
    const selfMock = await loadSwWithSelfMock();
    const [pushHandler] = selfMock.listeners.push;

    const event = createWaitUntilEvent({
      data: {
        json: () => ({ title: "新着コメント", body: "誰かが返信しました", url: "/posts/1" }),
        text: () => "",
      },
    });

    pushHandler(event);
    await event.waitUntil.mock.calls[0][0];

    expect(selfMock.registration.showNotification).toHaveBeenCalledWith(
      "新着コメント",
      expect.objectContaining({
        body: "誰かが返信しました",
        data: { url: "/posts/1" },
      }),
    );
  });

  it("JSON パース失敗時: event.data.text() の内容で body フォールバックされる", async () => {
    const selfMock = await loadSwWithSelfMock();
    const [pushHandler] = selfMock.listeners.push;

    const event = createWaitUntilEvent({
      data: {
        json: () => {
          throw new Error("invalid json");
        },
        text: () => "プレーンテキストの通知",
      },
    });

    pushHandler(event);
    await event.waitUntil.mock.calls[0][0];

    expect(selfMock.registration.showNotification).toHaveBeenCalledWith(
      "Hatchery",
      expect.objectContaining({ body: "プレーンテキストの通知" }),
    );
  });
});

describe("sw.ts notificationclick イベント", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("一致する既存タブがある場合: focus() が呼ばれ openWindow() は呼ばれない", async () => {
    const selfMock = await loadSwWithSelfMock();
    const [clickHandler] = selfMock.listeners.notificationclick;

    const focus = vi.fn().mockResolvedValue(undefined);
    selfMock.clients.matchAll.mockResolvedValue([
      { url: "https://hatchery.example/posts/1", focus },
    ]);

    const event = createWaitUntilEvent({
      notification: { close: vi.fn(), data: { url: "/posts/1" } },
    });

    clickHandler(event);
    await event.waitUntil.mock.calls[0][0];

    expect(focus).toHaveBeenCalledTimes(1);
    expect(selfMock.clients.openWindow).not.toHaveBeenCalled();
    expect(event.notification.close).toHaveBeenCalledTimes(1);
  });

  it("一致する既存タブが無い場合: openWindow() が解決後 URL で呼ばれる", async () => {
    const selfMock = await loadSwWithSelfMock();
    const [clickHandler] = selfMock.listeners.notificationclick;

    selfMock.clients.matchAll.mockResolvedValue([]);

    const event = createWaitUntilEvent({
      notification: { close: vi.fn(), data: { url: "/posts/2" } },
    });

    clickHandler(event);
    await event.waitUntil.mock.calls[0][0];

    expect(selfMock.clients.openWindow).toHaveBeenCalledWith("https://hatchery.example/posts/2");
  });
});
