import { describe, expect, it } from "vitest";

import { buildCommunityPrompt, TONE_GUIDELINES } from "./buildCommunityPrompt.js";

describe("buildCommunityPrompt (#306)", () => {
  const baseParams = {
    community: {
      id: "community-1",
      slug: "technology",
      name: "テクノロジー",
      description: "テクノロジーとプログラミングの話題を楽しむコミュニティ。",
      generationInstruction: null,
      synopsis: null,
      lastSlotKey: null,
      iconUrl: null,
      coverUrl: null,
      createdAt: new Date("2026-01-01"),
    },
    workers: [
      { id: "haru", displayName: "haru", role: "ムードメーカー", personality: "明るく前向き" },
      { id: "ken", displayName: "ken", role: "ベテラン", personality: "落ち着いた物知り" },
    ],
    recentLog: ["[technology] haru: 最近の AI トレンド面白いですね", "[technology] ken: 確かに、LLM の進歩は速い"],
  };

  it("コミュニティの description がプロンプトに含まれる", () => {
    const { prompt } = buildCommunityPrompt(baseParams);
    expect(prompt).toContain("テクノロジーとプログラミングの話題を楽しむコミュニティ。");
  });

  it("ワーカー情報がプロンプトに含まれる", () => {
    const { prompt } = buildCommunityPrompt(baseParams);
    expect(prompt).toContain("haru");
    expect(prompt).toContain("ムードメーカー");
    expect(prompt).toContain("ken");
    expect(prompt).toContain("ベテラン");
  });

  it("直近ログがプロンプトに含まれる", () => {
    const { prompt } = buildCommunityPrompt(baseParams);
    expect(prompt).toContain("[technology] haru: 最近の AI トレンド面白いですね");
    expect(prompt).toContain("[technology] ken: 確かに、LLM の進歩は速い");
  });

  it("お題（open_prompts）はプロンプトに含まれない", () => {
    const { prompt } = buildCommunityPrompt(baseParams);
    expect(prompt).not.toContain("open_prompts");
    expect(prompt).not.toContain("お題");
  });

  it("出力の JSON 形式指示が含まれる", () => {
    const { prompt } = buildCommunityPrompt(baseParams);
    expect(prompt).toContain("topic");
    expect(prompt).toContain("posts");
    expect(prompt).toContain("author");
    expect(prompt).toContain("title");
    expect(prompt).toContain("text");
    expect(prompt).toContain("comments");
  });

  it("直近ログが空の場合でもプロンプトが生成される", () => {
    const { prompt } = buildCommunityPrompt({ ...baseParams, recentLog: [] });
    expect(prompt).toBeTruthy();
    expect(prompt).toContain("テクノロジーとプログラミングの話題を楽しむコミュニティ。");
  });

  it("synopsis がある場合はプロンプトに含まれる", () => {
    const community = {
      ...baseParams.community,
      synopsis: "このコミュニティではテクノロジーの話題が中心。",
    };
    const { prompt } = buildCommunityPrompt({ ...baseParams, community });
    expect(prompt).toContain("このコミュニティではテクノロジーの話題が中心。");
  });

  describe("トーン規約（#487 / concept 共通エンジン部）", () => {
    it("呼称: 互いを「さん付け」で呼ばない指示が TONE_GUIDELINES に含まれる", () => {
      expect(TONE_GUIDELINES).toContain("さん付け");
    });

    it("距離感: 馴れ合い（中身のない同意・褒め合い）回避・率直さ歓迎の指示が TONE_GUIDELINES に含まれる", () => {
      expect(TONE_GUIDELINES).toContain("馴れ合い");
      expect(TONE_GUIDELINES).toContain("率直");
    });

    it("ガードレール: 深刻な対立・人格否定・攻撃をしない指示が TONE_GUIDELINES に含まれる（ADR-0023）", () => {
      expect(TONE_GUIDELINES).toContain("人格否定");
      expect(TONE_GUIDELINES).toContain("攻撃");
    });

    it("ガードレール: 失敗やハプニングを温かく着地させる指示が TONE_GUIDELINES に含まれる", () => {
      expect(TONE_GUIDELINES).toContain("温かく");
    });

    it("トーン規約がプロンプトに必ず注入される（全 community 共通）", () => {
      const { prompt } = buildCommunityPrompt(baseParams);
      expect(prompt).toContain(TONE_GUIDELINES);
    });

    it("community の description（作風）が変わってもトーン規約は常に注入される（受け入れ条件 2）", () => {
      const community = {
        ...baseParams.community,
        description: "全く別の作風: ホラー専門コミュニティ。",
      };
      const { prompt } = buildCommunityPrompt({ ...baseParams, community });
      expect(prompt).toContain("全く別の作風: ホラー専門コミュニティ。");
      expect(prompt).toContain(TONE_GUIDELINES);
    });

    it("自己監査に「さん付け」していないかの確認が含まれる（concept 自己監査）", () => {
      const { prompt } = buildCommunityPrompt(baseParams);
      expect(prompt).toContain("さん付け");
    });
  });

  describe("プロンプトキャッシュ向けの構造化（#389 AC4）", () => {
    it("安定部（トーン規約・作風・ワーカー）が可変部（直近ログ）より前に置かれる", () => {
      const { prompt } = buildCommunityPrompt(baseParams);
      const toneIdx = prompt.indexOf(TONE_GUIDELINES);
      const descIdx = prompt.indexOf("テクノロジーとプログラミングの話題を楽しむコミュニティ。");
      const workerIdx = prompt.indexOf("haru");
      const recentLogIdx = prompt.indexOf("[technology] haru: 最近の AI トレンド面白いですね");

      expect(toneIdx).toBeGreaterThanOrEqual(0);
      expect(descIdx).toBeGreaterThanOrEqual(0);
      expect(workerIdx).toBeGreaterThanOrEqual(0);
      expect(recentLogIdx).toBeGreaterThanOrEqual(0);
      expect(toneIdx).toBeLessThan(recentLogIdx);
      expect(descIdx).toBeLessThan(recentLogIdx);
      expect(workerIdx).toBeLessThan(recentLogIdx);
    });

    it("可変部（直近ログ）は出力フォーマット指示より前に置かれる", () => {
      const { prompt } = buildCommunityPrompt(baseParams);
      const recentLogIdx = prompt.indexOf("[technology] haru: 最近の AI トレンド面白いですね");
      const outputFormatIdx = prompt.indexOf("以下のJSON形式のみで出力してください");

      expect(recentLogIdx).toBeGreaterThanOrEqual(0);
      expect(outputFormatIdx).toBeGreaterThanOrEqual(0);
      expect(recentLogIdx).toBeLessThan(outputFormatIdx);
    });
  });
});

