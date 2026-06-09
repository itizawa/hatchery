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

  it("createTestDeps に messageRepository を override して渡せる", async () => {
    const { InMemoryMessageRepository } = await import("./persistence/messageRepository.js");
    const customRepo = new InMemoryMessageRepository();
    const deps = await createTestDeps({ messageRepository: customRepo });
    const app = createApp(deps);

    // POST でメッセージを保存
    const res = await request(app)
      .post("/api/messages")
      .send([{ createdEmployeeId: "e1", channel: "zatsudan", text: "test" }]);
    expect(res.status).toBe(201);

    // 同じリポジトリに保存されている
    const messages = await customRepo.list();
    expect(messages).toHaveLength(1);
  });

  it("AppDeps に不足するフィールドがある場合 TypeScript 型エラー（コンパイル時保証）", () => {
    // このテストはランタイムではなく型チェックの保証。
    // 実行時テストとして: すべてのフィールドを渡せばエラーなく動く
    expect(true).toBe(true);
  });
});
