import { describe, expect, it } from "vitest";

import {
  WORKER_DISPLAY_NAME_MAX_LENGTH,
  WORKER_IMAGE_URL_MAX_LENGTH,
  WORKER_ROLE_MAX_LENGTH,
  createDisplayNameResolver,
  createAvatarUrlResolver,
  CreateWorkerSchema,
  DEFAULT_WORKERS,
  WorkerSchema,
  UpdateWorkerSchema,
  formatWorkerDisplayName,
} from "./worker.js";

describe("WorkerSchema (A-1 / A-2)", () => {
  it("id / displayName を持つワーカーは parse 成功する（role は任意）", () => {
    expect(WorkerSchema.parse({ id: "haru", displayName: "haru" }).id).toBe("haru");
    const withRole = WorkerSchema.parse({ id: "mei", displayName: "mei", role: "新人" });
    expect(withRole.role).toBe("新人");
  });

  it("id / displayName が空文字なら parse に失敗する", () => {
    expect(WorkerSchema.safeParse({ id: "", displayName: "haru" }).success).toBe(false);
    expect(WorkerSchema.safeParse({ id: "haru", displayName: "" }).success).toBe(false);
  });

  // #331: ADR-0020 後処理。Worker は AI 投稿者のみとなり isBot 概念を撤廃した。
  it("isBot フィールドを持たない（#331）", () => {
    const parsed = WorkerSchema.parse({ id: "haru", displayName: "haru" });
    expect(parsed).not.toHaveProperty("isBot");
  });

  it("isBot を渡してもパース結果に含まれない（#331・未知キーは無視）", () => {
    const parsed = WorkerSchema.parse({ id: "haru", displayName: "haru", isBot: true });
    expect(parsed).not.toHaveProperty("isBot");
  });
});