describe("verbosity（文章量設定）のプロンプト反映 (#625)", () => {
  const community = {
    id: "c1", slug: "s", name: "N", description: "テスト",
    generationInstruction: null, feedUrl: null, synopsis: null, lastSlotKey: null, iconUrl: null, coverUrl: null, createdAt: new Date(),
  };

  it("verbosity=concise のワーカーの定義行に簡潔指示が含まれる", () => {
    const { prompt } = buildCommunityPrompt({
      community,
      workers: [{ id: "w1", displayName: "Alice", verbosity: "concise" }],
      recentLog: [],
    });
    expect(prompt).toContain("1〜2 文程度");
  });

  it("verbosity=detailed のワーカーの定義行に詳細指示が含まれる", () => {
    const { prompt } = buildCommunityPrompt({
      community,
      workers: [{ id: "w1", displayName: "Alice", verbosity: "detailed" }],
      recentLog: [],
    });
    expect(prompt).toContain("具体例や背景を交えて");
  });

  it("verbosity=standard のワーカーの定義行に分量指示が含まれない", () => {
    const { prompt } = buildCommunityPrompt({
      community,
      workers: [{ id: "w1", displayName: "Alice", verbosity: "standard" }],
      recentLog: [],
    });
    expect(prompt).not.toContain("1〜2 文程度");
    expect(prompt).not.toContain("具体例や背景を交えて");
  });

  it("verbosity 未指定のワーカーの定義行に分量指示が含まれない", () => {
    const { prompt } = buildCommunityPrompt({
      community,
      workers: [{ id: "w1", displayName: "Alice" }],
      recentLog: [],
    });
    expect(prompt).not.toContain("1〜2 文程度");
    expect(prompt).not.toContain("具体例や背景を交えて");
  });

  it("複数ワーカーで verbosity が混在していても各ワーカーの指示が正しく含まれる", () => {
    const { prompt } = buildCommunityPrompt({
      community,
      workers: [
        { id: "w1", displayName: "Alice", verbosity: "concise" },
        { id: "w2", displayName: "Bob", verbosity: "standard" },
        { id: "w3", displayName: "Carol", verbosity: "detailed" },
      ],
      recentLog: [],
    });
    expect(prompt).toContain("1〜2 文程度");
    expect(prompt).toContain("具体例や背景を交えて");
  });
});

