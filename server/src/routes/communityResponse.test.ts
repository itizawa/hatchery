import { describe, expect, it } from "vitest";

import { toAdminCommunityResponse, toCommunityResponse } from "./communityResponse.js";
import type { CommunityRecord } from "../persistence/communityRepository.js";

const baseRecord: CommunityRecord = {
  id: "community-1",
  slug: "general",
  name: "General",
  description: "A general community",
  synopsis: "Weekly discussion",
  lastSlotKey: "2026-06-15T09:00",
  iconUrl: "https://example.com/icon.png",
  coverUrl: "https://example.com/cover.png",
  generationInstruction: "Write in a casual tone",
  feedUrl: null,
  generationPaused: false,
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

describe("toCommunityResponse", () => {
  it("全フィールドを snake_case の公開 API 形式に変換する", () => {
    const res = toCommunityResponse(baseRecord);
    expect(res).toEqual({
      id: "community-1",
      slug: "general",
      name: "General",
      description: "A general community",
      synopsis: "Weekly discussion",
      last_slot_key: "2026-06-15T09:00",
      iconUrl: "https://example.com/icon.png",
      coverUrl: "https://example.com/cover.png",
      created_at: baseRecord.createdAt,
      post_count: 0,
      last_post_at: null,
      subscriber_count: 0,
    });
  });

  it("synopsis が null のとき undefined（optional フィールド）として出力される", () => {
    const res = toCommunityResponse({ ...baseRecord, synopsis: null }) as Record<string, unknown>;
    expect(res.synopsis).toBeUndefined();
  });

  it("lastSlotKey が null のとき last_slot_key が undefined として出力される", () => {
    const res = toCommunityResponse({ ...baseRecord, lastSlotKey: null }) as Record<string, unknown>;
    expect(res.last_slot_key).toBeUndefined();
  });

  it("iconUrl が null のとき null のまま出力される（undefined にならない・#457）", () => {
    const res = toCommunityResponse({ ...baseRecord, iconUrl: null }) as Record<string, unknown>;
    expect(res.iconUrl).toBeNull();
    expect(res).toHaveProperty("iconUrl");
  });

  it("coverUrl が null のとき null のまま出力される（undefined にならない・#457）", () => {
    const res = toCommunityResponse({ ...baseRecord, coverUrl: null }) as Record<string, unknown>;
    expect(res.coverUrl).toBeNull();
    expect(res).toHaveProperty("coverUrl");
  });

  it("generationInstruction がレスポンスに含まれない（公開 API 漏洩防止・#488）", () => {
    const res = toCommunityResponse(baseRecord) as Record<string, unknown>;
    expect(res).not.toHaveProperty("generationInstruction");
  });

  it("stats 省略時は post_count=0・last_post_at=null（#527）", () => {
    const res = toCommunityResponse(baseRecord);
    expect(res.post_count).toBe(0);
    expect(res.last_post_at).toBeNull();
  });

  it("stats を渡すと post_count・last_post_at が反映される（#527）", () => {
    const stats = { postCount: 42, lastPostAt: new Date("2026-06-15T12:00:00Z") };
    const res = toCommunityResponse(baseRecord, stats);
    expect(res.post_count).toBe(42);
    expect(res.last_post_at).toBe("2026-06-15T12:00:00.000Z");
  });

  it("stats.lastPostAt が null のとき last_post_at=null（#527）", () => {
    const stats = { postCount: 5, lastPostAt: null };
    const res = toCommunityResponse(baseRecord, stats);
    expect(res.last_post_at).toBeNull();
  });

  it("変換された camelCase キー（createdAt / lastSlotKey）はレスポンスに含まれない", () => {
    const res = toCommunityResponse(baseRecord) as Record<string, unknown>;
    expect(res).not.toHaveProperty("createdAt");
    expect(res).not.toHaveProperty("lastSlotKey");
  });
});

describe("toAdminCommunityResponse", () => {
  it("公開フィールドをすべて含む", () => {
    const res = toAdminCommunityResponse(baseRecord);
    expect(res.id).toBe("community-1");
    expect(res.slug).toBe("general");
    expect(res.name).toBe("General");
    expect(res.description).toBe("A general community");
    expect(res.post_count).toBe(0);
    expect(res.last_post_at).toBeNull();
  });

  it("generationInstruction（文字列）がレスポンスに含まれる（#488）", () => {
    const res = toAdminCommunityResponse(baseRecord) as Record<string, unknown>;
    expect(res.generationInstruction).toBe("Write in a casual tone");
  });

  it("generationInstruction が null のとき null として含まれる（#488）", () => {
    const res = toAdminCommunityResponse({
      ...baseRecord,
      generationInstruction: null,
    }) as Record<string, unknown>;
    expect(res).toHaveProperty("generationInstruction");
    expect(res.generationInstruction).toBeNull();
  });

  it("generationPaused: false のとき false がレスポンスに含まれる（#1011）", () => {
    const res = toAdminCommunityResponse(baseRecord) as Record<string, unknown>;
    expect(res).toHaveProperty("generationPaused", false);
  });

  it("generationPaused: true のとき true がレスポンスに含まれる（#1011）", () => {
    const res = toAdminCommunityResponse({ ...baseRecord, generationPaused: true }) as Record<string, unknown>;
    expect(res).toHaveProperty("generationPaused", true);
  });
});
