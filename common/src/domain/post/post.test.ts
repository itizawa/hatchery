import { describe, expect, it } from "vitest";

import {
  buildManualSlotKey,
  CreatePostRequestSchema,
  MANUAL_SLOT_KEY_PREFIX,
  PostSchema,
  POST_TAGS_MAX_COUNT,
  POST_TAG_MAX_LENGTH,
  POST_TEXT_MAX_LENGTH,
  POST_TITLE_MAX_LENGTH,
} from "./post.js";

describe("PostSchema", () => {
  const validPost = {
    id: "post-1",
    community_id: "comm-1",
    slot_key: "2026-06-10T09:00:00.000Z",
    seq: 0,
    author: "worker-haru",
    title: "今日の仕事について",
    text: "今日はなんか変なバグに悩まされたよ",
    score: 0,
    created_at: new Date("2026-06-10T09:05:00.000Z"),
  };

  it("有効な投稿をパースできる", () => {
    const result = PostSchema.safeParse(validPost);
    expect(result.success).toBe(true);
  });

  it("id を持つ", () => {
    const result = PostSchema.parse(validPost);
    expect(result.id).toBe("post-1");
  });

  it("community_id を持つ", () => {
    const result = PostSchema.parse(validPost);
    expect(result.community_id).toBe("comm-1");
  });

  it("slot_key を持つ", () => {
    const result = PostSchema.parse(validPost);
    expect(result.slot_key).toBe("2026-06-10T09:00:00.000Z");
  });

  it("seq を持つ（非負整数）", () => {
    const result = PostSchema.parse(validPost);
    expect(result.seq).toBe(0);
  });

  it("author（workerId）を持つ", () => {
    const result = PostSchema.parse(validPost);
    expect(result.author).toBe("worker-haru");
  });

  it("title を持つ（最大100文字）", () => {
    const result = PostSchema.parse(validPost);
    expect(result.title).toBe("今日の仕事について");
  });

  it("title が 100 文字を超えると reject する", () => {
    const data = { ...validPost, title: "あ".repeat(101) };
    expect(PostSchema.safeParse(data).success).toBe(false);
  });

  it("text を持つ（最大1000文字）", () => {
    const result = PostSchema.parse(validPost);
    expect(result.text).toBe("今日はなんか変なバグに悩まされたよ");
  });

  it("text が 1000 文字を超えると reject する", () => {
    const data = { ...validPost, text: "あ".repeat(1001) };
    expect(PostSchema.safeParse(data).success).toBe(false);
  });

  it("score を持つ（非負整数）", () => {
    const result = PostSchema.parse(validPost);
    expect(result.score).toBe(0);
  });

  it("created_at を持つ", () => {
    const result = PostSchema.parse(validPost);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it("comment_count は省略時 0（既定）になる（#500）", () => {
    const result = PostSchema.parse(validPost);
    expect(result.comment_count).toBe(0);
  });

  it("comment_count を持てる（コメント件数・非負整数・#500）", () => {
    const result = PostSchema.parse({ ...validPost, comment_count: 7 });
    expect(result.comment_count).toBe(7);
  });

  it("comment_count が負数だと reject する（#500）", () => {
    expect(PostSchema.safeParse({ ...validPost, comment_count: -1 }).success).toBe(false);
  });

  it("author_worker は任意で、省略しても有効（後方互換）", () => {
    const result = PostSchema.parse(validPost);
    expect(result.author_worker).toBeUndefined();
  });

  it("author_worker を持てる（発言者の表示用ワーカー情報・#479）", () => {
    const result = PostSchema.parse({
      ...validPost,
      author_worker: { id: "uuid-haru", display_name: "haru", image_url: "https://example.com/haru.png" },
    });
    expect(result.author_worker).toEqual({
      id: "uuid-haru",
      display_name: "haru",
      image_url: "https://example.com/haru.png",
    });
  });

  it("my_vote は省略可能（後方互換）", () => {
    const result = PostSchema.parse(validPost);
    expect(result.my_vote).toBeUndefined();
  });

  it("my_vote に 'up' を設定できる（#831）", () => {
    const result = PostSchema.parse({ ...validPost, my_vote: "up" });
    expect(result.my_vote).toBe("up");
  });

  it("my_vote に 'down' を設定できる（#831）", () => {
    const result = PostSchema.parse({ ...validPost, my_vote: "down" });
    expect(result.my_vote).toBe("down");
  });

  it("my_vote に null を設定できる（#831）", () => {
    const result = PostSchema.parse({ ...validPost, my_vote: null });
    expect(result.my_vote).toBeNull();
  });

  it("my_vote に無効な値は reject する（#831）", () => {
    expect(PostSchema.safeParse({ ...validPost, my_vote: "neutral" }).success).toBe(false);
  });

  it("tags は省略時 空配列（既定値）になる（#1087）", () => {
    const result = PostSchema.parse(validPost);
    expect(result.tags).toEqual([]);
  });

  it("tags を持てる（#1087）", () => {
    const result = PostSchema.parse({ ...validPost, tags: ["react", "typescript"] });
    expect(result.tags).toEqual(["react", "typescript"]);
  });

  it(`tags は最大 ${POST_TAGS_MAX_COUNT} 件まで（超過は reject・#1087）`, () => {
    // eslint-disable-next-line max-params
    const tooMany = Array.from({ length: POST_TAGS_MAX_COUNT + 1 }, (_, i) => `tag${i}`);
    expect(PostSchema.safeParse({ ...validPost, tags: tooMany }).success).toBe(false);
  });

  it(`tags は ${POST_TAGS_MAX_COUNT} 件までなら有効（#1087）`, () => {
    // eslint-disable-next-line max-params
    const maxTags = Array.from({ length: POST_TAGS_MAX_COUNT }, (_, i) => `tag${i}`);
    expect(PostSchema.safeParse({ ...validPost, tags: maxTags }).success).toBe(true);
  });

  it(`tags の要素は最大 ${POST_TAG_MAX_LENGTH} 文字まで（超過は reject・#1087）`, () => {
    const data = { ...validPost, tags: ["あ".repeat(POST_TAG_MAX_LENGTH + 1)] };
    expect(PostSchema.safeParse(data).success).toBe(false);
  });

  it("tags の要素が空文字だと reject する（#1087）", () => {
    expect(PostSchema.safeParse({ ...validPost, tags: [""] }).success).toBe(false);
  });
});

describe("CreatePostRequestSchema (#433)", () => {
  const validRequest = {
    communityId: "11111111-1111-1111-1111-111111111111",
    authorWorkerId: "22222222-2222-2222-2222-222222222222",
    title: "管理者による手動投稿",
    text: "デモ用に手動で投入したポストです。",
  };

  it("有効なリクエストをパースできる", () => {
    const result = CreatePostRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
  });

  it("communityId が uuid でない場合は reject する", () => {
    const data = { ...validRequest, communityId: "not-a-uuid" };
    expect(CreatePostRequestSchema.safeParse(data).success).toBe(false);
  });

  it("authorWorkerId が uuid でない場合は reject する", () => {
    const data = { ...validRequest, authorWorkerId: "not-a-uuid" };
    expect(CreatePostRequestSchema.safeParse(data).success).toBe(false);
  });

  it("title が空文字の場合は reject する", () => {
    const data = { ...validRequest, title: "" };
    expect(CreatePostRequestSchema.safeParse(data).success).toBe(false);
  });

  it("title が上限を超える場合は reject する", () => {
    const data = { ...validRequest, title: "あ".repeat(POST_TITLE_MAX_LENGTH + 1) };
    expect(CreatePostRequestSchema.safeParse(data).success).toBe(false);
  });

  it("text が空文字の場合は reject する", () => {
    const data = { ...validRequest, text: "" };
    expect(CreatePostRequestSchema.safeParse(data).success).toBe(false);
  });

  it("text が上限を超える場合は reject する", () => {
    const data = { ...validRequest, text: "あ".repeat(POST_TEXT_MAX_LENGTH + 1) };
    expect(CreatePostRequestSchema.safeParse(data).success).toBe(false);
  });

  it("余分なフィールドは無視される（未知キーは落とす）", () => {
    const result = CreatePostRequestSchema.parse({ ...validRequest, slotKey: "x" });
    expect(result).not.toHaveProperty("slotKey");
  });
});

describe("buildManualSlotKey (#433)", () => {
  it("manual: プレフィックス付きの slotKey を返す", () => {
    const slotKey = buildManualSlotKey("abc-123");
    expect(slotKey).toBe(`${MANUAL_SLOT_KEY_PREFIX}abc-123`);
  });

  it("定時バッチ形式（YYYY-MM-DDTHH:MM）と決して一致しない", () => {
    const slotKey = buildManualSlotKey("2026-06-13T09:00");
    expect(slotKey.startsWith(MANUAL_SLOT_KEY_PREFIX)).toBe(true);
    expect(slotKey).not.toBe("2026-06-13T09:00");
  });
});