describe("人気トピックセクション（#558）", () => {
  const baseParams = {
    community: {
      id: "community-1",
      slug: "technology",
      name: "テクノロジー",
      description: "テクノロジーとプログラミングの話題を楽しむコミュニティ。",
      generationInstruction: null,
      synopsis: null,
      lastSlotKey: null,
      iconUrl: null,
      coverUrl: null,
      createdAt: new Date("2026-01-01"),
    },
    workers: [
      { id: "haru", displayName: "haru", role: "ムードメーカー", personality: "明るく前向き" },
    ],
    recentLog: ["[technology] haru: 最近の話題"],
  };

  it("popularPosts がある場合、人気投稿セクションがプロンプトに含まれる", () => {
    const { prompt } = buildCommunityPrompt({
      ...baseParams,
      popularPosts: [
        { title: "注目の AI 記事", author: "haru", score: 5 },
        { title: "TypeScript 入門", author: "ken", score: 3 },
      ],
    });
    expect(prompt).toContain("特に反応が良かった投稿");
    expect(prompt).toContain("注目の AI 記事");
    expect(prompt).toContain("TypeScript 入門");
    expect(prompt).toContain("score: 5");
    expect(prompt).toContain("score: 3");
  });

  it("popularPosts が空配列の場合、人気投稿セクションを省略する", () => {
    const { prompt } = buildCommunityPrompt({
      ...baseParams,
      popularPosts: [],
    });
    expect(prompt).not.toContain("特に反応が良かった投稿");
  });

  it("popularPosts が undefined の場合、人気投稿セクションを省略する（後方互換）", () => {
    const { prompt } = buildCommunityPrompt({
      ...baseParams,
    });
    expect(prompt).not.toContain("特に反応が良かった投稿");
  });

  it("人気投稿セクションはワーカー一覧より後・直近ログより前に置かれる（安定 prefix 内）", () => {
    const { prompt } = buildCommunityPrompt({
      ...baseParams,
      popularPosts: [{ title: "Popular Post", author: "haru", score: 10 }],
    });
    const workerIdx = prompt.indexOf("ワーカー一覧");
    const popularIdx = prompt.indexOf("特に反応が良かった投稿");
    const recentLogIdx = prompt.indexOf("[technology] haru: 最近の話題");

    expect(workerIdx).toBeGreaterThanOrEqual(0);
    expect(popularIdx).toBeGreaterThanOrEqual(0);
    expect(recentLogIdx).toBeGreaterThanOrEqual(0);
    expect(workerIdx).toBeLessThan(popularIdx);
    expect(popularIdx).toBeLessThan(recentLogIdx);
  });

  it("人気投稿が 1 件でもプロンプトが壊れない", () => {
    const { prompt } = buildCommunityPrompt({
      ...baseParams,
      popularPosts: [{ title: "Single Popular Post", author: "haru", score: 1 }],
    });
    expect(prompt).toBeTruthy();
    expect(prompt).toContain("Single Popular Post");
    expect(prompt).toContain("topic");
    expect(prompt).toContain("posts");
  });
});

