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

// eslint-disable-next-line max-params
function buildRepo(listByUserIdsResult: typeof subs) {
  return {
    listAll: vi.fn(),
    listByUserIds: vi.fn().mockResolvedValue(listByUserIdsResult),
    delete: vi.fn(),
    deleteByEndpointAndUserId: vi.fn(),
    upsert: vi.fn(),
    deleteByUserId: vi.fn(),
  };
}

describe("createPushNotificationService", () => {
  it("sendToUsers が指定 userId の購読者のみに通知を送る（#1088）", async () => {
    mockSendNotification.mockResolvedValue({ statusCode: 201 });
    const repo = buildRepo(subs);
    const service = createPushNotificationService({ config: vapidConfig, pushSubscriptionRepo: repo });

    await service.sendToUsers({ title: "Test", body: "テスト通知", url: "/" }, ["u1", "u2"]);

    expect(repo.listByUserIds).toHaveBeenCalledWith(["u1", "u2"]);
    expect(mockSendNotification).toHaveBeenCalledTimes(2);
  });

  it("userIds が空配列のときは listByUserIds も sendNotification も呼ばない（#1088）", async () => {
    const repo = buildRepo([]);
    const service = createPushNotificationService({ config: vapidConfig, pushSubscriptionRepo: repo });

    await service.sendToUsers({ title: "Test", body: "テスト通知", url: "/" }, []);

    expect(repo.listByUserIds).not.toHaveBeenCalled();
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("購読者が 0 人のときは sendNotification を呼ばない", async () => {
    const repo = buildRepo([]);
    const service = createPushNotificationService({ config: vapidConfig, pushSubscriptionRepo: repo });

    await service.sendToUsers({ title: "Test", body: "テスト通知", url: "/" }, ["u1"]);

    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("1 件の送信失敗は全体をスローしない（fire-and-forget）", async () => {
    mockSendNotification
      .mockResolvedValueOnce({ statusCode: 201 })
      .mockRejectedValueOnce(new Error("送信失敗"));
    const repo = buildRepo(subs);
    const service = createPushNotificationService({ config: vapidConfig, pushSubscriptionRepo: repo });

    await expect(
      service.sendToUsers({ title: "Test", body: "テスト通知", url: "/" }, ["u1", "u2"]),
    ).resolves.not.toThrow();
  });

  it("410 レスポンスの購読はリポジトリから削除する", async () => {
    const error = Object.assign(new Error("Gone"), { statusCode: 410 });
    mockSendNotification.mockRejectedValue(error);
    const repo = buildRepo([subs[0]!]);
    const service = createPushNotificationService({ config: vapidConfig, pushSubscriptionRepo: repo });

    await service.sendToUsers({ title: "Test", body: "テスト通知", url: "/" }, ["u1"]);

    expect(repo.delete).toHaveBeenCalledWith(subs[0]!.endpoint);
  });

  it("401 レスポンスは購読を削除せず全体をスローしない（VAPID 認証エラー）", async () => {
    const error = Object.assign(new Error("Unauthorized"), { statusCode: 401 });
    mockSendNotification.mockRejectedValue(error);
    const repo = buildRepo([subs[0]!]);
    const service = createPushNotificationService({ config: vapidConfig, pushSubscriptionRepo: repo });

    await expect(
      service.sendToUsers({ title: "Test", body: "テスト通知", url: "/" }, ["u1"]),
    ).resolves.not.toThrow();

    expect(repo.delete).not.toHaveBeenCalled();
  });
});
