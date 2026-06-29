import type { Request } from "express";
import { describe, expect, it } from "vitest";

import { extractSessionId } from "./extractSessionId.js";

function makeReq(query: Record<string, unknown>): Request {
  return { query } as unknown as Request;
}

describe("extractSessionId", () => {
  it("有効な UUID v4 を sessionId に渡した場合、その値を返す", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    expect(extractSessionId(makeReq({ sessionId: uuid }))).toBe(uuid);
  });

  it("UUID フォーマット不正の場合、null を返す", () => {
    expect(extractSessionId(makeReq({ sessionId: "not-a-uuid" }))).toBeNull();
  });

  it("sessionId クエリパラメータ未指定の場合、null を返す", () => {
    expect(extractSessionId(makeReq({}))).toBeNull();
  });
});