describe("countHints によるpost/comment件数指示（#557）", () => {
  const baseCommunity = {
    id: "community-1",
    slug: "technology",
    name: "テクノロジー",
    description: "テクノロジーとプログラミングの話題を楽しむコミュニティ。",
    generationInstruction: null,
    synopsis: null,
    lastSlotKey: null,
    iconUrl: null,
    coverUrl: null,
    createdAt: new Date("2026-01-01"),
  };
  const workers = [{ id: "w1", displayName: "Alice" }];

  it("countHints を渡すとプロンプトに post 件数指示が含まれる", () => {
    const { prompt } = buildCommunityPrompt({
      community: baseCommunity,
      workers,
      recentLog: [],
      countHints: { postCount: 2, commentCount: 3 },
    });
    expect(prompt).toContain("2");
    expect(prompt).toContain("3");
    expect(prompt).toMatch(/post.*2|2.*post/i);
  });

  it("countHints を渡すとプロンプトにコメント件数指示が含まれる", () => {
    const { prompt } = buildCommunityPrompt({
      community: baseCommunity,
      workers,
      recentLog: [],
      countHints: { postCount: 1, commentCount: 2 },
    });
    expect(prompt).toMatch(/comment.*2|2.*comment|コメント.*2|2.*コメント/i);
  });

  it("countHints を渡さない場合は「1 件以上」の指示が含まれる（後方互換）", () => {
    const { prompt } = buildCommunityPrompt({
      community: baseCommunity,
      workers,
      recentLog: [],
    });
    expect(prompt).toContain("1 件以上");
  });

  it("countHints あり・なしでプロンプト構造は変わらず、トーン規約・ワーカー情報は常に含まれる", () => {
    const { prompt: withHints } = buildCommunityPrompt({
      community: baseCommunity,
      workers,
      recentLog: [],
      countHints: { postCount: 3, commentCount: 2 },
    });
    const { prompt: withoutHints } = buildCommunityPrompt({
      community: baseCommunity,
      workers,
      recentLog: [],
    });
    expect(withHints).toContain("Alice");
    expect(withoutHints).toContain("Alice");
    expect(withHints).toContain("さん付け");
    expect(withoutHints).toContain("さん付け");
  });
});

describe("generationInstruction フォールバック（#488）", () => {
  const workers = [{ id: "w1", displayName: "Alice" }];

  it("generationInstruction が設定されていればプロンプトに含まれる", () => {
    const { prompt } = buildCommunityPrompt({
      community: {
        id: "c1", slug: "s", name: "N", description: "公開概要（含まれない）",
        generationInstruction: "内部指示：脱さん付け",
        synopsis: null, lastSlotKey: null, iconUrl: null, coverUrl: null, createdAt: new Date(),
      },
      workers,
      recentLog: [],
    });
    expect(prompt).toContain("内部指示：脱さん付け");
    expect(prompt).not.toContain("公開概要（含まれない）");
  });

  it("generationInstruction が null のとき description にフォールバックする", () => {
    const { prompt } = buildCommunityPrompt({
      community: {
        id: "c1", slug: "s", name: "N", description: "公開概要（フォールバック）",
        generationInstruction: null,
        synopsis: null, lastSlotKey: null, iconUrl: null, coverUrl: null, createdAt: new Date(),
      },
      workers,
      recentLog: [],
    });
    expect(prompt).toContain("公開概要（フォールバック）");
  });

  it("generationInstruction が空文字のとき description にフォールバックする", () => {
    const { prompt } = buildCommunityPrompt({
      community: {
        id: "c1", slug: "s", name: "N", description: "公開概要（空フォールバック）",
        generationInstruction: "",
        synopsis: null, lastSlotKey: null, iconUrl: null, coverUrl: null, createdAt: new Date(),
      },
      workers,
      recentLog: [],
    });
    expect(prompt).toContain("公開概要（空フォールバック）");
  });
});

