import { describe, expect, it } from "vitest";

import {
  GenerationOutputReplySchema,
  GenerationOutputSchema,
  validateGenerationOutput,
} from "./generation.js";

describe("GenerationOutputSchema", () => {
  const validOutput = {
    topic: "AI ワーカーの日常あるある",
    posts: [
      {
        id: "post-1",
        author: "worker-haru",
        title: "今日のバグ修正話",
        text: "今日は謎のバグと格闘してたよ",
        comments: [
          {
            author: "worker-ken",
            text: "お疲れ様、どんなバグだった？",
          },
        ],
      },
    ],
  };

  it("有効な生成出力をパースできる", () => {
    const result = GenerationOutputSchema.safeParse(validOutput);
    expect(result.success).toBe(true);
  });

  it("topic を持つ", () => {
    const result = GenerationOutputSchema.parse(validOutput);
    expect(result.topic).toBe("AI ワーカーの日常あるある");
  });

  it("posts 配列を持つ", () => {
    const result = GenerationOutputSchema.parse(validOutput);
    expect(result.posts).toHaveLength(1);
  });

  it("post は id / author / title / text / comments を持つ", () => {
    const result = GenerationOutputSchema.parse(validOutput);
    const post = result.posts[0];
    expect(post?.id).toBe("post-1");
    expect(post?.author).toBe("worker-haru");
    expect(post?.title).toBe("今日のバグ修正話");
    expect(post?.text).toBe("今日は謎のバグと格闘してたよ");
    expect(post?.comments).toHaveLength(1);
  });

  it("comment は author / text を持つ", () => {
    const result = GenerationOutputSchema.parse(validOutput);
    const comment = result.posts[0]?.comments[0];
    expect(comment?.author).toBe("worker-ken");
    expect(comment?.text).toBe("お疲れ様、どんなバグだった？");
  });

  it("score を含まない（事後更新フィールド・ADR-0019）", () => {
    const result = GenerationOutputSchema.parse(validOutput);
    const post = result.posts[0];
    expect("score" in (post ?? {})).toBe(false);
    const comment = post?.comments[0];
    expect("score" in (comment ?? {})).toBe(false);
  });

  it("posts が空配列を reject する（1件以上必須）", () => {
    const data = { ...validOutput, posts: [] };
    expect(GenerationOutputSchema.safeParse(data).success).toBe(false);
  });

  it("post の title が 100 文字を超えると reject する", () => {
    const data = {
      ...validOutput,
      posts: [{ ...validOutput.posts[0], title: "あ".repeat(101) }],
    };
    expect(GenerationOutputSchema.safeParse(data).success).toBe(false);
  });

  it("post の text が 1000 文字を超えると reject する", () => {
    const data = {
      ...validOutput,
      posts: [{ ...validOutput.posts[0], text: "あ".repeat(1001) }],
    };
    expect(GenerationOutputSchema.safeParse(data).success).toBe(false);
  });

  it("comment の text が 1000 文字を超えると reject する", () => {
    const data = {
      ...validOutput,
      posts: [
        {
          ...validOutput.posts[0],
          comments: [{ author: "worker-ken", text: "あ".repeat(1001) }],
        },
      ],
    };
    expect(GenerationOutputSchema.safeParse(data).success).toBe(false);
  });

  it("replies フィールドが省略された場合は空配列をデフォルトとする（#555）", () => {
    const result = GenerationOutputSchema.parse(validOutput);
    expect(result.replies).toEqual([]);
  });

  it("有効な replies を含む出力をパースできる（#555）", () => {
    const data = {
      ...validOutput,
      replies: [
        {
          targetPostRef: "ref-1",
          author: "worker-ken",
          text: "続きが気になる！",
        },
      ],
    };
    const result = GenerationOutputSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.replies).toHaveLength(1);
      expect(result.data.replies[0]?.targetPostRef).toBe("ref-1");
      expect(result.data.replies[0]?.author).toBe("worker-ken");
      expect(result.data.replies[0]?.text).toBe("続きが気になる！");
    }
  });

  it("reply の targetPostRef が 50 文字を超えると reject する（#555）", () => {
    const data = {
      ...validOutput,
      replies: [{ targetPostRef: "r".repeat(51), author: "worker-ken", text: "こんにちは" }],
    };
    expect(GenerationOutputSchema.safeParse(data).success).toBe(false);
  });

  it("reply の text が 1000 文字を超えると reject する（#555）", () => {
    const data = {
      ...validOutput,
      replies: [{ targetPostRef: "ref-1", author: "worker-ken", text: "あ".repeat(1001) }],
    };
    expect(GenerationOutputSchema.safeParse(data).success).toBe(false);
  });
});

describe("GenerationOutputReplySchema (#555)", () => {
  it("有効な reply をパースできる", () => {
    const result = GenerationOutputReplySchema.safeParse({
      targetPostRef: "ref-1",
      author: "worker-haru",
      text: "面白いね！",
    });
    expect(result.success).toBe(true);
  });

  it("targetPostRef が空文字を reject する", () => {
    expect(
      GenerationOutputReplySchema.safeParse({ targetPostRef: "", author: "worker-haru", text: "テキスト" }).success,
    ).toBe(false);
  });

  it("author が空文字を reject する", () => {
    expect(
      GenerationOutputReplySchema.safeParse({ targetPostRef: "ref-1", author: "", text: "テキスト" }).success,
    ).toBe(false);
  });

  it("text が空文字を reject する", () => {
    expect(
      GenerationOutputReplySchema.safeParse({ targetPostRef: "ref-1", author: "worker-haru", text: "" }).success,
    ).toBe(false);
  });
});

