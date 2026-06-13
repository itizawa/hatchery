import { describe, expect, it } from "vitest";

import { buildCommunityPrompt, TONE_GUIDELINES } from "./buildCommunityPrompt.js";

describe("buildCommunityPrompt (#306)", () => {
  const baseParams = {
    community: {
      id: "community-1",
      slug: "technology",
      name: "テクノロジー",
      description: "テクノロジーとプログラミングの話題を楽しむコミュニティ。",
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
    const prompt = buildCommunityPrompt(baseParams);
    expect(prompt).toContain("テクノロジーとプログラミングの話題を楽しむコミュニティ。");
  });

  it("ワーカー情報がプロンプトに含まれる", () => {
    const prompt = buildCommunityPrompt(baseParams);
    expect(prompt).toContain("haru");
    expect(prompt).toContain("ムードメーカー");
    expect(prompt).toContain("ken");
    expect(prompt).toContain("ベテラン");
  });

  it("直近ログがプロンプトに含まれる", () => {
    const prompt = buildCommunityPrompt(baseParams);
    expect(prompt).toContain("[technology] haru: 最近の AI トレンド面白いですね");
    expect(prompt).toContain("[technology] ken: 確かに、LLM の進歩は速い");
  });

  it("お題（open_prompts）はプロンプトに含まれない", () => {
    const prompt = buildCommunityPrompt(baseParams);
    // お題に関するキーワードが含まれないことを確認
    expect(prompt).not.toContain("open_prompts");
    expect(prompt).not.toContain("お題");
  });

  it("出力の JSON 形式指示が含まれる", () => {
    const prompt = buildCommunityPrompt(baseParams);
    // topic と posts を含む JSON 形式を要求
    expect(prompt).toContain("topic");
    expect(prompt).toContain("posts");
    expect(prompt).toContain("author");
    expect(prompt).toContain("title");
    expect(prompt).toContain("text");
    expect(prompt).toContain("comments");
  });

  it("直近ログが空の場合でもプロンプトが生成される", () => {
    const prompt = buildCommunityPrompt({ ...baseParams, recentLog: [] });
    expect(prompt).toBeTruthy();
    expect(prompt).toContain("テクノロジーとプログラミングの話題を楽しむコミュニティ。");
  });

  it("synopsis がある場合はプロンプトに含まれる", () => {
    const community = {
      ...baseParams.community,
      synopsis: "このコミュニティではテクノロジーの話題が中心。",
    };
    const prompt = buildCommunityPrompt({ ...baseParams, community });
    expect(prompt).toContain("このコミュニティではテクノロジーの話題が中心。");
  });

  // #487: トーン規約（共通エンジン部 = 脚本ルール層）
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
      const prompt = buildCommunityPrompt(baseParams);
      expect(prompt).toContain(TONE_GUIDELINES);
    });

    it("community の description（作風）が変わってもトーン規約は常に注入される（受け入れ条件 2）", () => {
      const community = {
        ...baseParams.community,
        description: "全く別の作風: ホラー専門コミュニティ。",
      };
      const prompt = buildCommunityPrompt({ ...baseParams, community });
      // 固有部（作風）も、共通エンジン部（トーン規約）も両方含まれる
      expect(prompt).toContain("全く別の作風: ホラー専門コミュニティ。");
      expect(prompt).toContain(TONE_GUIDELINES);
    });

    it("自己監査に「さん付け」していないかの確認が含まれる（concept 自己監査）", () => {
      const prompt = buildCommunityPrompt(baseParams);
      // 自己監査セクションで さん付け をチェックさせる
      expect(prompt).toContain("さん付け");
    });
  });

  // #389 AC4: 安定 prefix（テンプレート + ワーカー + 作風）→ 可変 suffix（直近ログ）の順に構造化
  describe("プロンプトキャッシュ向けの構造化（#389 AC4）", () => {
    it("安定部（トーン規約・作風・ワーカー）が可変部（直近ログ）より前に置かれる", () => {
      const prompt = buildCommunityPrompt(baseParams);
      const toneIdx = prompt.indexOf(TONE_GUIDELINES);
      const descIdx = prompt.indexOf("テクノロジーとプログラミングの話題を楽しむコミュニティ。");
      const workerIdx = prompt.indexOf("haru");
      const recentLogIdx = prompt.indexOf("[technology] haru: 最近の AI トレンド面白いですね");

      // 安定部はすべて存在し、直近ログより前にある
      expect(toneIdx).toBeGreaterThanOrEqual(0);
      expect(descIdx).toBeGreaterThanOrEqual(0);
      expect(workerIdx).toBeGreaterThanOrEqual(0);
      expect(recentLogIdx).toBeGreaterThanOrEqual(0);
      expect(toneIdx).toBeLessThan(recentLogIdx);
      expect(descIdx).toBeLessThan(recentLogIdx);
      expect(workerIdx).toBeLessThan(recentLogIdx);
    });

    it("可変部（直近ログ）は出力フォーマット指示より前に置かれる", () => {
      const prompt = buildCommunityPrompt(baseParams);
      const recentLogIdx = prompt.indexOf("[technology] haru: 最近の AI トレンド面白いですね");
      const outputFormatIdx = prompt.indexOf("以下のJSON形式のみで出力してください");

      expect(recentLogIdx).toBeGreaterThanOrEqual(0);
      expect(outputFormatIdx).toBeGreaterThanOrEqual(0);
      expect(recentLogIdx).toBeLessThan(outputFormatIdx);
    });
  });
});