describe("重複回避指示（#526）", () => {
  const baseCommunity = {
    id: "community-1",
    slug: "technology",
    name: "テクノロジー",
    description: "テクノロジーとプログラミングの話題を楽しむコミュニティ。",
    generationInstruction: null,
    synopsis: null,
    lastSlotKey: null,
    iconUrl: null,
    coverUrl: null,
    createdAt: new Date("2026-01-01"),
  };
  const workers = [
    { id: "haru", displayName: "haru", role: "ムードメーカー", personality: "明るく前向き" },
    { id: "ken", displayName: "ken", role: "ベテラン", personality: "落ち着いた物知り" },
  ];

  it("recentLog があるとき重複回避の指示がプロンプトに含まれる (#526)", () => {
    const { prompt } = buildCommunityPrompt({
      community: baseCommunity,
      workers,
      recentLog: ["[technology] haru: TypeScript の新機能について", "[technology] ken: LLM の進歩が速い"],
    });
    expect(prompt).toContain("重複しない");
  });

  it("recentLog が空のとき重複回避の指示はプロンプトに含まれない (#526)", () => {
    const { prompt } = buildCommunityPrompt({
      community: baseCommunity,
      workers,
      recentLog: [],
    });
    expect(prompt).toBeTruthy();
    expect(prompt).toContain("テクノロジーとプログラミングの話題を楽しむコミュニティ。");
    expect(prompt).not.toContain("重複しない");
  });

  it("重複回避指示は直近ログ内容より後・JSON 出力指示より前に置かれる (#526)", () => {
    const { prompt } = buildCommunityPrompt({
      community: baseCommunity,
      workers,
      recentLog: ["[technology] haru: Rust を学んでみた"],
    });
    const recentLogContentIdx = prompt.indexOf("[technology] haru: Rust を学んでみた");
    const avoidDuplicateIdx = prompt.indexOf("重複しない");
    const outputFormatIdx = prompt.indexOf("以下のJSON形式のみで出力してください");

    expect(recentLogContentIdx).toBeGreaterThanOrEqual(0);
    expect(avoidDuplicateIdx).toBeGreaterThanOrEqual(0);
    expect(outputFormatIdx).toBeGreaterThanOrEqual(0);
    expect(recentLogContentIdx).toBeLessThan(avoidDuplicateIdx);
    expect(avoidDuplicateIdx).toBeLessThan(outputFormatIdx);
  });
});

describe("既存Post参照（#555）", () => {
  const workers = [{ id: "haru", displayName: "haru" }];
  const baseCommunity = {
    id: "c1", slug: "tech", name: "テクノロジー", description: "テク話",
    generationInstruction: null, feedUrl: null, synopsis: null, lastSlotKey: null,
    iconUrl: null, coverUrl: null, createdAt: new Date(),
  };

  it("recentPosts が指定された場合、プロンプトに参照IDと投稿タイトルが含まれる（#555）", () => {
    const result = buildCommunityPrompt({
      community: baseCommunity,
      workers,
      recentLog: [],
      recentPosts: [
        { ref: "ref-1", id: "post-uuid-1", title: "TypeScriptの新機能について" },
        { ref: "ref-2", id: "post-uuid-2", title: "Rustを学んでみた" },
      ],
    });
    expect(result.prompt).toContain("ref-1");
    expect(result.prompt).toContain("TypeScriptの新機能について");
    expect(result.prompt).toContain("ref-2");
    expect(result.prompt).toContain("Rustを学んでみた");
  });

  it("recentPosts が指定された場合、既存Postにコメントを追加できる旨の指示（replies フィールド）が含まれる（#555）", () => {
    const result = buildCommunityPrompt({
      community: baseCommunity,
      workers,
      recentLog: [],
      recentPosts: [
        { ref: "ref-1", id: "post-uuid-1", title: "TypeScriptの新機能について" },
      ],
    });
    expect(result.prompt).toContain("replies");
  });

  it("postRefMap に参照ID → 実postId のマッピングが含まれる（#555）", () => {
    const result = buildCommunityPrompt({
      community: baseCommunity,
      workers,
      recentLog: [],
      recentPosts: [
        { ref: "ref-1", id: "post-uuid-1", title: "TypeScriptの新機能について" },
        { ref: "ref-2", id: "post-uuid-2", title: "Rustを学んでみた" },
      ],
    });
    expect(result.postRefMap.get("ref-1")).toBe("post-uuid-1");
    expect(result.postRefMap.get("ref-2")).toBe("post-uuid-2");
  });

  it("recentPosts が省略された場合、postRefMap は空になる（#555）", () => {
    const result = buildCommunityPrompt({
      community: baseCommunity,
      workers,
      recentLog: [],
    });
    expect(result.postRefMap.size).toBe(0);
  });

  it("recentPosts が空配列のとき、postRefMap は空になる（#555）", () => {
    const result = buildCommunityPrompt({
      community: baseCommunity,
      workers,
      recentLog: [],
      recentPosts: [],
    });
    expect(result.postRefMap.size).toBe(0);
  });

  it("戻り値の prompt は文字列で内容を含む（#555・後方互換）", () => {
    const result = buildCommunityPrompt({
      community: baseCommunity,
      workers,
      recentLog: [],
    });
    expect(typeof result.prompt).toBe("string");
    expect(result.prompt.length).toBeGreaterThan(0);
    expect(result.prompt).toContain("テク話");
  });
});

