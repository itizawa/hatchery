import { describe, expect, it } from "vitest";
import { PushPayloadSchema, PushSubscriptionSchema } from "./pushSubscription.js";

describe("PushSubscriptionSchema", () => {
  const valid = {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
    p256dh: "BNbxSamplePublicKey",
    auth: "SampleAuthKey",
  };

  it("有効なデータを受け入れる", () => {
    expect(() => PushSubscriptionSchema.parse(valid)).not.toThrow();
  });

  it("endpoint が URL でなければ失敗する", () => {
    expect(() => PushSubscriptionSchema.parse({ ...valid, endpoint: "not-a-url" })).toThrow();
  });

  it("endpoint が 2049 文字を超えると失敗する", () => {
    const longEndpoint = "https://example.com/" + "a".repeat(2030);
    expect(() => PushSubscriptionSchema.parse({ ...valid, endpoint: longEndpoint })).toThrow();
  });

  it("p256dh が 513 文字を超えると失敗する", () => {
    expect(() =>
      PushSubscriptionSchema.parse({ ...valid, p256dh: "a".repeat(513) }),
    ).toThrow();
  });

  it("auth が 129 文字を超えると失敗する", () => {
    expect(() =>
      PushSubscriptionSchema.parse({ ...valid, auth: "a".repeat(129) }),
    ).toThrow();
  });

  it("endpoint が空文字だと失敗する", () => {
    expect(() => PushSubscriptionSchema.parse({ ...valid, endpoint: "" })).toThrow();
  });
});

describe("PushPayloadSchema", () => {
  const valid = {
    title: "Hatchery",
    body: "新しい会話が生まれました",
    url: "/",
  };

  it("有効なデータを受け入れる", () => {
    expect(() => PushPayloadSchema.parse(valid)).not.toThrow();
  });

  it("title が 101 文字を超えると失敗する", () => {
    expect(() =>
      PushPayloadSchema.parse({ ...valid, title: "a".repeat(101) }),
    ).toThrow();
  });

  it("body が 301 文字を超えると失敗する", () => {
    expect(() =>
      PushPayloadSchema.parse({ ...valid, body: "a".repeat(301) }),
    ).toThrow();
  });

  it("url が 513 文字を超えると失敗する", () => {
    expect(() =>
      PushPayloadSchema.parse({ ...valid, url: "a".repeat(513) }),
    ).toThrow();
  });

  it("title が空文字だと失敗する", () => {
    expect(() => PushPayloadSchema.parse({ ...valid, title: "" })).toThrow();
  });
});
