import { describe, expect, it } from "vitest";

import { CommunitySchema } from "./community.js";

describe("CommunitySchema", () => {
  const validCommunity = {
    id: "comm-1",
    slug: "ai-workers",
    name: "AI ワーカー雑談",
    description: "AI ワーカーたちが日常を語るコミュニティ",
    synopsis: "これまでのあらすじ",
    last_slot_key: "2026-06-10T09:00:00.000Z",
    created_at: new Date("2026-06-01T00:00:00.000Z"),
  };

  it("有効なコミュニティをパースできる", () => {
    const result = CommunitySchema.safeParse(validCommunity);
    expect(result.success).toBe(true);
  });

  it("id を持つ", () => {
    const result = CommunitySchema.parse(validCommunity);
    expect(result.id).toBe("comm-1");
  });

  it("slug を持つ（最大50文字）", () => {
    const result = CommunitySchema.parse(validCommunity);
    expect(result.slug).toBe("ai-workers");
  });

  it("slug が 50 文字を超えると reject する", () => {
    const data = { ...validCommunity, slug: "a".repeat(51) };
    expect(CommunitySchema.safeParse(data).success).toBe(false);
  });

  it("name を持つ（最大50文字）", () => {
    const result = CommunitySchema.parse(validCommunity);
    expect(result.name).toBe("AI ワーカー雑談");
  });

  it("name が 50 文字を超えると reject する", () => {
    const data = { ...validCommunity, name: "あ".repeat(51) };
    expect(CommunitySchema.safeParse(data).success).toBe(false);
  });

  it("description を持つ（最大500文字）", () => {
    const result = CommunitySchema.parse(validCommunity);
    expect(result.description).toBe("AI ワーカーたちが日常を語るコミュニティ");
  });

  it("description が 500 文字を超えると reject する", () => {
    const data = { ...validCommunity, description: "あ".repeat(501) };
    expect(CommunitySchema.safeParse(data).success).toBe(false);
  });

  it("synopsis を持つ", () => {
    const result = CommunitySchema.parse(validCommunity);
    expect(result.synopsis).toBe("これまでのあらすじ");
  });

  it("synopsis は省略可能（optional）", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { synopsis: _s, ...dataWithoutSynopsis } = validCommunity;
    const result = CommunitySchema.safeParse(dataWithoutSynopsis);
    expect(result.success).toBe(true);
  });

  it("last_slot_key を持つ", () => {
    const result = CommunitySchema.parse(validCommunity);
    expect(result.last_slot_key).toBe("2026-06-10T09:00:00.000Z");
  });

  it("last_slot_key は省略可能（optional）", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { last_slot_key: _l, ...dataWithoutLastSlot } = validCommunity;
    const result = CommunitySchema.safeParse(dataWithoutLastSlot);
    expect(result.success).toBe(true);
  });

  it("created_at を持つ", () => {
    const result = CommunitySchema.parse(validCommunity);
    expect(result.created_at).toBeInstanceOf(Date);
  });
});
