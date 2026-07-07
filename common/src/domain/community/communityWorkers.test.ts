import { describe, expect, it } from "vitest";

import { CommunityWorkersQuerySchema, CommunityWorkersResponseSchema } from "./communityWorkers.js";

describe("CommunityWorkersQuerySchema (#1078)", () => {
  it("cursor・limit を省略すると limit=20 の既定値が入る", () => {
    const result = CommunityWorkersQuerySchema.parse({});
    expect(result).toEqual({ limit: 20 });
  });

  it("cursor・limit を指定できる", () => {
    const result = CommunityWorkersQuerySchema.parse({ cursor: "abc", limit: "5" });
    expect(result).toEqual({ cursor: "abc", limit: 5 });
  });

  it("limit が 100 を超えるとバリデーションエラーになる", () => {
    const result = CommunityWorkersQuerySchema.safeParse({ limit: "101" });
    expect(result.success).toBe(false);
  });

  it("limit が 1 未満だとバリデーションエラーになる", () => {
    const result = CommunityWorkersQuerySchema.safeParse({ limit: "0" });
    expect(result.success).toBe(false);
  });

  it("cursor が 512 文字を超えるとバリデーションエラーになる", () => {
    const result = CommunityWorkersQuerySchema.safeParse({ cursor: "a".repeat(513) });
    expect(result.success).toBe(false);
  });

  it("cursor が 512 文字ちょうどなら許容する", () => {
    const result = CommunityWorkersQuerySchema.safeParse({ cursor: "a".repeat(512) });
    expect(result.success).toBe(true);
  });
});

describe("CommunityWorkersResponseSchema (#1078)", () => {
  it("items と nextCursor を検証できる", () => {
    const result = CommunityWorkersResponseSchema.parse({
      items: [{ id: "worker-1", displayName: "haru" }],
      nextCursor: "cursor-1",
    });
    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBe("cursor-1");
  });

  it("nextCursor は null を許容する", () => {
    const result = CommunityWorkersResponseSchema.parse({ items: [], nextCursor: null });
    expect(result.nextCursor).toBeNull();
  });

  it("items が空配列でも検証できる", () => {
    const result = CommunityWorkersResponseSchema.parse({ items: [], nextCursor: null });
    expect(result.items).toEqual([]);
  });
});