describe("UUID誘導ラベル（#715）", () => {
  const community = {
    id: "c1", slug: "s", name: "N", description: "テスト",
    generationInstruction: null, feedUrl: null, synopsis: null, lastSlotKey: null,
    iconUrl: null, coverUrl: null, createdAt: new Date(),
  };
  const workers = [
    { id: "550e8400-e29b-41d4-a716-446655440001", displayName: "haru" },
    { id: "550e8400-e29b-41d4-a716-446655440002", displayName: "ken" },
  ];

  it("ワーカー一覧の ID ラベルに「author に指定するID（UUID）」が含まれる", () => {
    const { prompt } = buildCommunityPrompt({ community, workers, recentLog: [] });
    expect(prompt).toContain("author に指定するID（UUID）");
  });

  it("ワーカー一覧の名前ラベルに「名前（参考・author には使わない）」が含まれる", () => {
    const { prompt } = buildCommunityPrompt({ community, workers, recentLog: [] });
    expect(prompt).toContain("名前（参考・author には使わない）");
  });

  it("JSON 例示の author フィールドに「UUID（上記ワーカー一覧の「author に指定するID」から選択」が含まれる", () => {
    const { prompt } = buildCommunityPrompt({ community, workers, recentLog: [] });
    expect(prompt).toContain("UUID（上記ワーカー一覧の「author に指定するID」から選択");
  });

  it("注意事項セクションに UUID の文言が含まれる（author は UUID を使うべきという誘導）", () => {
    const { prompt } = buildCommunityPrompt({ community, workers, recentLog: [] });
    const authorNoteIdx = prompt.indexOf("author には必ず");
    expect(authorNoteIdx).toBeGreaterThanOrEqual(0);
    const afterAuthorNote = prompt.slice(authorNoteIdx, authorNoteIdx + 100);
    expect(afterAuthorNote).toContain("UUID");
  });

  it("replies セクションの author フィールドも UUID 指定の表現になっている（recentPosts あり）", () => {
    const { prompt } = buildCommunityPrompt({
      community,
      workers,
      recentLog: [],
      recentPosts: [{ ref: "ref-1", id: "post-uuid-1", title: "テスト投稿" }],
    });
    const repliesIdx = prompt.indexOf('"replies"');
    expect(repliesIdx).toBeGreaterThanOrEqual(0);
    const repliesSection = prompt.slice(repliesIdx, repliesIdx + 300);
    expect(repliesSection).toContain("UUID（上記ワーカー一覧の「author に指定するID」から選択");
  });
});

