import { describe, expect, it } from "vitest";

import { AuthorWorkerSchema, buildAuthorWorkerResolver } from "./authorWorker.js";

describe("AuthorWorkerSchema", () => {
  it("id / display_name / image_url を受け付ける", () => {
    const parsed = AuthorWorkerSchema.parse({
      id: "c9226003-uuid",
      display_name: "haru",
      image_url: "https://example.com/haru.png",
    });
    expect(parsed).toEqual({
      id: "c9226003-uuid",
      display_name: "haru",
      image_url: "https://example.com/haru.png",
    });
  });

  it("image_url は null を許容する", () => {
    const parsed = AuthorWorkerSchema.parse({
      id: "u1",
      display_name: "ken",
      image_url: null,
    });
    expect(parsed.image_url).toBeNull();
  });
});

describe("buildAuthorWorkerResolver", () => {
  const workers = [
    { id: "c9226003-uuid", displayName: "haru", imageUrl: "https://example.com/haru.png" },
    { id: "d89954ec-uuid", displayName: "ken", imageUrl: null },
    { id: "e0000000-uuid", displayName: "mei" },
  ];

  it("author が id（UUID）に一致するワーカーを解決する", () => {
    const resolve = buildAuthorWorkerResolver(workers);
    expect(resolve("c9226003-uuid")).toEqual({
      id: "c9226003-uuid",
      display_name: "haru",
      image_url: "https://example.com/haru.png",
    });
  });

  it("author が displayName に一致するワーカーを解決する（旧データ互換）", () => {
    const resolve = buildAuthorWorkerResolver(workers);
    expect(resolve("haru")).toEqual({
      id: "c9226003-uuid",
      display_name: "haru",
      image_url: "https://example.com/haru.png",
    });
  });

  it("画像未設定のワーカーは image_url が null になる", () => {
    const resolve = buildAuthorWorkerResolver(workers);
    expect(resolve("ken")).toEqual({
      id: "d89954ec-uuid",
      display_name: "ken",
      image_url: null,
    });
    // imageUrl プロパティ自体が無いワーカーも null に正規化する
    expect(resolve("mei")).toEqual({
      id: "e0000000-uuid",
      display_name: "mei",
      image_url: null,
    });
  });

  it("解決できない author は undefined を返す", () => {
    const resolve = buildAuthorWorkerResolver(workers);
    expect(resolve("unknown")).toBeUndefined();
  });

  it("id 一致を displayName 一致より優先する", () => {
    // 文字列 "haru" が、あるワーカーの id でもあり別ワーカーの displayName でもある場合。
    const resolve = buildAuthorWorkerResolver([
      { id: "other", displayName: "haru" },
      { id: "haru", displayName: "本物" },
    ]);
    expect(resolve("haru")?.id).toBe("haru");
    expect(resolve("haru")?.display_name).toBe("本物");
  });

  it("同名 displayName が複数あるときは先勝ち（最初の 1 件）", () => {
    const resolve = buildAuthorWorkerResolver([
      { id: "u1", displayName: "haru" },
      { id: "u2", displayName: "haru" },
    ]);
    expect(resolve("haru")?.id).toBe("u1");
  });
});
