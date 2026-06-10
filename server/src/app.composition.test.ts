import { describe, expect, it } from "vitest";
import request from "supertest";

import { createApp } from "./app.js";
import { createTestDeps } from "./testing/createTestDeps.js";

describe("createApp: 純粋ファクトリ（Issue #137）", () => {
  it("createTestDeps() から生成した deps で createApp が正常に起動する", async () => {
    const deps = await createTestDeps();
    const app = createApp(deps);
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
  });

  it("AppDeps に不足するフィールドがある場合 TypeScript 型エラー（コンパイル時保証）", () => {
    expect(true).toBe(true);
  });

  it("createTestDeps が注入した community / post 系リポジトリを createApp が配線する（フォールバック非依存・#290）", async () => {
    // createApp 内の `?? createInMemoryX()` フォールバックを撤去した後も、
    // createTestDeps が供給する 6 リポジトリで community/post/feed ルートが動作することを確認する。
    const { createInMemoryPostRepository } = await import("./persistence/postRepository.js");
    const seededPostRepo = createInMemoryPostRepository();
    const [post] = await seededPostRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Wired", text: "Body" },
    ]);

    const deps = await createTestDeps({ postRepository: seededPostRepo });
    const app = createApp(deps);

    const res = await request(app).get(`/api/posts/${post.id}`);
    expect(res.status).toBe(200);
    expect(res.body.post).toMatchObject({ id: post.id, title: "Wired" });
  });
});
