import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PushSubscriptionRecord } from "../persistence/pushSubscriptionRepository.js";
import {
  createPushNotificationService,
  type PushNotificationConfig,
} from "./pushNotificationService.js";

const { mockSetVapidDetails, mockSendNotification } = vi.hoisted(() => ({
  mockSetVapidDetails: vi.fn(),
  mockSendNotification: vi.fn(),
}));

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: mockSetVapidDetails,
    sendNotification: mockSendNotification,
  },
}));

beforeEach(() => {
  mockSetVapidDetails.mockReset();
  mockSendNotification.mockReset();
});

const vapidConfig: PushNotificationConfig = {
  publicKey: "public-key",
  privateKey: "private-key",
  subject: "mailto:test@example.com",
};

const subs: PushSubscriptionRecord[] = [
  { id: "s1", userId: "u1", endpoint: "https://fcm.example.com/1", p256dh: "key1", auth: "auth1", createdAt: new Date() },
  { id: "s2", userId: "u2", endpoint: "https://fcm.example.com/2", p256dh: "key2", auth: "auth2", createdAt: new Date() },
];

describe("createPushNotificationService", () => {
  it("sendToAllSubscribers が全購読者に通知を送る", async () => {
    mockSendNotification.mockResolvedValue({ statusCode: 201 });
    const repo = { listAll: vi.fn().mockResolvedValue(subs), delete: vi.fn(), deleteByEndpointAndUserId: vi.fn(), upsert: vi.fn(), deleteByUserId: vi.fn() };
    const service = createPushNotificationService({ config: vapidConfig, pushSubscriptionRepo: repo });

    await service.sendToAllSubscribers({ title: "Test", body: "テスト通知", url: "/" });

    expect(mockSendNotification).toHaveBeenCalledTimes(2);
  });

  it("購読者が 0 人のときは sendNotification を呼ばない", async () => {
    const repo = { listAll: vi.fn().mockResolvedValue([]), delete: vi.fn(), deleteByEndpointAndUserId: vi.fn(), upsert: vi.fn(), deleteByUserId: vi.fn() };
    const service = createPushNotificationService({ config: vapidConfig, pushSubscriptionRepo: repo });

    await service.sendToAllSubscribers({ title: "Test", body: "テスト通知", url: "/" });

    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("1 件の送信失敗は全体をスローしない（fire-and-forget）", async () => {
    mockSendNotification
      .mockResolvedValueOnce({ statusCode: 201 })
      .mockRejectedValueOnce(new Error("送信失敗"));
    const repo = { listAll: vi.fn().mockResolvedValue(subs), delete: vi.fn(), deleteByEndpointAndUserId: vi.fn(), upsert: vi.fn(), deleteByUserId: vi.fn() };
    const service = createPushNotificationService({ config: vapidConfig, pushSubscriptionRepo: repo });

    await expect(
      service.sendToAllSubscribers({ title: "Test", body: "テスト通知", url: "/" }),
    ).resolves.not.toThrow();
  });

  it("410 レスポンスの購読はリポジトリから削除する", async () => {
    const error = Object.assign(new Error("Gone"), { statusCode: 410 });
    mockSendNotification.mockRejectedValue(error);
    const repo = { listAll: vi.fn().mockResolvedValue([subs[0]!]), delete: vi.fn(), deleteByEndpointAndUserId: vi.fn(), upsert: vi.fn(), deleteByUserId: vi.fn() };
    const service = createPushNotificationService({ config: vapidConfig, pushSubscriptionRepo: repo });

    await service.sendToAllSubscribers({ title: "Test", body: "テスト通知", url: "/" });

    expect(repo.delete).toHaveBeenCalledWith(subs[0]!.endpoint);
  });

  it("401 レスポンスは購読を削除せず全体をスローしない（VAPID 認証エラー）", async () => {
    const error = Object.assign(new Error("Unauthorized"), { statusCode: 401 });
    mockSendNotification.mockRejectedValue(error);
    const repo = { listAll: vi.fn().mockResolvedValue([subs[0]!]), delete: vi.fn(), deleteByEndpointAndUserId: vi.fn(), upsert: vi.fn(), deleteByUserId: vi.fn() };
    const service = createPushNotificationService({ config: vapidConfig, pushSubscriptionRepo: repo });

    await expect(
      service.sendToAllSubscribers({ title: "Test", body: "テスト通知", url: "/" }),
    ).resolves.not.toThrow();

    expect(repo.delete).not.toHaveBeenCalled();
  });
});
