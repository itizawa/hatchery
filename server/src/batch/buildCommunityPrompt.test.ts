import { describe, expect, it } from "vitest";

import { buildCommunityPrompt } from "./buildCommunityPrompt.js";

describe("buildCommunityPrompt (#306)", () => {
  const baseParams = {
    community: {
      id: "community-1",
      slug: "technology",
      name: "テクノロジー",
      description: "テクノロジーとプログラミングの話題を楽しむコミュニティ。",
      synopsis: null,
      lastSlotKey: null,
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
});