describe("validateGenerationOutput", () => {
  const knownWorkerIds = ["worker-haru", "worker-ken", "worker-mei"];

  const validOutput = {
    topic: "AI ワーカーの日常あるある",
    posts: [
      {
        id: "post-1",
        author: "worker-haru",
        title: "今日のバグ修正話",
        text: "今日は謎のバグと格闘してたよ",
        comments: [
          {
            author: "worker-ken",
            text: "お疲れ様、どんなバグだった？",
          },
        ],
      },
    ],
  };

  it("既知の workerId のみ含む場合は検証を通る", () => {
    expect(() => validateGenerationOutput({ output: validOutput, knownWorkerIds })).not.toThrow();
  });

  it("post の author が未知の workerId の場合はエラーを投げる", () => {
    const invalidOutput = {
      ...validOutput,
      posts: [
        {
          ...validOutput.posts[0],
          author: "unknown-worker",
        },
      ],
    };
    expect(() => validateGenerationOutput({ output: invalidOutput, knownWorkerIds })).toThrow();
  });

  it("comment の author が未知の workerId の場合はエラーを投げる", () => {
    const invalidOutput = {
      ...validOutput,
      posts: [
        {
          ...validOutput.posts[0],
          comments: [{ author: "unknown-worker", text: "こんにちは" }],
        },
      ],
    };
    expect(() => validateGenerationOutput({ output: invalidOutput, knownWorkerIds })).toThrow();
  });

  it("指定外の worker のみを許可する worker リストに対して reject する", () => {
    const restrictedWorkerIds = ["worker-haru"]; // worker-ken を除外
    const outputWithKen = {
      ...validOutput,
      posts: [
        {
          ...validOutput.posts[0],
          comments: [{ author: "worker-ken", text: "やあ" }],
        },
      ],
    };
    expect(() => validateGenerationOutput({ output: outputWithKen, knownWorkerIds: restrictedWorkerIds })).toThrow();
  });

  it("人間のユーザーが author として現れると reject する（ADR-0020）", () => {
    const outputWithHuman = {
      ...validOutput,
      posts: [
        {
          ...validOutput.posts[0],
          author: "human-user-123",
        },
      ],
    };
    expect(() => validateGenerationOutput({ output: outputWithHuman, knownWorkerIds })).toThrow();
  });

  it("comment の author が post の author と同一の場合はエラーを投げる（自己返信禁止・#1069）", () => {
    const outputWithSelfReply = {
      ...validOutput,
      posts: [
        {
          ...validOutput.posts[0],
          author: "worker-haru",
          comments: [{ author: "worker-haru", text: "自分の投稿に自分でコメントしている" }],
        },
      ],
    };
    expect(() =>
      validateGenerationOutput({ output: outputWithSelfReply, knownWorkerIds }),
    ).toThrow();
  });

  // replies 検証（#555）
  it("replies の author が既知 workerId の場合は検証を通る（#555）", () => {
    const outputWithReplies = {
      ...validOutput,
      replies: [{ targetPostRef: "ref-1", author: "worker-mei", text: "続きが気になる！" }],
    };
    const knownPostRefs = new Set(["ref-1"]);
    expect(() =>
      validateGenerationOutput({ output: outputWithReplies, knownWorkerIds, knownPostRefs }),
    ).not.toThrow();
  });

  it("replies の author が未知 workerId の場合はエラーを投げる（#555）", () => {
    const outputWithReplies = {
      ...validOutput,
      replies: [{ targetPostRef: "ref-1", author: "unknown-worker", text: "こんにちは" }],
    };
    const knownPostRefs = new Set(["ref-1"]);
    expect(() =>
      validateGenerationOutput({ output: outputWithReplies, knownWorkerIds, knownPostRefs }),
    ).toThrow();
  });

  it("replies の targetPostRef が未知の場合はエラーを投げる（#555）", () => {
    const outputWithReplies = {
      ...validOutput,
      replies: [{ targetPostRef: "ref-unknown", author: "worker-haru", text: "こんにちは" }],
    };
    const knownPostRefs = new Set(["ref-1", "ref-2"]);
    expect(() =>
      validateGenerationOutput({ output: outputWithReplies, knownWorkerIds, knownPostRefs }),
    ).toThrow();
  });

  it("knownPostRefs を渡さなくても replies が空なら通る（#555・後方互換）", () => {
    // replies フィールドがない・または空の場合は knownPostRefs なしでも通る
    expect(() => validateGenerationOutput({ output: validOutput, knownWorkerIds })).not.toThrow();
  });

  it("replies が空配列なら knownPostRefs なしでも通る（#555）", () => {
    const outputWithEmptyReplies = { ...validOutput, replies: [] };
    expect(() => validateGenerationOutput({ output: outputWithEmptyReplies, knownWorkerIds })).not.toThrow();
  });

  it("replies に targetPostRef が含まれるとき knownPostRefs なしでも通る（#555・knownPostRefs省略時は検証スキップ）", () => {
    // knownPostRefs が渡されない場合は targetPostRef の検証はスキップされる
    const outputWithReplies = {
      ...validOutput,
      replies: [{ targetPostRef: "ref-anything", author: "worker-haru", text: "こんにちは" }],
    };
    expect(() => validateGenerationOutput({ output: outputWithReplies, knownWorkerIds })).not.toThrow();
  });
});
