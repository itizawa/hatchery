import { describe, expect, it } from "vitest";

import type { CommunityRecord } from "../persistence/communityRepository.js";
import { buildPostPrompt } from "./buildPostPrompt.js";
import type { WorkerDef } from "./buildCommunityPrompt.js";

const community: CommunityRecord = {
  id: "community-1",
  slug: "technology",
  name: "テクノロジー",
  description: "テクノロジーとプログラミングの話題を楽しむコミュニティ。",
  generationInstruction: null,
  feedUrl: null,
  synopsis: null,
  lastSlotKey: null,
  iconUrl: null,
  coverUrl: null,
  createdAt: new Date("2026-01-01"),
};

const workers: WorkerDef[] = [
  { id: "worker-1", displayName: "haru", role: "ムードメーカー" },
  { id: "worker-2", displayName: "ken", role: "ベテラン" },
];

describe("buildPostPrompt", () => {
  it("プロンプトに post 生成指示が含まれる", () => {
    const { prompt } = buildPostPrompt({ community, workers, recentLog: [] });
    expect(prompt).toContain("posts");
  });

  it("プロンプトにコメント件数の生成指示が含まれない（コメントは生成しない）", () => {
    const { prompt } = buildPostPrompt({
      community,
      workers,
      recentLog: [],
      countHints: { postCount: 2 },
    });
    expect(prompt).not.toMatch(/コメント.*件/);
    expect(prompt).not.toMatch(/comment.*件/i);
  });

  it("countHints.postCount が指定されたとき、その件数がプロンプトに含まれる", () => {
    const { prompt } = buildPostPrompt({
      community,
      workers,
      recentLog: [],
      countHints: { postCount: 3 },
    });
    expect(prompt).toContain("3");
  });

  it("コミュニティ名・説明がプロンプトに含まれる", () => {
    const { prompt } = buildPostPrompt({ community, workers, recentLog: [] });
    expect(prompt).toContain(community.name);
    expect(prompt).toContain(community.description);
  });

  it("ワーカー ID がプロンプトに含まれる", () => {
    const { prompt } = buildPostPrompt({ community, workers, recentLog: [] });
    expect(prompt).toContain("worker-1");
    expect(prompt).toContain("worker-2");
  });

  it("直近ログが指定された場合プロンプトに含まれる", () => {
    const { prompt } = buildPostPrompt({
      community,
      workers,
      recentLog: ["2026-01-01 haru: テスト投稿"],
    });
    expect(prompt).toContain("テスト投稿");
  });

  it("comments フィールドは空配列で出力するよう指示する", () => {
    const { prompt } = buildPostPrompt({ community, workers, recentLog: [] });
    expect(prompt).toContain('"comments": []');
  });

  it("replies フィールドは空配列で出力するよう指示する", () => {
    const { prompt } = buildPostPrompt({ community, workers, recentLog: [] });
    expect(prompt).toContain('"replies": []');
  });

  it("注意事項に URL を本文に含めない禁止指示が含まれる（#927）", () => {
    const { prompt } = buildPostPrompt({ community, workers, recentLog: [] });
    expect(prompt).toMatch(/URL.*含めない|含めない.*URL/);
  });
});

describe("タイトル重複回避・修辞多様化指示（#1019）", () => {
  it("recentTitles が指定された場合、タイトル重複回避の指示がプロンプトに含まれる", () => {
    const { prompt } = buildPostPrompt({
      community,
      workers,
      recentLog: [],
      recentTitles: ["「努力は報われる」って呪いの言葉じゃない？"],
    });
    expect(prompt).toMatch(/同一.*タイトル.*使わない|タイトル.*重複.*避け|既存タイトル.*使わない/);
  });

  it("recentTitles に含まれる各タイトル文字列がプロンプトに明記される", () => {
    const title1 = "「努力は報われる」って呪いの言葉じゃない？";
    const title2 = "「やりがい」を報酬として使う組織、普通に搾取じゃない？";
    const { prompt } = buildPostPrompt({
      community,
      workers,
      recentLog: [],
      recentTitles: [title1, title2],
    });
    expect(prompt).toContain(title1);
    expect(prompt).toContain(title2);
  });

  it("recentTitles が空配列のとき、タイトル重複回避の指示がプロンプトに含まれない", () => {
    const { prompt } = buildPostPrompt({
      community,
      workers,
      recentLog: [],
      recentTitles: [],
    });
    expect(prompt).not.toMatch(/同一.*タイトル.*使わない|タイトル.*重複.*避け|既存タイトル.*使わない/);
  });

  it("recentTitles が省略されたとき、タイトル重複回避の指示がプロンプトに含まれない（後方互換）", () => {
    const { prompt } = buildPostPrompt({
      community,
      workers,
      recentLog: [],
    });
    expect(prompt).not.toMatch(/同一.*タイトル.*使わない|タイトル.*重複.*避け|既存タイトル.*使わない/);
  });

  it("recentTitles が指定された場合、修辞スタイル多様化の指示がプロンプトに含まれる", () => {
    const { prompt } = buildPostPrompt({
      community,
      workers,
      recentLog: [],
      recentTitles: ["「変化を恐れるな」って、変化のコストを誰が払うかを完全に無視してない？"],
    });
    expect(prompt).toMatch(/修辞|スタイル|パターン|文体|切り口/);
  });
});