describe("DEFAULT_WORKERS (#25)", () => {
  it("全要素が WorkerSchema を満たす", () => {
    for (const worker of DEFAULT_WORKERS) {
      expect(WorkerSchema.safeParse(worker).success).toBe(true);
    }
  });

  it("MVP の 3 人（haru / ken / mei）を含む", () => {
    expect(DEFAULT_WORKERS.map((w) => w.id)).toEqual(["haru", "ken", "mei"]);
  });

  it("id が一意である", () => {
    const ids = DEFAULT_WORKERS.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("全員が isBot フィールドを持たない（#331）", () => {
    expect(DEFAULT_WORKERS.every((w) => !("isBot" in w))).toBe(true);
  });
});

describe("WorkerSchema: personality フィールド (#38)", () => {
  it("personality が 500 文字以内なら parse 成功する", () => {
    const result = WorkerSchema.safeParse({ id: "haru", displayName: "haru", personality: "a".repeat(500) });
    expect(result.success).toBe(true);
  });

  it("personality が 501 文字なら parse に失敗する", () => {
    const result = WorkerSchema.safeParse({ id: "haru", displayName: "haru", personality: "a".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("personality を省略しても parse 成功する（任意フィールド）", () => {
    expect(WorkerSchema.safeParse({ id: "haru", displayName: "haru" }).success).toBe(true);
  });

  it("displayName が WORKER_DISPLAY_NAME_MAX_LENGTH 文字ちょうどなら parse 成功する（#91）", () => {
    expect(WorkerSchema.safeParse({ id: "haru", displayName: "a".repeat(WORKER_DISPLAY_NAME_MAX_LENGTH) }).success).toBe(true);
  });

  it("displayName が WORKER_DISPLAY_NAME_MAX_LENGTH + 1 文字なら parse 失敗する（#91）", () => {
    expect(WorkerSchema.safeParse({ id: "haru", displayName: "a".repeat(WORKER_DISPLAY_NAME_MAX_LENGTH + 1) }).success).toBe(false);
  });

  it("role が WORKER_ROLE_MAX_LENGTH 文字ちょうどなら parse 成功する（#91）", () => {
    expect(WorkerSchema.safeParse({ id: "haru", displayName: "haru", role: "a".repeat(WORKER_ROLE_MAX_LENGTH) }).success).toBe(true);
  });

  it("role が WORKER_ROLE_MAX_LENGTH + 1 文字なら parse 失敗する（#91）", () => {
    expect(WorkerSchema.safeParse({ id: "haru", displayName: "haru", role: "a".repeat(WORKER_ROLE_MAX_LENGTH + 1) }).success).toBe(false);
  });
});

describe("WorkerSchema: imageUrl フィールド (#220)", () => {
  it("imageUrl が有効な URL なら parse 成功する", () => {
    expect(WorkerSchema.safeParse({ id: "haru", displayName: "haru", imageUrl: "https://example.com/avatar.png" }).success).toBe(true);
  });

  it("imageUrl を省略しても parse 成功する（任意フィールド）", () => {
    const result = WorkerSchema.safeParse({ id: "haru", displayName: "haru" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.imageUrl).toBeUndefined();
  });

  it("imageUrl が不正な URL 形式なら parse 失敗する", () => {
    expect(WorkerSchema.safeParse({ id: "haru", displayName: "haru", imageUrl: "not-a-url" }).success).toBe(false);
  });

  it(`imageUrl が WORKER_IMAGE_URL_MAX_LENGTH 文字ちょうどなら parse 成功する（#91）`, () => {
    const base = "https://example.com/";
    const url = base + "a".repeat(WORKER_IMAGE_URL_MAX_LENGTH - base.length);
    expect(url.length).toBe(WORKER_IMAGE_URL_MAX_LENGTH);
    expect(WorkerSchema.safeParse({ id: "haru", displayName: "haru", imageUrl: url }).success).toBe(true);
  });

  it(`imageUrl が WORKER_IMAGE_URL_MAX_LENGTH + 1 文字なら parse 失敗する（#91）`, () => {
    const base = "https://example.com/";
    const url = base + "a".repeat(WORKER_IMAGE_URL_MAX_LENGTH - base.length + 1);
    expect(url.length).toBe(WORKER_IMAGE_URL_MAX_LENGTH + 1);
    expect(WorkerSchema.safeParse({ id: "haru", displayName: "haru", imageUrl: url }).success).toBe(false);
  });
});

describe("UpdateWorkerSchema (#38)", () => {
  it("displayName / role / personality を部分更新できる", () => {
    expect(UpdateWorkerSchema.safeParse({ displayName: "new name", role: "マネージャー", personality: "明るく積極的" }).success).toBe(true);
  });

  it("displayName が空文字なら invalid", () => {
    expect(UpdateWorkerSchema.safeParse({ displayName: "" }).success).toBe(false);
  });

  it("personality が 501 文字なら invalid", () => {
    expect(UpdateWorkerSchema.safeParse({ personality: "a".repeat(501) }).success).toBe(false);
  });

  it("すべてのフィールドを省略できる（空更新は valid）", () => {
    expect(UpdateWorkerSchema.safeParse({}).success).toBe(true);
  });

  it("displayName が WORKER_DISPLAY_NAME_MAX_LENGTH 文字ちょうどなら valid（#91）", () => {
    expect(UpdateWorkerSchema.safeParse({ displayName: "a".repeat(WORKER_DISPLAY_NAME_MAX_LENGTH) }).success).toBe(true);
  });

  it("displayName が WORKER_DISPLAY_NAME_MAX_LENGTH + 1 文字なら invalid（#91）", () => {
    expect(UpdateWorkerSchema.safeParse({ displayName: "a".repeat(WORKER_DISPLAY_NAME_MAX_LENGTH + 1) }).success).toBe(false);
  });

  it("role が WORKER_ROLE_MAX_LENGTH 文字ちょうどなら valid（#91）", () => {
    expect(UpdateWorkerSchema.safeParse({ role: "a".repeat(WORKER_ROLE_MAX_LENGTH) }).success).toBe(true);
  });

  it("role が WORKER_ROLE_MAX_LENGTH + 1 文字なら invalid（#91）", () => {
    expect(UpdateWorkerSchema.safeParse({ role: "a".repeat(WORKER_ROLE_MAX_LENGTH + 1) }).success).toBe(false);
  });
});

describe("WorkerSchema: avatarUrl フィールド（#204）", () => {
  it("avatarUrl を省略しても parse 成功する（任意フィールド）", () => {
    const result = WorkerSchema.safeParse({ id: "haru", displayName: "haru" });
    expect(result.success).toBe(true);
    expect(result.data?.avatarUrl).toBeUndefined();
  });

  it("有効な URL なら parse 成功する", () => {
    expect(WorkerSchema.safeParse({ id: "haru", displayName: "haru", avatarUrl: "https://storage.googleapis.com/bucket/workers/haru/uuid.png" }).success).toBe(true);
  });

  it("URL でない文字列なら parse に失敗する", () => {
    expect(WorkerSchema.safeParse({ id: "haru", displayName: "haru", avatarUrl: "not-a-url" }).success).toBe(false);
  });

  it("2048 文字ちょうどの URL なら parse 成功する（#91）", () => {
    const longPath = "a".repeat(2048 - "https://x.com/".length);
    expect(WorkerSchema.safeParse({ id: "haru", displayName: "haru", avatarUrl: `https://x.com/${longPath}` }).success).toBe(true);
  });

  it("2049 文字以上の URL なら parse に失敗する（#91）", () => {
    const longPath = "a".repeat(2049 - "https://x.com/".length + 1);
    expect(WorkerSchema.safeParse({ id: "haru", displayName: "haru", avatarUrl: `https://x.com/${longPath}` }).success).toBe(false);
  });
});

describe("formatWorkerDisplayName (#218)", () => {
  it("deletedAt が null の場合は displayName をそのまま返す", () => {
    expect(formatWorkerDisplayName({ displayName: "田中 太郎", deletedAt: null })).toBe("田中 太郎");
  });

  it("deletedAt が undefined の場合は displayName をそのまま返す", () => {
    expect(formatWorkerDisplayName({ displayName: "田中 太郎" })).toBe("田中 太郎");
  });

  it("deletedAt が Date の場合は《削除済み》プレフィックスを付ける", () => {
    expect(formatWorkerDisplayName({ displayName: "田中 太郎", deletedAt: new Date("2024-01-01") })).toBe("【削除済み】田中 太郎");
  });
});

describe("CreateWorkerSchema (#217)", () => {
  it("displayName のみで parse 成功する", () => {
    expect(CreateWorkerSchema.safeParse({ displayName: "新しいワーカー" }).success).toBe(true);
  });

  it("displayName が空文字なら invalid", () => {
    expect(CreateWorkerSchema.safeParse({ displayName: "" }).success).toBe(false);
  });

  it("displayName が WORKER_DISPLAY_NAME_MAX_LENGTH 文字ちょうどなら valid", () => {
    expect(CreateWorkerSchema.safeParse({ displayName: "a".repeat(WORKER_DISPLAY_NAME_MAX_LENGTH) }).success).toBe(true);
  });

  it("displayName が WORKER_DISPLAY_NAME_MAX_LENGTH + 1 文字なら invalid", () => {
    expect(CreateWorkerSchema.safeParse({ displayName: "a".repeat(WORKER_DISPLAY_NAME_MAX_LENGTH + 1) }).success).toBe(false);
  });

  it("role を省略しても parse 成功する（任意フィールド）", () => {
    expect(CreateWorkerSchema.safeParse({ displayName: "ワーカーA" }).success).toBe(true);
  });

  it("role を指定すると反映される", () => {
    const result = CreateWorkerSchema.safeParse({ displayName: "ワーカーA", role: "エンジニア" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.role).toBe("エンジニア");
  });

  it("role が WORKER_ROLE_MAX_LENGTH + 1 文字なら invalid", () => {
    expect(CreateWorkerSchema.safeParse({ displayName: "ワーカーA", role: "a".repeat(WORKER_ROLE_MAX_LENGTH + 1) }).success).toBe(false);
  });

  it("personality を省略しても parse 成功する（任意フィールド）", () => {
    expect(CreateWorkerSchema.safeParse({ displayName: "ワーカーA" }).success).toBe(true);
  });

  it("personality が 500 文字ちょうどなら valid", () => {
    expect(CreateWorkerSchema.safeParse({ displayName: "ワーカーA", personality: "a".repeat(500) }).success).toBe(true);
  });

  it("personality が 501 文字なら invalid", () => {
    expect(CreateWorkerSchema.safeParse({ displayName: "ワーカーA", personality: "a".repeat(501) }).success).toBe(false);
  });
});

describe("createDisplayNameResolver", () => {
  const workers = [
    { id: "haru", displayName: "ハル" },
    { id: "ken", displayName: "ケン" },
  ];

  it("既知の worker ID を displayName に解決する", () => {
    const resolve = createDisplayNameResolver(workers);
    expect(resolve("haru")).toBe("ハル");
    expect(resolve("ken")).toBe("ケン");
  });

  it("未知の ID はその ID をそのままフォールバック表示する", () => {
    const resolve = createDisplayNameResolver(workers);
    expect(resolve("unknown-id")).toBe("unknown-id");
  });

  it("引数省略時は DEFAULT_WORKERS で解決する", () => {
    const resolve = createDisplayNameResolver();
    const haru = DEFAULT_WORKERS.find((w) => w.id === "haru")!;
    expect(resolve("haru")).toBe(haru.displayName);
  });
});

describe("createAvatarUrlResolver (#300)", () => {
  const workers = [
    { id: "haru", displayName: "ハル", imageUrl: "https://example.com/haru.png" },
    { id: "ken", displayName: "ケン" },
  ];

  it("imageUrl が設定されている worker ID は URL を返す", () => {
    const resolve = createAvatarUrlResolver(workers);
    expect(resolve("haru")).toBe("https://example.com/haru.png");
  });

  it("imageUrl が未設定の worker ID は undefined を返す", () => {
    const resolve = createAvatarUrlResolver(workers);
    expect(resolve("ken")).toBeUndefined();
  });

  it("未解決の worker ID は undefined を返す", () => {
    const resolve = createAvatarUrlResolver(workers);
    expect(resolve("unknown-id")).toBeUndefined();
  });

  it("引数省略時は DEFAULT_WORKERS で解決する（全員 imageUrl 未設定 → undefined）", () => {
    const resolve = createAvatarUrlResolver();
    expect(resolve("haru")).toBeUndefined();
  });
});

describe("WorkerSchema: deletedAt フィールド（#372 HTTP 境界型整合）", () => {
  it("deletedAt に Date オブジェクトを渡すと parse 失敗する（HTTP 境界では文字列のみ）", () => {
    expect(WorkerSchema.safeParse({ id: "w1", displayName: "Alice", deletedAt: new Date() }).success).toBe(false);
  });

  it("deletedAt に ISO 文字列を渡すと parse 成功する", () => {
    expect(WorkerSchema.safeParse({ id: "w1", displayName: "Alice", deletedAt: "2024-01-01T00:00:00.000Z" }).success).toBe(true);
  });

  it("deletedAt に null を渡すと parse 成功する", () => {
    expect(WorkerSchema.safeParse({ id: "w1", displayName: "Alice", deletedAt: null }).success).toBe(true);
  });

  it("deletedAt を省略しても parse 成功する（optional）", () => {
    expect(WorkerSchema.safeParse({ id: "w1", displayName: "Alice" }).success).toBe(true);
  });
});
