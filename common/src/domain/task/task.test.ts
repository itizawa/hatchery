import { describe, expect, it } from "vitest";

import { TaskSchema } from "./task.js";

describe("TaskSchema (A-5)", () => {
  it("status='new' は parse 成功する", () => {
    expect(TaskSchema.parse({ id: "t1", text: "ロゴ案", status: "new" }).status).toBe("new");
  });

  it("status='done' は parse 成功する", () => {
    expect(TaskSchema.parse({ id: "t1", text: "ロゴ案", status: "done" }).status).toBe("done");
  });

  it("status='picked'（Phase 1 の値）は parse に失敗する", () => {
    expect(TaskSchema.safeParse({ id: "t1", text: "ロゴ案", status: "picked" }).success).toBe(false);
  });

  it("status が任意文字列なら parse に失敗する", () => {
    expect(TaskSchema.safeParse({ id: "t1", text: "ロゴ案", status: "wip" }).success).toBe(false);
  });
});