describe("buildCommunityPrompt: feedArticles の注入（#491 / ADR-0035）", () => {
  const community = {
    id: "community-feed",
    slug: "zenn-fan",
    name: "Zenn 感想部",
    description: "技術記事の感想を語り合うコミュニティ。",
    generationInstruction: null,
    synopsis: null,
    lastSlotKey: null,
    iconUrl: null,
    coverUrl: null,
    feedUrl: null,
    createdAt: new Date("2026-01-01"),
  };
  const workers = [{ id: "worker-1", displayName: "alice", role: null, personality: null }];

  it("feedArticles が指定された場合にプロンプトに注入される", () => {
    const { prompt } = buildCommunityPrompt({
      community,
      workers,
      recentLog: [],
      feedArticles: [
        { title: "TypeScript 5.0 の新機能", url: "https://zenn.dev/articles/ts50", summary: "TS5.0 の概要。", author: "yamada" },
      ],
    });
    expect(prompt).toContain("TypeScript 5.0 の新機能");
    expect(prompt).not.toContain("https://zenn.dev/articles/ts50"); // URL は含めない（#927）
    expect(prompt).toContain("TS5.0 の概要。");
    expect(prompt).toContain("yamada");
  });

  it("feedArticles の URL はプロンプトに含まれない（#927）", () => {
    const { prompt } = buildCommunityPrompt({
      community,
      workers,
      recentLog: [],
      feedArticles: [
        { title: "ある記事", url: "https://b.hatena.ne.jp/hotentry/general", summary: "概要テキスト", author: null },
        { title: "別の記事", url: "https://b.hatena.ne.jp/hotentry/it", summary: null, author: "author-a" },
      ],
    });
    expect(prompt).not.toContain("https://b.hatena.ne.jp/hotentry/general");
    expect(prompt).not.toContain("https://b.hatena.ne.jp/hotentry/it");
    expect(prompt).toContain("ある記事");
    expect(prompt).toContain("別の記事");
    expect(prompt).toContain("概要テキスト");
  });

  it("feedArticles の summary 内に URL が含まれる場合もプロンプトに露出しない（#927）", () => {
    const { prompt } = buildCommunityPrompt({
      community,
      workers,
      recentLog: [],
      feedArticles: [
        {
          title: "ある記事",
          url: "https://b.hatena.ne.jp/hotentry/general",
          summary: "詳細は https://example.com/article を参照してください。面白い内容です。",
          author: null,
        },
      ],
    });
    expect(prompt).not.toContain("https://example.com/article");
    expect(prompt).toContain("面白い内容です");
  });

  it("注意事項に URL を本文に含めない禁止指示が含まれる（#927）", () => {
    const { prompt } = buildCommunityPrompt({ community, workers, recentLog: [] });
    expect(prompt).toMatch(/URL.*含めない|含めない.*URL/);
  });

  it("feedArticles が省略された場合はプロンプトに変化なし（フィード関連テキストなし）", () => {
    const { prompt } = buildCommunityPrompt({
      community,
      workers,
      recentLog: [],
    });
    expect(prompt).not.toContain("最新フィード記事");
  });

  it("feedArticles が空配列の場合はプロンプトに変化なし（フィード関連テキストなし）", () => {
    const { prompt } = buildCommunityPrompt({
      community,
      workers,
      recentLog: [],
      feedArticles: [],
    });
    expect(prompt).not.toContain("最新フィード記事");
  });

  it("author が null の場合はプロンプトに by ... が含まれない", () => {
    const { prompt } = buildCommunityPrompt({
      community,
      workers,
      recentLog: [],
      feedArticles: [
        { title: "匿名記事", url: "https://example.com/anon", summary: "無名の記事。", author: null },
      ],
    });
    expect(prompt).toContain("匿名記事");
    expect(prompt).not.toContain("by null");
  });

  it("summary が null の場合は概要行を省略する", () => {
    const { prompt } = buildCommunityPrompt({
      community,
      workers,
      recentLog: [],
      feedArticles: [
        { title: "概要なし記事", url: "https://example.com/nosummary", summary: null, author: "taro" },
      ],
    });
    expect(prompt).toContain("概要なし記事");
    expect(prompt).not.toContain("概要: null");
  });
});
