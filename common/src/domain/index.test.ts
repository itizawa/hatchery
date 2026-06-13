import { describe, expect, it } from "vitest";

// Issue #24: 各ドメインはフォルダ配下の index.ts を公開窓口とする。
// フォルダ index 経由で代表シンボルを import できることを検証する（構成の回帰ガード）。
import { AuthUserSchema } from "./auth/index.js";
import { WorkerSchema } from "./worker/index.js";
import { CommunitySchema } from "./community/index.js";

describe("domain フォルダ構成（#24）", () => {
  it("auth フォルダの index からスキーマを参照できる", () => {
    // #455: Google-only auth へ移行。loginId → email。
    expect(AuthUserSchema.safeParse({ id: "u", email: "u@example.com", displayName: "U", role: "admin" }).success).toBe(true);
  });

  it("worker フォルダの index からスキーマを参照できる", () => {
    expect(WorkerSchema.safeParse({ id: "e1", displayName: "ワーカー" }).success).toBe(true);
  });

  it("community フォルダの index からスキーマを参照できる", () => {
    expect(CommunitySchema.safeParse({ id: "c1", slug: "ai", name: "AI", description: "AI の話", created_at: new Date() }).success).toBe(true);
  });
});
