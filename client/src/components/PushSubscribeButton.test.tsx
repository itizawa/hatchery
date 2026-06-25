import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/env.js", () => ({
  clientEnv: { vapidPublicKey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" },
}));

vi.mock("../api/push.js", () => ({
  subscribePush: vi.fn().mockResolvedValue(undefined),
  unsubscribePush: vi.fn().mockResolvedValue(undefined),
}));

import { clientEnv } from "../config/env.js";
import * as pushApi from "../api/push.js";

import { PushSubscribeButton } from "./PushSubscribeButton";

const VAPID_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

function fakeSub({ endpoint = "https://fcm.example.com/1" } = {}) {
  return {
    endpoint,
    toJSON: () => ({ endpoint, keys: { p256dh: "pk", auth: "ak" } }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  } as unknown as PushSubscription;
}

function setupPush({
  permission = "default" as NotificationPermission,
  existingSub = null as PushSubscription | null,
} = {}) {
  vi.stubGlobal("Notification", { permission });

  const mockSubscribe = vi.fn().mockResolvedValue(fakeSub());
  const mockGetSub = vi.fn().mockResolvedValue(existingSub);
  const mockReg = { pushManager: { subscribe: mockSubscribe, getSubscription: mockGetSub } };

  Object.defineProperty(navigator, "serviceWorker", {
    value: { ready: Promise.resolve(mockReg) },
    writable: true,
    configurable: true,
  });

  Object.defineProperty(window, "PushManager", {
    value: class {},
    writable: true,
    configurable: true,
  });

  return { mockSubscribe, mockGetSub };
}

describe("PushSubscribeButton", () => {
  beforeEach(() => {
    clientEnv.vapidPublicKey = VAPID_KEY;
    vi.clearAllMocks();
  });

  it("VAPID 公開鍵未設定のとき null をレンダリングする（非表示）", () => {
    clientEnv.vapidPublicKey = undefined;
    const { container } = render(<PushSubscribeButton />);
    expect(container.firstChild).toBeNull();
  });

  it("通知権限が denied のときブロックメッセージを表示する", async () => {
    setupPush({ permission: "denied" });
    render(<PushSubscribeButton />);
    expect(
      await screen.findByText("通知がブロックされています。ブラウザの設定から通知を許可してください。"),
    ).toBeInTheDocument();
  });

  it("通知権限が denied のときボタンを表示しない", async () => {
    setupPush({ permission: "denied" });
    render(<PushSubscribeButton />);
    await screen.findByText("通知がブロックされています。ブラウザの設定から通知を許可してください。");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("未購読の場合「新着通知を受け取る」ボタンを表示する", async () => {
    setupPush();
    render(<PushSubscribeButton />);
    expect(await screen.findByRole("button", { name: /新着通知を受け取る/ })).toBeInTheDocument();
  });

  it("購読済みの場合「通知をオフにする」ボタンを表示する", async () => {
    setupPush({ existingSub: fakeSub() });
    render(<PushSubscribeButton />);
    expect(await screen.findByRole("button", { name: /通知をオフにする/ })).toBeInTheDocument();
  });

  it("「新着通知を受け取る」クリックで subscribePush が呼ばれて購読済みになる", async () => {
    const { mockSubscribe } = setupPush();
    render(<PushSubscribeButton />);

    await userEvent.click(await screen.findByRole("button", { name: /新着通知を受け取る/ }));

    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(pushApi.subscribePush).toHaveBeenCalledWith({
      endpoint: "https://fcm.example.com/1",
      p256dh: "pk",
      auth: "ak",
    });
    expect(await screen.findByRole("button", { name: /通知をオフにする/ })).toBeInTheDocument();
  });

  it("「通知をオフにする」クリックで unsubscribePush が呼ばれて未購読になる", async () => {
    const sub = fakeSub();
    setupPush({ existingSub: sub });
    render(<PushSubscribeButton />);

    await userEvent.click(await screen.findByRole("button", { name: /通知をオフにする/ }));

    expect(pushApi.unsubscribePush).toHaveBeenCalledWith({
      endpoint: "https://fcm.example.com/1",
    });
    expect(sub.unsubscribe).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: /新着通知を受け取る/ })).toBeInTheDocument();
  });
});
